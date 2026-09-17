import { SmsSubscription, WeatherAlert, SmsDeliveryRecord, AlertSeverity } from './types';
import { SEVERITY_RANK } from './alertThresholds';

export type DuplicateDecisionReason =
  | 'send'
  | 'exact_duplicate'
  | 'cooldown'
  | 'severity_escalation';

export interface DuplicateCheckResult {
  shouldSend: boolean;
  reason: DuplicateDecisionReason;
  alertAreaKey: string;
  matchedDeliveryId?: string;
  previousSeverity?: AlertSeverity;
}

/**
 * Default cooldown duration in hours for identical alert types to the same subscriber.
 */
export const DEFAULT_COOLDOWN_HOURS = 6;

/**
 * Derives a deterministic, coarse geographic alert-area key from alert coordinates.
 * Rounds latitude and longitude to 1 decimal place.
 * Example: 12.9716, 77.5946 -> "13.0,77.6".
 * This represents the weather alert area, not the subscriber's location.
 */
export function createAlertAreaKey(latitude: number, longitude: number): string {
  const latRounded = (Math.round(latitude * 10) / 10).toFixed(1);
  const lonRounded = (Math.round(longitude * 10) / 10).toFixed(1);
  const cleanLat = latRounded === '-0.0' ? '0.0' : latRounded;
  const cleanLon = lonRounded === '-0.0' ? '0.0' : lonRounded;
  return `${cleanLat},${cleanLon}`;
}

/**
 * Resolves effective cooldown hours from optional parameter or environment variable.
 */
export function getEffectiveCooldownHours(customHours?: number): number {
  if (customHours !== undefined && customHours > 0) {
    return customHours;
  }
  const envVal = Number(process.env.SMS_COOLDOWN_HOURS);
  return !isNaN(envVal) && envVal > 0 ? envVal : DEFAULT_COOLDOWN_HOURS;
}

/**
 * Deterministic evaluation of duplicate suppression and cooldown rules for a subscriber + alert pair.
 *
 * Rules:
 * 1. Exact Duplicate: If an SMS for the exact same alert ID was already successfully
 *    sent or simulated to this subscriber, suppress it ('exact_duplicate') regardless of cooldown window.
 *    NOTE: Failed sends are NEVER treated as duplicates.
 * 2. Cooldown & Severity Escalation:
 *    Matches on subscriberId + alertType + alertAreaKey within the cooldown window:
 *    a. If current alert severity is strictly HIGHER than the highest sent severity in the window:
 *       allow sending ('severity_escalation').
 *    b. If current alert severity is equal or lower:
 *       suppress ('cooldown').
 * 3. Alerts of the same type for a DIFFERENT alertAreaKey are evaluated independently.
 * 4. Otherwise: allow sending ('send').
 */
export function evaluateDuplicateProtection(
  subscription: SmsSubscription,
  alert: WeatherAlert,
  recentDeliveries: readonly SmsDeliveryRecord[],
  cooldownHours: number = getEffectiveCooldownHours(),
  customAlertAreaKey?: string
): DuplicateCheckResult {
  const alertLat = alert.coordinates?.latitude ?? (alert as any).latitude ?? 0;
  const alertLon = alert.coordinates?.longitude ?? (alert as any).longitude ?? 0;
  const alertAreaKey = customAlertAreaKey || createAlertAreaKey(alertLat, alertLon);
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const nowMs = Date.now();

  // Filter deliveries belonging strictly to this subscriber that succeeded (sent or simulated)
  const subscriberDeliveries = recentDeliveries.filter(
    (d) =>
      d.subscriptionId === subscription.id &&
      (d.status === 'sent' || d.status === 'simulated')
  );

  // 1. Exact alertId duplicate check (regardless of area or cooldown)
  const exactDuplicate = subscriberDeliveries.find((d) => d.alertId === alert.id);
  if (exactDuplicate) {
    return {
      shouldSend: false,
      reason: 'exact_duplicate',
      alertAreaKey,
      matchedDeliveryId: exactDuplicate.id,
      previousSeverity: exactDuplicate.severity
    };
  }

  // 2. Cooldown check for the same alert type AND same alertAreaKey within the time window
  const sameTypeAndAreaInCooldown = subscriberDeliveries.filter((d) => {
    if (d.alertType !== alert.alertType) return false;
    if (d.alertAreaKey !== alertAreaKey) return false;
    const sentTime = new Date(d.sentAt).getTime();
    return !isNaN(sentTime) && nowMs - sentTime < cooldownMs;
  });

  if (sameTypeAndAreaInCooldown.length === 0) {
    return {
      shouldSend: true,
      reason: 'send',
      alertAreaKey
    };
  }

  // Find the highest severity sent for this alert type + area within the cooldown window
  let highestSentSeverity: AlertSeverity = sameTypeAndAreaInCooldown[0].severity;
  for (const d of sameTypeAndAreaInCooldown) {
    if (SEVERITY_RANK[d.severity] > SEVERITY_RANK[highestSentSeverity]) {
      highestSentSeverity = d.severity;
    }
  }

  // Check for severity escalation
  if (SEVERITY_RANK[alert.severity] > SEVERITY_RANK[highestSentSeverity]) {
    return {
      shouldSend: true,
      reason: 'severity_escalation',
      alertAreaKey,
      previousSeverity: highestSentSeverity
    };
  }

  // Severity is equal or lower -> suppress during cooldown
  return {
    shouldSend: false,
    reason: 'cooldown',
    alertAreaKey,
    previousSeverity: highestSentSeverity
  };
}
