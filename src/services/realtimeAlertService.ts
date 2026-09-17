import { RealtimeAlertItem } from '../context/AlertContext';

export type SseConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export type AlertListener = (alert: RealtimeAlertItem) => void;
export type StatusListener = (status: SseConnectionStatus) => void;

class RealtimeAlertService {
  private eventSource: EventSource | null = null;
  private alertListeners: Set<AlertListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private status: SseConnectionStatus = 'disconnected';
  private reconnectTimeout: number | null = null;
  private refCount = 0;
  private isConnecting = false;

  public getStatus(): SseConnectionStatus {
    return this.status;
  }

  private setStatus(newStatus: SseConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const listener of this.statusListeners) {
        try {
          listener(newStatus);
        } catch (err) {
          console.error('[RealtimeAlertService Status Listener Error]:', err);
        }
      }
    }
  }

  public subscribe(onAlert: AlertListener, onStatus?: StatusListener): () => void {
    this.alertListeners.add(onAlert);
    if (onStatus) {
      this.statusListeners.add(onStatus);
      onStatus(this.status);
    }

    this.refCount++;
    if (this.refCount === 1) {
      this.connect();
    }

    return () => {
      this.alertListeners.delete(onAlert);
      if (onStatus) {
        this.statusListeners.delete(onStatus);
      }
      this.refCount--;
      if (this.refCount <= 0) {
        this.refCount = 0;
        this.disconnect();
      }
    };
  }

  public connect(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    if (this.eventSource || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.setStatus('connecting');

    try {
      const sseUrl = '/api/alerts/stream';
      const es = new EventSource(sseUrl);
      this.eventSource = es;

      es.onopen = () => {
        this.isConnecting = false;
        this.setStatus('connected');
      };

      es.addEventListener('weather_alert', (event: MessageEvent) => {
        try {
          const raw = JSON.parse(event.data);
          if (!raw || typeof raw !== 'object' || !raw.id) {
            return;
          }

          // Ensure safe RealtimeAlertItem format
          const alertItem: RealtimeAlertItem = {
            id: String(raw.id),
            alertType: String(raw.alertType || 'other'),
            severity: String(raw.severity || 'moderate'),
            title: String(raw.title || 'Weather Alert'),
            message: String(raw.message || raw.summary || 'Severe weather detected.'),
            location: raw.location || 'Observed Station',
            startTime: raw.startTime ? String(raw.startTime) : undefined,
            endTime: raw.endTime ? String(raw.endTime) : undefined,
            source: raw.source ? String(raw.source) : 'Open-Meteo',
            detectedAt: raw.detectedAt ? String(raw.detectedAt) : new Date().toISOString(),
            read: false,
            mode: 'live'
          };

          for (const listener of this.alertListeners) {
            try {
              listener(alertItem);
            } catch (err) {
              console.error('[RealtimeAlertService Alert Listener Error]:', err);
            }
          }
        } catch (err) {
          console.warn('[RealtimeAlertService Parse Error]:', err);
        }
      });

      es.onerror = () => {
        this.isConnecting = false;
        // When EventSource fails, it automatically attempts reconnection.
        // We set status to connecting/disconnected so UI reflects real state.
        if (es.readyState === EventSource.CLOSED) {
          this.setStatus('disconnected');
          this.cleanupEventSource();
          // Schedule manual reconnect fallback
          this.scheduleReconnect();
        } else {
          this.setStatus('connecting');
        }
      };
    } catch (err) {
      console.error('[RealtimeAlertService Init Error]:', err);
      this.isConnecting = false;
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private cleanupEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout !== null) return;
    if (this.refCount <= 0) return;

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.refCount > 0) {
        this.connect();
      }
    }, 5000);
  }

  public disconnect(): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.cleanupEventSource();
    this.isConnecting = false;
    this.setStatus('disconnected');
  }
}

export const realtimeAlertService = new RealtimeAlertService();
