import { useState, useRef, useEffect, useCallback } from 'react';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { resampleAudio, float32ToInt16PCM, calculateRMS } from '../utils/audioProcessing';
import { voiceTransport, VoiceTransportState, VoiceSessionContext } from '../services/voiceTransport';

export interface AudioDiagnostics {
  processingActive: boolean;
  inputSampleRate: number;
  outputSampleRate: number;
  chunkCount: number;
  byteCount: number;
  sampleCount: number;
  rmsLevel: number;
}

export type VoicePlaybackState = 'idle' | 'receiving' | 'speaking';

export interface UseVoiceCaptureReturn {
  isVoiceActive: boolean;
  voiceError: string | null;
  startCapture: () => Promise<boolean>;
  stopCapture: () => void;
  toggleVoiceCapture: () => Promise<void>;
  clearVoiceError: () => void;
  stream: MediaStream | null;
  diagnostics: AudioDiagnostics;
  liveState: VoiceTransportState;
  liveTranscript: string;
  isNativeSpeech: boolean;
  playbackState: VoicePlaybackState;
}

const INITIAL_DIAGNOSTICS: AudioDiagnostics = {
  processingActive: false,
  inputSampleRate: 0,
  outputSampleRate: 16000,
  chunkCount: 0,
  byteCount: 0,
  sampleCount: 0,
  rmsLevel: 0
};

/**
 * Custom hook providing browser-native microphone capture, local 16 kHz PCM conversion,
 * and secure backend WebSocket transport to Gemini Live.
 */
