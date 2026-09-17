import { Request, Response, Router } from 'express';
import { randomUUID } from 'crypto';
import { WeatherAlert } from '../sms/types';

/**
 * Standard frontend event payload for real-time browser alerts.
 * Strictly free of PII (no phone numbers, subscriber IDs, or credentials).
 */
export interface RealtimeWeatherAlertEvent {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  location: {
    name?: string;
    latitude: number;
    longitude: number;
  } | string;
  startTime: string;
  endTime: string;
  source: string;
  detectedAt: string;
}

export interface RealtimeClient {
  id: string;
  res: Response;
  connectedAt: Date;
}

/**
 * In-memory registry of connected SSE browser clients.
 */
const clients = new Map<string, RealtimeClient>();

/**
 * Heartbeat interval timer reference.
 */
let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Registers a new SSE client connection and provides a cleanup function.
 */
export function registerClient(req: Request, res: Response): { clientId: string; cleanup: () => void } {
  const clientId = `client_${randomUUID()}`;
  const client: RealtimeClient = {
    id: clientId,
    res,
    connectedAt: new Date()
  };

  clients.set(clientId, client);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    clients.delete(clientId);
  };

  ensureHeartbeatActive();

  return { clientId, cleanup };
}

/**
 * Removes an existing connected client by ID.
 */
export function removeClient(clientId: string): boolean {
  return clients.delete(clientId);
}

/**
 * Returns the current number of active connected clients.
 */
export function getConnectedClientsCount(): number {
  return clients.size;
}

/**
 * Clears all connected clients (used during shutdown or tests).
 */
export function clearAllClients(): void {
  clients.clear();
  stopHeartbeat();
}

/**
 * Ensures the keepalive heartbeat is running when clients are connected.
 */
function ensureHeartbeatActive(): void {
  if (heartbeatInterval) return;

  heartbeatInterval = setInterval(() => {
    if (clients.size === 0) {
      stopHeartbeat();
      return;
    }

    const deadClientIds: string[] = [];
    for (const [id, client] of clients.entries()) {
      try {
        client.res.write(': heartbeat\n\n');
      } catch {
        deadClientIds.push(id);
      }
    }

    for (const deadId of deadClientIds) {
      clients.delete(deadId);
    }
  }, 25000);

  if (typeof heartbeatInterval.unref === 'function') {
    heartbeatInterval.unref();
  }
}

/**
 * Stops the keepalive heartbeat timer.
 */
export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Converts a backend WeatherAlert entity into a frontend RealtimeWeatherAlertEvent.
 */
export function convertWeatherAlertToRealtimeEvent(
  alert: WeatherAlert,
  locationName?: string
): RealtimeWeatherAlertEvent {
  const locationObj = alert.coordinates
    ? {
        name: locationName || 'Observed Station',
        latitude: alert.coordinates.latitude,
        longitude: alert.coordinates.longitude
      }
    : locationName || 'Observed Station';

  return {
    id: alert.id || `alert_${randomUUID()}`,
    alertType: alert.alertType || 'other',
    severity: alert.severity || 'moderate',
    title: alert.title || 'Weather Alert',
    message: alert.summary || alert.smsText || alert.title || 'Hazardous weather detected.',
    location: locationObj,
    startTime: alert.startTime || new Date().toISOString(),
    endTime: alert.endTime || new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    source: alert.source || 'Open-Meteo',
    detectedAt: alert.detectedAt || new Date().toISOString()
  };
}

/**
 * Forbidden keys that must NEVER leak into the SSE payload.
 */
const FORBIDDEN_PII_KEYS = new Set([
  'phonenumber',
  'phone',
  'phonemasked',
  'subscriberid',
  'subscriptionid',
  'msg91',
  'authkey',
  'flowid',
  'apikey',
  'credentials',
  'password',
  'token',
  'secret'
]);

/**
 * Redacts any accidental phone numbers matching E.164 or 10-digit Indian numbers from text strings.
 */
function redactPhonePatterns(text: string): string {
  // Matches +91... or 10-digit numbers
  return text.replace(/(\+?91[\s-]?)?[6-9]\d{9}/g, '[REDACTED]');
}

/**
 * Strictly sanitizes and validates an alert event payload before transmission.
 * Returns null if the input is malformed or invalid.
 */
