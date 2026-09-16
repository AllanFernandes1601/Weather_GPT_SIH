/**
 * Voice WebSocket Transport Service for WeatherGPT.
 * - Handles client-side persistent WebSocket connection to /ws/live.
 * - Sends 16 kHz Mono 16-bit PCM binary chunks.
 * - Receives real-time Gemini Live events (transcription text, audio blobs, turns, interruptions).
 * - Manages connection lifecycle and safe cleanup.
 */

export type VoiceTransportState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'sending'
  | 'receiving'
  | 'error'
  | 'closed';

export interface VoiceServerMessage {
  type: 'status' | 'text' | 'audio' | 'turnComplete' | 'interrupted' | 'error';
  status?: 'connecting' | 'connected' | 'error' | 'closed';
  text?: string;
  data?: string; // Base64 audio chunk received from Gemini
  mimeType?: string;
  message?: string;
}

export interface VoiceSessionContext {
  locationName: string;
  stateName: string;
  coordinates: string;
  latitude?: number;
  longitude?: number;
  liveWeather: Record<string, unknown>;
  hourlyForecast: Array<Record<string, unknown>>;
  alert?: Record<string, unknown>;
}

export interface VoiceTransportCallbacks {
  onStateChange: (state: VoiceTransportState) => void;
  onText?: (text: string) => void;
  onAudio?: (data: string, mimeType: string) => void;
  onInterrupted?: () => void;
  onTurnComplete?: () => void;
  onError?: (error: string) => void;
}

export class VoiceTransport {
  private ws: WebSocket | null = null;
  private state: VoiceTransportState = 'idle';
  private callbacks: VoiceTransportCallbacks | null = null;

  public getState(): VoiceTransportState {
    return this.state;
  }

  private setState(newState: VoiceTransportState) {
    this.state = newState;
    if (this.callbacks?.onStateChange) {
      this.callbacks.onStateChange(newState);
    }
  }

  /**
   * Connects to the WeatherGPT backend live voice WebSocket endpoint (/ws/live).
   */
  public async connect(callbacks: VoiceTransportCallbacks, context?: VoiceSessionContext): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.callbacks = callbacks;
    this.setState('connecting');

    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
    const wsUrl = `${protocol}//${host}/ws/live`;

    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(wsUrl);
        socket.binaryType = 'arraybuffer';
        this.ws = socket;

        socket.onopen = () => {
          // Send context with the handshake so the server can establish the Live system instruction before audio processing.
          socket.send(JSON.stringify({ type: 'start', context }));
        };

        socket.onmessage = (event: MessageEvent) => {
          try {
            if (typeof event.data === 'string') {
              const msg: VoiceServerMessage = JSON.parse(event.data);

              if (msg.type === 'status') {
                if (msg.status === 'connected') {
                  this.setState('connected');
                  resolve();
                } else if (msg.status === 'error') {
                  this.setState('error');
                  this.callbacks?.onError?.(msg.message || 'Gemini Live session error');
                } else if (msg.status === 'closed') {
                  this.setState('closed');
                }
              } else if (msg.type === 'text' && msg.text) {
                this.callbacks?.onText?.(msg.text);
              } else if (msg.type === 'audio' && msg.data) {
                // Gemini Live currently returns 24 kHz mono 16-bit PCM audio.
                this.callbacks?.onAudio?.(msg.data, msg.mimeType || 'audio/pcm;rate=24000');
              } else if (msg.type === 'interrupted') {
                this.callbacks?.onInterrupted?.();
              } else if (msg.type === 'turnComplete') {
                this.callbacks?.onTurnComplete?.();
              } else if (msg.type === 'error') {
                this.setState('error');
                this.callbacks?.onError?.(msg.message || 'Server error occurred');
              }
            }
          } catch (parseError) {
            console.warn('[VoiceTransport] Failed to parse message:', parseError);
          }
        };

        socket.onerror = (err) => {
          console.error('[VoiceTransport] WebSocket error:', err);
          this.setState('error');
          this.callbacks?.onError?.('Failed to connect to WeatherGPT voice session.');
          reject(new Error('WebSocket connection failed'));
        };

        socket.onclose = () => {
          this.setState('closed');
          this.ws = null;
        };
      } catch (err) {
        this.setState('error');
        this.callbacks?.onError?.('Unable to establish WebSocket connection.');
        reject(err);
      }
    });
  }

  /**
   * Transmits raw 16 kHz Signed 16-bit PCM binary chunk over the WebSocket.
   */
  public sendAudioChunk(chunk: ArrayBuffer | ArrayBufferView): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(chunk);
      if (this.state === 'connected') {
        this.setState('sending');
      }
      return true;
    } catch (err) {
      console.warn('[VoiceTransport] Error sending audio chunk:', err);
      return false;
    }
  }

  /**
   * Disconnects the WebSocket session cleanly and notifies the backend.
   */
  public disconnect(): void {
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'stop' }));
          this.ws.close();
        } else if (this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      } catch (err) {
        console.warn('[VoiceTransport] Error closing socket:', err);
      }
      this.ws = null;
    }
    this.setState('idle');
  }
}

export const voiceTransport = new VoiceTransport();
