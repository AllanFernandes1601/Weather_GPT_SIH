/**
 * Supported weather emergency alert types for SMS notifications.
 */
export type SmsAlertType =
  | 'heavy_rain'
  | 'flood'
  | 'thunderstorm'
  | 'strong_wind'
  | 'extreme_heat'
  | 'extreme_cold'
  | 'air_quality'
  | 'other';

/**
 * 4-tier alert severity scale.
 */
export type AlertSeverity = 'low' | 'moderate' | 'high' | 'severe';

/**
 * Supported notification languages.
 */
export type PreferredLanguage = 'en' | 'hi' | 'kn';

/**
 * Registered subscriber profile for location-aware SMS weather alerts.
 */
export interface SmsSubscription {
  id: string;
  phoneNumber: string;
  location: {
    name?: string;
    district?: string;
    state?: string;
    latitude: number;
    longitude: number;
    radiusKm: number;
  };
  alertTypes: SmsAlertType[];
  minSeverity: AlertSeverity;
  preferredLanguage: PreferredLanguage;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Evaluated meteorological weather alert.
 */
export interface WeatherAlert {
  id: string;
  alertType: SmsAlertType;
  severity: AlertSeverity;
  title: string;
  summary: string;
  smsText: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  affectedRadiusKm: number;
  startTime: string;
  endTime: string;
  source: string;
  detectedAt: string;
}

/**
 * Audit record of an SMS dispatch attempt.
 * Does NOT store the full phone number or message body.
 */
export interface SmsDeliveryRecord {
  id: string;
  subscriptionId: string;
  alertId: string;
  alertAreaKey: string;
  alertType: SmsAlertType;
  severity: AlertSeverity;
  phoneMasked: string;
  status: 'sent' | 'failed' | 'simulated';
  provider: string;
  providerMessageId?: string;
  errorMessage?: string;
  sentAt: string;
}

/**
 * Standard output returned by an SMS provider.
 */
export interface SmsSendResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
  timestamp: string;
}

/**
 * Payload passed to an SMS provider for dispatch.
 */
export interface SmsMessagePayload {
  to: string;
  body: string;
  alertType?: SmsAlertType;
  severity?: AlertSeverity;
  senderId?: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
  preferredLanguage?: PreferredLanguage;
}

/**
 * Validates whether a phone number string conforms to standard E.164 format.
 * E.164: Starts with '+', followed by 1-3 digit country code and subscriber number (total 7 to 15 digits).
 * Examples: +919876543210 (India), +14155552671 (US).
 */
export function isValidE164PhoneNumber(phone: string): boolean {
  if (typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  return /^\+[1-9]\d{6,14}$/.test(trimmed);
}

/**
 * Masks a phone number for safe logging and audit recording.
 * Preserves country calling code / initial prefix and the final 4 digits, replacing the middle with asterisks.
 * Example: "+919876541234" -> "+91******1234".
 * If the input does not meet the minimum length, it safely obscures all characters.
 */
export function maskPhoneNumber(phone: string): string {
  if (typeof phone !== 'string') return '******';
  const clean = phone.trim();
  if (clean.length < 8) {
    return '******';
  }

  // If number starts with +91 (India), preserve +91 prefix
  if (clean.startsWith('+91')) {
    const suffix = clean.slice(-4);
    return `+91******${suffix}`;
  }

  // Generic E.164: preserve leading '+' and up to 2-3 characters, and last 4 characters
  const prefix = clean.startsWith('+') ? clean.slice(0, 3) : clean.slice(0, 2);
  const suffix = clean.slice(-4);
  return `${prefix}******${suffix}`;
}