export function sanitizeRealtimeAlert(input: unknown): RealtimeWeatherAlertEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const raw = input as Record<string, any>;

  // Check top-level keys for any forbidden PII keys
  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_PII_KEYS.has(key.toLowerCase())) {
      // Discard forbidden key
      delete raw[key];
    }
  }

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `alert_${randomUUID()}`;
  const alertType = typeof raw.alertType === 'string' && raw.alertType.trim() ? raw.alertType.trim() : 'other';
  const severity = typeof raw.severity === 'string' && raw.severity.trim() ? raw.severity.trim() : 'moderate';
  const rawTitle = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Weather Alert';
  const rawMessage = typeof raw.message === 'string' && raw.message.trim() ? raw.message.trim() : rawTitle;

  const title = redactPhonePatterns(rawTitle);
  const message = redactPhonePatterns(rawMessage);

  let location: RealtimeWeatherAlertEvent['location'] = 'Unknown Location';
  if (raw.location && typeof raw.location === 'object' && !Array.isArray(raw.location)) {
    const lat = Number(raw.location.latitude);
    const lon = Number(raw.location.longitude);
    if (!isNaN(lat) && !isNaN(lon)) {
      location = {
        name: typeof raw.location.name === 'string' ? redactPhonePatterns(raw.location.name) : undefined,
        latitude: lat,
        longitude: lon
      };
    }
  } else if (typeof raw.location === 'string' && raw.location.trim()) {
    location = redactPhonePatterns(raw.location.trim());
  }

  const startTime = typeof raw.startTime === 'string' && raw.startTime.trim() ? raw.startTime.trim() : new Date().toISOString();
  const endTime = typeof raw.endTime === 'string' && raw.endTime.trim() ? raw.endTime.trim() : new Date(Date.now() + 4 * 3600 * 1000).toISOString();
  const source = typeof raw.source === 'string' && raw.source.trim() ? raw.source.trim() : 'Open-Meteo';
  const detectedAt = typeof raw.detectedAt === 'string' && raw.detectedAt.trim() ? raw.detectedAt.trim() : new Date().toISOString();

  return {
    id,
    alertType,
    severity,
    title,
    message,
    location,
    startTime,
    endTime,
    source,
    detectedAt
  };
}

/**
 * Broadcasts an alert event to all connected SSE browser clients.
 * Accepts either a backend WeatherAlert or a pre-shaped RealtimeWeatherAlertEvent.
 */
export function broadcastRealtimeWeatherAlert(
  alertOrEvent: WeatherAlert | RealtimeWeatherAlertEvent | Record<string, any>,
  locationName?: string
): { success: boolean; recipientCount: number; event?: RealtimeWeatherAlertEvent; error?: string } {
  if (!alertOrEvent || typeof alertOrEvent !== 'object') {
    return { success: false, recipientCount: 0, error: 'Alert payload must be a non-null object' };
  }

  // If input has coordinates or summary, it conforms to WeatherAlert
  let eventToSanitize: unknown = alertOrEvent;
  if ('coordinates' in alertOrEvent || 'summary' in alertOrEvent || 'smsText' in alertOrEvent) {
    eventToSanitize = convertWeatherAlertToRealtimeEvent(alertOrEvent as WeatherAlert, locationName);
  }

  const safeEvent = sanitizeRealtimeAlert(eventToSanitize);
  if (!safeEvent) {
    return { success: false, recipientCount: 0, error: 'Malformed or invalid alert event' };
  }

  if (clients.size === 0) {
    return { success: true, recipientCount: 0, event: safeEvent };
  }

  const messageChunk = `event: weather_alert\ndata: ${JSON.stringify(safeEvent)}\n\n`;
  let sentCount = 0;
  const deadClientIds: string[] = [];

  for (const [id, client] of clients.entries()) {
    try {
      client.res.write(messageChunk);
      sentCount++;
    } catch {
      deadClientIds.push(id);
    }
  }

  for (const deadId of deadClientIds) {
    clients.delete(deadId);
  }

  return {
    success: true,
    recipientCount: sentCount,
    event: safeEvent
  };
}

/**
 * Route handler for GET /api/alerts/stream (Server-Sent Events)
 */
export function handleAlertsStream(req: Request, res: Response): void {
  // Set required SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const { clientId, cleanup } = registerClient(req, res);

  // Send initial handshake
  res.write(`: connected clientId=${clientId}\n\n`);

  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('close', cleanup);
  res.on('finish', cleanup);
}

/**
 * Express router exposing the real-time alert SSE stream.
 */
export const alertsRouter = Router();

// GET /api/alerts/stream
alertsRouter.get('/stream', handleAlertsStream);

// GET /api/alerts/status (Optional operational health check)
alertsRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    status: 'active',
    transport: 'sse',
    connectedClients: getConnectedClientsCount(),
    timestamp: new Date().toISOString()
  });
});
