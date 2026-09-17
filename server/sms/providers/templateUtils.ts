import { WeatherAlert, SmsSubscription, SmsAlertType } from '../types';

/**
 * Human-friendly labels for each alert type suitable for SMS template variables.
 */
const ALERT_TYPE_LABELS: Record<SmsAlertType, string> = {
  heavy_rain: 'Heavy Rain',
  flood: 'Flood Risk',
  thunderstorm: 'Thunderstorm',
  strong_wind: 'Strong Wind',
  extreme_heat: 'Extreme Heat',
  extreme_cold: 'Extreme Cold',
  air_quality: 'Air Quality Hazard',
  other: 'Weather Warning'
};

/**
 * Deterministically constructs template variables from a WeatherAlert and target SmsSubscription.
 * Generic across provider template implementations (MSG91 Flow, DLT, etc.).
 *
 * Supported default keys:
 * - severity: Upper-cased severity string (e.g., "HIGH", "SEVERE")
 * - alert_type: Formatted type label (e.g., "Heavy Rain", "Thunderstorm")
 * - location: Location name from subscriber profile or alert
 * - timing: Active warning time window
 * - details: Short summary or instructions
 * - sms_text: Full deterministic SMS text (fallback)
 */
export function createWeatherAlertTemplateVariables(
  alert: WeatherAlert,
  subscription?: SmsSubscription
): Record<string, string> {
  const locationName = subscription?.location?.name || 'Your Area';
  const typeLabel = ALERT_TYPE_LABELS[alert.alertType] || 'Weather Advisory';

  // Format short timing string from startTime/endTime ISO timestamps
  let timing = 'Immediate';
  if (alert.startTime && alert.endTime) {
    try {
      const start = new Date(alert.startTime).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
      });
      const end = new Date(alert.endTime).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
      });
      timing = `${start}–${end} IST`;
    } catch {
      timing = 'Next 3-6 hours';
    }
  }

  return {
    severity: alert.severity.toUpperCase(),
    alert_type: typeLabel,
    location: locationName,
    timing,
    details: alert.summary || alert.title,
    sms_text: alert.smsText
  };
}

/**
 * Keys that must never be treated as customizable template variables.
 * 'mobiles' is reserved for outbound phone numbers.
 * Prototype pollution keys are strictly blocked.
 */
const FORBIDDEN_KEYS = new Set(['mobiles', '__proto__', 'constructor', 'prototype']);
const VALID_VAR_NAME_REGEX = /^[a-zA-Z0-9_]+$/;

/**
 * Safely parses and validates a comma-separated list (or array) of template variable names.
 *
 * Requirements:
 * - Trims whitespace around names
 * - Removes empty values
 * - Deduplicates names while preserving order
 * - Allows only safe variable-name syntax: alphanumeric characters and underscores [a-zA-Z0-9_]
 * - Rejects or safely ignores malformed names
 * - Never allows "mobiles" to be treated or overridden as a template variable
 * - Blocks prototype-pollution keys (__proto__, constructor, prototype)
 *
 * DLT / Regulatory Context:
 * Variable names must exactly match the placeholder keys created in the MSG91 Flow
 * corresponding to the approved TRAI DLT template.
 */
export function parseConfiguredTemplateVariables(raw?: string | string[]): string[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : raw.split(',');
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (typeof item !== 'string') continue;
    const clean = item.trim();
    if (!clean) continue;
    if (FORBIDDEN_KEYS.has(clean.toLowerCase())) continue;
    if (!VALID_VAR_NAME_REGEX.test(clean)) continue;
    if (!seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }

  return result;
}

