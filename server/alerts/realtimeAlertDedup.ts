import { WeatherAlert, AlertSeverity, SmsAlertType } from '../sms/types';
import { SEVERITY_RANK } from '../sms/alertThresholds';
import { createAlertAreaKey } from '../sms/duplicateProtection';

/**
 * Cooldown duration in milliseconds (60 minutes) for identical browser weather alerts.
 */
export const BROWSER_ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Severities eligible for live real-time browser alerts.
 * Low and Moderate alerts are strictly excluded.
 */
export const ELIGIBLE_REALTIME_SEVERITIES: ReadonlySet<AlertSeverity> = new Set<AlertSeverity>([
  'high',
  'severe'
]);

export type RealtimeDedupReason =
  | 'new_alert'
  | 'severity_escalation'
  | 'reminder'
  | 'cooldown'
  | 'different_alert_id'
  | 'severity_ineligible';

export interface BrowserAlertDedupRecord {
  dedupKey: string;
  alertId: string;
  alertType: SmsAlertType;
  alertAreaKey: string;
  lastSeverity: AlertSeverity;
  firstNotifiedAt: number;
  lastNotifiedAt: number;
  notificationCount: number;
}

export interface RealtimeDedupDecision {
  isEligible: boolean;
  shouldBroadcast: boolean;
  reason: RealtimeDedupReason;
  alertAreaKey: string;
  dedupKey: string;
  previousSeverity?: AlertSeverity;
  lastNotifiedAt?: number;
  elapsedMs?: number;
}

/**
 * In-memory state tracking active browser alert dedup records by `${alertAreaKey}:${alertType}`.
 * Strictly independent from SMS subscription and delivery records.
 */
const dedupState = new Map<string, BrowserAlertDedupRecord>();

/**
 * Generates a stable dedup key for an alert type and geographic area.
 */
export function createBrowserDedupKey(alertAreaKey: string, alertType: string): string {
  return `${alertAreaKey}:${alertType}`;
}

/**
 * Returns true if the severity meets the threshold for browser alerts (HIGH or SEVERE).
 */
export function isRealtimeAlertEligible(severity: string): boolean {
  return ELIGIBLE_REALTIME_SEVERITIES.has(severity as AlertSeverity);
}

/**
 * Clears the in-memory browser alert deduplication state.
 * Useful for testing and server resets.
 */
export function clearRealtimeAlertDedupState(): void {
  dedupState.clear();
}

/**
 * Returns the current count of deduplication records tracked in memory.
 */
export function getRealtimeAlertDedupCount(): number {
  return dedupState.size;
}

/**
 * Retrieves a dedup record by area key and alert type.
 */
export function getRealtimeAlertDedupRecord(
  alertAreaKey: string,
  alertType: string
): BrowserAlertDedupRecord | undefined {
  const key = createBrowserDedupKey(alertAreaKey, alertType);
  return dedupState.get(key);
}

/**
 * Evaluates duplicate suppression, 60-minute reminder cooldown, and immediate severity escalation
 * for a live WeatherAlert destined for browser notification clients.
 *
 * Rules:
 * 1. Severity Filter: Only HIGH or SEVERE alerts may broadcast. Moderate and Low are suppressed ('severity_ineligible').
 * 2. New Alert: If no prior notification exists for (alertAreaKey, alertType) -> broadcast ('new_alert').
 * 3. Severity Escalation: If current severity is strictly higher than last notified (e.g. HIGH -> SEVERE) ->
 *    broadcast immediately ('severity_escalation'), bypassing any cooldown.
 * 4. Different Deterministic Alert ID: If current alertId !== record.alertId and current severity is not lower
 *    than previous severity -> broadcast ('different_alert_id').
 * 5. 60-Minute Reminder: If the same alert remains active for >= 60 minutes since last notification ->
 *    broadcast one reminder ('reminder').
 * 6. Cooldown Suppression: If same alert or equal/lower severity within 60 minutes -> suppress ('cooldown').
 */
