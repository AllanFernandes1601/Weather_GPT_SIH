import { useState, useRef, useEffect, useCallback } from 'react';
import { resampleAudio, float32ToInt16PCM, calculateRMS } from '../utils/audioProcessing';
import { voiceTransport, VoiceTransportState } from '../services/voiceTransport';

export interface AudioDiagnostics {
  processingActive: boolean;
  inputSampleRate: number;
  outputSampleRate: number;
  chunkCount: number;
  byteCount: number;
  sampleCount: number;
  rmsLevel: number;
}

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
export function useVoiceCapture(): UseVoiceCaptureReturn {
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<AudioDiagnostics>(INITIAL_DIAGNOSTICS);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [liveState, setLiveState] = useState<VoiceTransportState>('idle');
  const [liveTranscript, setLiveTranscript] = useState<string>('');

  // References for Web Audio API node lifecycle
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<AudioNode | null>(null);

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

  /**
   * Complete teardown of all audio resources and backend transport.
   */
  const stopCapture = useCallback(() => {
    // 1. Disconnect WebSocket session to Gemini Live
    try {
      voiceTransport.disconnect();
    } catch (err) {
      console.warn('[VoiceTransport] Error disconnecting transport:', err);
    }
    setLiveState('idle');

    // 2. Disconnect and release audio processor node
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

    // 3. Disconnect MediaStream audio source
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (err) {
        console.warn('[Audio Pipeline] Error disconnecting source node:', err);
      }
      sourceNodeRef.current = null;
    }

    // 4. Close AudioContext
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

    // 5. Stop all MediaStream tracks
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

    // 6. Reset states
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
        silentGain.connect(audioContext.destination);

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
        onInterrupted: () => {
          setLiveTranscript('');
        },
        onTurnComplete: () => {
          // Turn completed
        },
        onError: (errMessage) => {
          setVoiceError(errMessage);
        }
      });

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
  }, [setupAudioPipeline, stopCapture]);

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
    liveTranscript
  };
}