export function useVoiceCapture(context?: VoiceSessionContext): UseVoiceCaptureReturn {
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<AudioDiagnostics>(INITIAL_DIAGNOSTICS);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [liveState, setLiveState] = useState<VoiceTransportState>('idle');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [isNativeSpeech, setIsNativeSpeech] = useState(false);
  const [playbackState, setPlaybackState] = useState<VoicePlaybackState>('idle');

  // References for Web Audio API node lifecycle
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<AudioNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const playbackQueueDurationRef = useRef(0);
  const playbackQueueBytesRef = useRef(0);
  const playbackRunningRef = useRef(false);
  const playbackGenerationRef = useRef(0);
  const turnCompleteRef = useRef(false);
  const voiceContextRef = useRef(context);
  const nativeSpeechActiveRef = useRef(false);
  const nativeSpeechListenerRef = useRef<PluginListenerHandle | null>(null);

  useEffect(() => {
    voiceContextRef.current = context;
  }, [context]);

  const MAX_PLAYBACK_QUEUE_DURATION_SECONDS = 30;
  const MAX_PLAYBACK_QUEUE_BYTES = 4 * 1024 * 1024;

  const startNextPlayback = useCallback(() => {
    const playbackContext = playbackContextRef.current;
    if (!playbackContext || playbackRunningRef.current) return;

    const audioBuffer = playbackQueueRef.current.shift();
    if (!audioBuffer) {
      setPlaybackState(turnCompleteRef.current ? 'idle' : 'receiving');
      return;
    }

    playbackQueueDurationRef.current = Math.max(0, playbackQueueDurationRef.current - audioBuffer.duration);
    playbackQueueBytesRef.current = Math.max(
      0,
      playbackQueueBytesRef.current - audioBuffer.length * audioBuffer.numberOfChannels * 2
    );
    playbackRunningRef.current = true;

    const source = playbackContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackContext.destination);
    playbackSourcesRef.current.add(source);
    const generation = playbackGenerationRef.current;
    setPlaybackState('speaking');

    source.onended = () => {
      playbackSourcesRef.current.delete(source);
      playbackRunningRef.current = false;
      source.disconnect();

      if (generation !== playbackGenerationRef.current) return;
      if (playbackQueueRef.current.length > 0) {
        startNextPlayback();
      } else {
        setPlaybackState(turnCompleteRef.current ? 'idle' : 'receiving');
      }
    };

    source.start();
  }, []);

  const stopPlayback = useCallback(() => {
    playbackGenerationRef.current += 1;
    playbackQueueRef.current = [];
    playbackQueueDurationRef.current = 0;
    playbackQueueBytesRef.current = 0;
    playbackRunningRef.current = false;
    turnCompleteRef.current = false;

    playbackSourcesRef.current.forEach((source) => {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // The source may already have ended.
      }
      try {
        source.disconnect();
      } catch {
        // Ignore cleanup errors.
      }
    });
    playbackSourcesRef.current.clear();
    setPlaybackState('idle');
  }, []);

  const closePlayback = useCallback(() => {
    stopPlayback();
    const playbackContext = playbackContextRef.current;
    playbackContextRef.current = null;
    if (playbackContext && playbackContext.state !== 'closed') {
      playbackContext.close().catch((err) => {
        console.warn('[Audio Playback] Error closing AudioContext:', err);
      });
    }
  }, [stopPlayback]);

  const getPlaybackContext = useCallback(() => {
    if (playbackContextRef.current) return playbackContextRef.current;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) throw new Error('Web Audio API playback is not supported in this browser.');

    playbackContextRef.current = new AudioCtx();
    return playbackContextRef.current;
  }, []);

  const schedulePlayback = useCallback((base64Data: string, mimeType: string) => {
    const rateMatch = mimeType.match(/rate=(\d+)/i);
    const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new Error(`Unsupported Gemini audio sample rate: ${mimeType}`);
    }

    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    if (bytes.byteLength < 2) return;

    const sampleCount = Math.floor(bytes.byteLength / 2);
    const playbackContext = getPlaybackContext();
    const audioBuffer = playbackContext.createBuffer(1, sampleCount, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
    for (let index = 0; index < sampleCount; index += 1) {
      channelData[index] = view.getInt16(index * 2, true) / 32768;
    }

    if (playbackContext.state === 'suspended') {
      void playbackContext.resume();
    }

    const chunkBytes = sampleCount * 2;
    if (
      playbackQueueDurationRef.current + audioBuffer.duration > MAX_PLAYBACK_QUEUE_DURATION_SECONDS ||
      playbackQueueBytesRef.current + chunkBytes > MAX_PLAYBACK_QUEUE_BYTES
    ) {
      throw new Error('Gemini audio playback buffer exceeded its 30-second limit.');
    }

    playbackQueueRef.current.push(audioBuffer);
    playbackQueueDurationRef.current += audioBuffer.duration;
    playbackQueueBytesRef.current += chunkBytes;
    startNextPlayback();
  }, [getPlaybackContext, startNextPlayback]);

  const handlePlaybackAudio = useCallback((data: string, mimeType: string) => {
    setPlaybackState('receiving');
    try {
      schedulePlayback(data, mimeType);
    } catch (err) {
      console.error('[Audio Playback] Unable to decode Gemini audio:', err);
      setVoiceError('Gemini audio could not be played in this browser.');
      stopPlayback();
    }
  }, [schedulePlayback, stopPlayback]);

  // Throttling ref for React state updates
  const lastStateUpdateRef = useRef<number>(0);
  const statsAccumulatorRef = useRef({
    chunkCount: 0,
    byteCount: 0,
    sampleCount: 0,
    lastRms: 0
  });

  const clearVoiceError = useCallback(() => {
    setVoiceError(null);
  }, []);

  const removeNativeSpeechListener = useCallback(() => {
    if (nativeSpeechListenerRef.current) {
      void nativeSpeechListenerRef.current.remove();
      nativeSpeechListenerRef.current = null;
    }
  }, []);

  /**
   * Complete teardown of all audio resources and backend transport.
   */
  const stopCapture = useCallback(() => {
    if (nativeSpeechActiveRef.current) {
      void SpeechRecognition.stop().catch(() => undefined);
      nativeSpeechActiveRef.current = false;
      removeNativeSpeechListener();
      setIsNativeSpeech(false);
    }

    // 1. Stop all Gemini audio before disconnecting the live session.
    closePlayback();

    // 2. Disconnect WebSocket session to Gemini Live
    try {
      voiceTransport.disconnect();
    } catch (err) {
      console.warn('[VoiceTransport] Error disconnecting transport:', err);
    }
    setLiveState('idle');

    // 3. Disconnect and release audio processor node
    if (processorNodeRef.current) {
      try {
        if ('port' in processorNodeRef.current) {
          (processorNodeRef.current as AudioWorkletNode).port.onmessage = null;
        } else if ('onaudioprocess' in processorNodeRef.current) {
          (processorNodeRef.current as ScriptProcessorNode).onaudioprocess = null;
        }
        processorNodeRef.current.disconnect();
      } catch (err) {
        console.warn('[Audio Pipeline] Error disconnecting processor:', err);
      }
      processorNodeRef.current = null;
    }

    // 4. Disconnect MediaStream audio source
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (err) {
        console.warn('[Audio Pipeline] Error disconnecting source node:', err);
      }
      sourceNodeRef.current = null;
    }

    // 5. Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch((err) => {
          console.warn('[Audio Pipeline] Error closing AudioContext:', err);
        });
      } catch (err) {
        console.warn('[Audio Pipeline] AudioContext close error:', err);
      }
      audioContextRef.current = null;
    }

    // 6. Stop all MediaStream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.warn('[Audio Pipeline] Error stopping track:', err);
        }
      });
      streamRef.current = null;
    }

    // 7. Reset states
    setStream(null);
    setIsVoiceActive(false);
    setDiagnostics(INITIAL_DIAGNOSTICS);
    statsAccumulatorRef.current = {
      chunkCount: 0,
      byteCount: 0,
      sampleCount: 0,
      lastRms: 0
    };
  }, []);

  /**
   * Core frame processing handler: resamples Float32 -> 16kHz -> Int16 PCM,
   * sends chunk to WebSocket transport, and updates diagnostics.
   */
  const handleAudioFrame = useCallback(
    (inputFloat32: Float32Array, inputSampleRate: number) => {
      if (!inputFloat32 || inputFloat32.length === 0) return;

      // 1. Resample to 16,000 Hz
      const resampledFloat32 = resampleAudio(inputFloat32, inputSampleRate, 16000);

      // 2. Convert to Signed 16-bit PCM
      const pcm16Chunk = float32ToInt16PCM(resampledFloat32);

      // 3. Transmit binary PCM chunk to backend Gemini Live transport
      voiceTransport.sendAudioChunk(pcm16Chunk.buffer);

      // 4. Compute RMS amplitude for diagnostics
      const rms = calculateRMS(inputFloat32);

      // 5. Accumulate telemetry metrics
      const stats = statsAccumulatorRef.current;
      stats.chunkCount += 1;
      stats.sampleCount += pcm16Chunk.length;
      stats.byteCount += pcm16Chunk.byteLength;
      stats.lastRms = rms;

      // 6. Throttle React state updates to ~60ms for smooth UI telemetry
      const now = performance.now();
      if (now - lastStateUpdateRef.current > 60) {
        lastStateUpdateRef.current = now;
        setDiagnostics({
          processingActive: true,
          inputSampleRate,
          outputSampleRate: 16000,
          chunkCount: stats.chunkCount,
          byteCount: stats.byteCount,
          sampleCount: stats.sampleCount,
          rmsLevel: stats.lastRms
        });
      }
    },
    []
  );

  /**
   * Initializes Web Audio API pipeline with AudioWorklet (fallback to ScriptProcessor).
   */
  const setupAudioPipeline = useCallback(
    async (audioStream: MediaStream) => {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this browser.');
      }

      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const inputSampleRate = audioContext.sampleRate;
      const source = audioContext.createMediaStreamSource(audioStream);
      sourceNodeRef.current = source;

      let workletInitialized = false;

      // Try modern AudioWorklet first
      if (audioContext.audioWorklet && typeof Blob !== 'undefined') {
        try {
          const workletCode = `
            class VoicePCMProcessor extends AudioWorkletProcessor {
              process(inputs) {
                const input = inputs[0];
                if (input && input[0] && input[0].length > 0) {
                  this.port.postMessage(input[0]);
                }
                return true;
              }
            }
            registerProcessor('voice-pcm-processor', VoicePCMProcessor);
          `;
          const blob = new Blob([workletCode], { type: 'application/javascript' });
          const workletUrl = URL.createObjectURL(blob);
          await audioContext.audioWorklet.addModule(workletUrl);
          URL.revokeObjectURL(workletUrl);

          const workletNode = new AudioWorkletNode(audioContext, 'voice-pcm-processor');
          workletNode.port.onmessage = (event) => {
            const float32Data = event.data as Float32Array;
            handleAudioFrame(float32Data, inputSampleRate);
          };

          source.connect(workletNode);
          processorNodeRef.current = workletNode;
          workletInitialized = true;
        } catch (workletError) {
          console.warn('[Audio Pipeline] AudioWorklet setup fallback to ScriptProcessor:', workletError);
        }
      }

      // Reliable fallback to ScriptProcessorNode if AudioWorklet unavailable
      if (!workletInitialized) {
        const bufferSize = 2048;
        const scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
        scriptNode.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          handleAudioFrame(inputData, inputSampleRate);

          const outputData = event.outputBuffer.getChannelData(0);
          outputData.fill(0);
        };

        source.connect(scriptNode);
        const silentGain = audioContext.createGain();
        silentGain.gain.setValueAtTime(0, audioContext.currentTime);
        scriptNode.connect(silentGain);
        // Keep the processor alive without routing microphone audio to speakers.
        silentGain.connect(audioContext.createMediaStreamDestination());

        processorNodeRef.current = scriptNode;
      }

      setDiagnostics((prev) => ({
        ...prev,
        processingActive: true,
        inputSampleRate,
        outputSampleRate: 16000
      }));
    },
    [handleAudioFrame]
  );

  /**
   * Starts microphone capture, Web Audio pipeline, and connects to the Gemini Live session.
   */
  const startCapture = useCallback(async (): Promise<boolean> => {
    const isAndroidCapacitor = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

    if (isAndroidCapacitor) {
      stopCapture();
      setVoiceError(null);
      setLiveTranscript('');

      try {
        const permission = await SpeechRecognition.checkPermissions();
        const granted = permission.speechRecognition === 'granted';
        const requestedPermission = granted ? permission : await SpeechRecognition.requestPermissions();
        if (requestedPermission.speechRecognition !== 'granted') {
          throw new Error('Speech recognition permission was denied. Allow microphone access for WeatherGPT and try again.');
        }

        const availability = await SpeechRecognition.available();
        if (!availability.available) {
          throw new Error('Speech recognition is unavailable on this Android device.');
        }

        nativeSpeechListenerRef.current = await SpeechRecognition.addListener('partialResults', (event) => {
          const transcript = event.matches?.[0]?.trim();
          if (transcript) setLiveTranscript(transcript);
        });
        nativeSpeechActiveRef.current = true;
        setIsNativeSpeech(true);
        setIsVoiceActive(true);

        const language = voiceContextRef.current?.language;
        const languageTag = language === 'hi' ? 'hi-IN' : language === 'kn' ? 'kn-IN' : 'en-IN';
        const result = await SpeechRecognition.start({
          language: languageTag,
          maxResults: 1,
          partialResults: true,
          popup: false
        });
        const transcript = result.matches?.[0]?.trim();
        if (transcript) setLiveTranscript(transcript);
        else setVoiceError('No speech was detected. Please try again.');
        nativeSpeechActiveRef.current = false;
        removeNativeSpeechListener();
        setIsVoiceActive(false);
        return Boolean(transcript);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Android speech recognition failed. Please try again.';
        console.error('[Native Speech Recognition Error]:', err);
        nativeSpeechActiveRef.current = false;
        removeNativeSpeechListener();
        setIsNativeSpeech(false);
        setIsVoiceActive(false);
        setVoiceError(message);
        return false;
      }
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const unsupportedMsg = 'Microphone audio capture is not supported in this browser environment.';
      setVoiceError(unsupportedMsg);
      console.error('[Voice Capture Error]:', unsupportedMsg);
      return false;
    }

    stopCapture();
    setVoiceError(null);
    setLiveTranscript('');

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = audioStream;
      setStream(audioStream);
      setIsVoiceActive(true);

      // 1. Initialize Web Audio pipeline
      await setupAudioPipeline(audioStream);

      // 2. Connect to backend Gemini Live WebSocket transport
      await voiceTransport.connect({
        onStateChange: (state) => {
          setLiveState(state);
        },
        onText: (text) => {
          setLiveTranscript((prev) => prev + text);
        },
        onAudio: handlePlaybackAudio,
        onInterrupted: () => {
          stopPlayback();
          setLiveTranscript('');
        },
        onTurnComplete: () => {
          turnCompleteRef.current = true;
          if (playbackSourcesRef.current.size === 0) {
            setPlaybackState('idle');
          }
        },
        onError: (errMessage) => {
          setVoiceError(errMessage);
        }
      }, voiceContextRef.current);

      // Handle unexpected track ending
      audioStream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          stopCapture();
        };
      });

      return true;
    } catch (err: unknown) {
      let message = 'Failed to access microphone or connect to voice session.';

      if (err instanceof DOMException || (typeof err === 'object' && err !== null && 'name' in err)) {
        const errorName = (err as { name: string }).name;
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          message = 'Microphone permission denied. Please allow microphone access in your browser settings to speak.';
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          message = 'No microphone device found. Please connect a microphone and try again.';
        } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
          message = 'Microphone is already in use by another application or tab.';
        } else if (errorName === 'SecurityError') {
          message = 'Microphone access is blocked by browser security policy (HTTPS / localhost required).';
        }
      } else if (err instanceof Error) {
        message = err.message;
      }

      console.error('[Voice Capture / Live Transport Error]:', err);
      setVoiceError(message);
      stopCapture();
      return false;
    }
  }, [handlePlaybackAudio, setupAudioPipeline, stopCapture, stopPlayback]);

  const toggleVoiceCapture = useCallback(async () => {
    if (isVoiceActive) {
      stopCapture();
    } else {
      await startCapture();
    }
  }, [isVoiceActive, startCapture, stopCapture]);

  // Clean up all audio resources when component unmounts
  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    isVoiceActive,
    voiceError,
    startCapture,
    stopCapture,
    toggleVoiceCapture,
    clearVoiceError,
    stream,
    diagnostics,
    liveState,
    liveTranscript,
    isNativeSpeech,
    playbackState
  };
}