export function evaluateRealtimeAlertDedup(
  alert: WeatherAlert,
  customAlertAreaKey?: string,
  nowMs: number = Date.now()
): RealtimeDedupDecision {
  const lat = alert.coordinates?.latitude ?? 0;
  const lon = alert.coordinates?.longitude ?? 0;
  const alertAreaKey = customAlertAreaKey || createAlertAreaKey(lat, lon);
  const dedupKey = createBrowserDedupKey(alertAreaKey, alert.alertType);

  // 1. Severity check: strictly HIGH and SEVERE
  if (!isRealtimeAlertEligible(alert.severity)) {
    return {
      isEligible: false,
      shouldBroadcast: false,
      reason: 'severity_ineligible',
      alertAreaKey,
      dedupKey
    };
  }

  const existing = dedupState.get(dedupKey);

  // 2. New alert: no previous broadcast for this area & type
  if (!existing) {
    return {
      isEligible: true,
      shouldBroadcast: true,
      reason: 'new_alert',
      alertAreaKey,
      dedupKey
    };
  }

  const prevSeverity = existing.lastSeverity;
  const currentRank = SEVERITY_RANK[alert.severity] ?? 0;
  const prevRank = SEVERITY_RANK[prevSeverity] ?? 0;
  const elapsedMs = nowMs - existing.lastNotifiedAt;

  // 3. Escalation check: higher severity always broadcasts immediately
  if (currentRank > prevRank) {
    return {
      isEligible: true,
      shouldBroadcast: true,
      reason: 'severity_escalation',
      alertAreaKey,
      dedupKey,
      previousSeverity: prevSeverity,
      lastNotifiedAt: existing.lastNotifiedAt,
      elapsedMs
    };
  }

  // A lower severity (e.g. dropped from SEVERE to HIGH) does NOT bypass cooldown
  if (currentRank < prevRank) {
    if (elapsedMs < BROWSER_ALERT_COOLDOWN_MS) {
      return {
        isEligible: true,
        shouldBroadcast: false,
        reason: 'cooldown',
        alertAreaKey,
        dedupKey,
        previousSeverity: prevSeverity,
        lastNotifiedAt: existing.lastNotifiedAt,
        elapsedMs
      };
    }
  }

  // 4. Different deterministic alert ID (different storm window or event)
  if (alert.id !== existing.alertId && currentRank >= prevRank) {
    return {
      isEligible: true,
      shouldBroadcast: true,
      reason: 'different_alert_id',
      alertAreaKey,
      dedupKey,
      previousSeverity: prevSeverity,
      lastNotifiedAt: existing.lastNotifiedAt,
      elapsedMs
    };
  }

  // 5. 60-Minute Reminder
  if (elapsedMs >= BROWSER_ALERT_COOLDOWN_MS) {
    return {
      isEligible: true,
      shouldBroadcast: true,
      reason: 'reminder',
      alertAreaKey,
      dedupKey,
      previousSeverity: prevSeverity,
      lastNotifiedAt: existing.lastNotifiedAt,
      elapsedMs
    };
  }

  // 6. Cooldown suppression
  return {
    isEligible: true,
    shouldBroadcast: false,
    reason: 'cooldown',
    alertAreaKey,
    dedupKey,
    previousSeverity: prevSeverity,
    lastNotifiedAt: existing.lastNotifiedAt,
    elapsedMs
  };
}

/**
 * Records a successful broadcast in the browser dedup memory state, updating timestamps and counts.
 */
export function recordRealtimeAlertBroadcast(
  alert: WeatherAlert,
  decision: RealtimeDedupDecision,
  nowMs: number = Date.now()
): void {
  const existing = dedupState.get(decision.dedupKey);

  if (existing) {
    existing.alertId = alert.id;
    existing.lastSeverity = alert.severity;
    existing.lastNotifiedAt = nowMs;
    existing.notificationCount += 1;
  } else {
    dedupState.set(decision.dedupKey, {
      dedupKey: decision.dedupKey,
      alertId: alert.id,
      alertType: alert.alertType,
      alertAreaKey: decision.alertAreaKey,
      lastSeverity: alert.severity,
      firstNotifiedAt: nowMs,
      lastNotifiedAt: nowMs,
      notificationCount: 1
    });
  }
}
