import { SmsSubscription, WeatherAlert } from './types';
import { ISmsSubscriptionStorage, ISmsDeliveryStorage } from './storage/storage.interface';
import { getSubscriptionStorage, getDeliveryStorage } from './storage';
import { SmsProvider } from './providers/smsProvider.interface';
import { getSmsProvider } from './providers';
import { evaluateWeatherAlerts, WeatherTelemetryInput } from './alertEngine';
import { processAlertDelivery, AlertDeliverySummary } from './deliveryPipeline';
import { fetchWeatherTelemetryForSms } from './weatherTelemetryService';
import { broadcastRealtimeWeatherAlert } from '../alerts/realtimeAlertHub';
import {
  evaluateRealtimeAlertDedup,
  recordRealtimeAlertBroadcast
} from '../alerts/realtimeAlertDedup';

export interface LocationCell {
  cellKey: string;
  latitude: number;
  longitude: number;
  locationName?: string;
  subscriptions: SmsSubscription[];
}

export interface SmsAlertCycleSummary {
  timestamp: string;
  skipped: boolean;
  skipReason?: string;
  activeSubscriptionsCount: number;
  locationCellsCount: number;
  failedCellsCount: number;
  alertsGenerated: number;
  totalSent: number;
  totalSuppressed: number;
  totalFailed: number;
  deliveries: AlertDeliverySummary[];
  realtimeAlertsEligible?: number;
  realtimeAlertsBroadcast?: number;
  realtimeAlertsSuppressed?: number;
}

export interface SmsCycleOptions {
  requireVerified?: boolean;
  cooldownHours?: number;
  subscriptionStorage?: ISmsSubscriptionStorage;
  deliveryStorage?: ISmsDeliveryStorage;
  smsProvider?: SmsProvider;
  weatherFetcher?: (latitude: number, longitude: number, locationName?: string) => Promise<WeatherTelemetryInput>;
}

/**
 * Deduplicates subscriber coordinates into deterministic coarse geographic check cells.
 * Uses 2 decimal places precision (~1.1 km) to avoid duplicate upstream Open-Meteo fetches
 * for co-located users.
 * Does not modify subscribers' actual stored coordinates.
 */
export function groupSubscriptionsByLocationCell(
  subscriptions: readonly SmsSubscription[]
): LocationCell[] {
  const cellMap = new Map<string, LocationCell>();

  for (const sub of subscriptions) {
    const lat = sub.location.latitude;
    const lon = sub.location.longitude;
    const roundedLat = Number(lat.toFixed(2));
    const roundedLon = Number(lon.toFixed(2));
    const cellKey = `${roundedLat.toFixed(2)},${roundedLon.toFixed(2)}`;

    let cell = cellMap.get(cellKey);
    if (!cell) {
      cell = {
        cellKey,
        latitude: roundedLat,
        longitude: roundedLon,
        locationName: sub.location.name,
        subscriptions: []
      };
      cellMap.set(cellKey, cell);
    }
    cell.subscriptions.push(sub);
  }

  return Array.from(cellMap.values());
}

/**
 * Validates and retrieves the scheduler check interval in minutes from environment.
 * Default: 15 minutes.
 */
export function getSchedulerIntervalMinutes(): number {
  const raw = process.env.SMS_CHECK_INTERVAL_MINUTES;
  if (!raw) return 15;
  const parsed = Number(raw);
  return !isNaN(parsed) && parsed > 0 ? parsed : 15;
}

let schedulerTimer: NodeJS.Timeout | null = null;
let cycleRunning = false;

/**
 * Checks whether the background scheduler timer is currently active.
 */
export function isSchedulerRunning(): boolean {
  return schedulerTimer !== null;
}

/**
 * Checks whether a scheduler cycle is currently executing (overlap guard status).
 */
export function isCycleRunningInProgress(): boolean {
  return cycleRunning;
}

/**
 * Executes a single complete SMS weather-alert cycle:
 * 1. Loads active subscriptions from storage.
 * 2. If 0 subscriptions, exits cleanly without making weather requests.
 * 3. Groups subscription locations into coarse check cells.
 * 4. Fetches weather telemetry once per cell.
 * 5. Calls evaluateWeatherAlerts(telemetry).
 * 6. Dispatches alerts to eligible subscribers via processAlertDelivery().
 * 7. Isolates errors so one cell or alert failure does not abort the rest of the cycle.
 * 8. Returns aggregated summary with zero exposed PII.
 */
export async function runSmsAlertCycle(
  options: SmsCycleOptions = {}
): Promise<SmsAlertCycleSummary> {
  // Overlap protection guard
  if (cycleRunning) {
    console.warn('[SMS Scheduler] A cycle is already executing. Skipping overlapping run.');
    return {
      timestamp: new Date().toISOString(),
      skipped: true,
      skipReason: 'cycle_already_in_progress',
      activeSubscriptionsCount: 0,
      locationCellsCount: 0,
      failedCellsCount: 0,
      alertsGenerated: 0,
      totalSent: 0,
      totalSuppressed: 0,
      totalFailed: 0,
      deliveries: [],
      realtimeAlertsEligible: 0,
      realtimeAlertsBroadcast: 0,
      realtimeAlertsSuppressed: 0
    };
  }

  cycleRunning = true;
  try {
    const subscriptionStorage = options.subscriptionStorage || getSubscriptionStorage();
    const deliveryStorage = options.deliveryStorage || getDeliveryStorage();
    const smsProvider = options.smsProvider || getSmsProvider();
    const weatherFetcher = options.weatherFetcher || fetchWeatherTelemetryForSms;
    const requireVerified = options.requireVerified !== undefined ? options.requireVerified : true;

    // 1. Load active subscriptions
    const activeSubscriptions = await subscriptionStorage.getAllActiveSubscriptions();

    const summary: SmsAlertCycleSummary = {
      timestamp: new Date().toISOString(),
      skipped: false,
      activeSubscriptionsCount: activeSubscriptions.length,
      locationCellsCount: 0,
      failedCellsCount: 0,
      alertsGenerated: 0,
      totalSent: 0,
      totalSuppressed: 0,
      totalFailed: 0,
      deliveries: [],
      realtimeAlertsEligible: 0,
      realtimeAlertsBroadcast: 0,
      realtimeAlertsSuppressed: 0
    };

    // 2. Return cleanly if no active subscribers
    if (activeSubscriptions.length === 0) {
      return summary;
    }

    // 3. Group locations into weather check cells
    const cells = groupSubscriptionsByLocationCell(activeSubscriptions);
    summary.locationCellsCount = cells.length;

    // 4. Fetch telemetry and evaluate alerts per cell
    for (const cell of cells) {
      let telemetry: WeatherTelemetryInput;
      try {
        telemetry = await weatherFetcher(cell.latitude, cell.longitude, cell.locationName);
      } catch (cellErr: any) {
        // Error isolation: log concise error without sensitive data, continue remaining cells
        console.error(
          `[SMS Scheduler] Error fetching telemetry for cell ${cell.cellKey}:`,
          cellErr?.message || cellErr
        );
        summary.failedCellsCount++;
        continue;
      }

      // 5. Evaluate meteorological alerts deterministically
      let alerts: WeatherAlert[] = [];
      try {
        alerts = evaluateWeatherAlerts(telemetry);
      } catch (evalErr: any) {
        console.error(
          `[SMS Scheduler] Error evaluating alerts for cell ${cell.cellKey}:`,
          evalErr?.message || evalErr
        );
        continue;
      }

      summary.alertsGenerated += alerts.length;

      // 6. Deliver each alert via delivery pipeline and broadcast to connected SSE clients
      for (const alert of alerts) {
        // Real-time browser alert evaluation (HIGH / SEVERE only, deduplicated, 60m cooldown)
        try {
          const dedupDecision = evaluateRealtimeAlertDedup(alert);
          if (dedupDecision.isEligible) {
            summary.realtimeAlertsEligible = (summary.realtimeAlertsEligible || 0) + 1;
            if (dedupDecision.shouldBroadcast) {
              recordRealtimeAlertBroadcast(alert, dedupDecision);
              broadcastRealtimeWeatherAlert(alert, cell.locationName);
              summary.realtimeAlertsBroadcast = (summary.realtimeAlertsBroadcast || 0) + 1;
            } else {
              summary.realtimeAlertsSuppressed = (summary.realtimeAlertsSuppressed || 0) + 1;
            }
          }
        } catch (realtimeErr) {
          console.warn('[Realtime Alert Hub] Broadcast evaluation notice:', realtimeErr);
        }

        try {
          const deliverySummary = await processAlertDelivery(
            alert,
            {
              subscriptionStorage,
              deliveryStorage,
              smsProvider,
              cooldownHours: options.cooldownHours,
              matchOptions: { requireVerified }
            },
            activeSubscriptions
          );

          summary.totalSent += deliverySummary.sentCount;
          summary.totalSuppressed += deliverySummary.suppressedCount;
          summary.totalFailed += deliverySummary.failedCount;
          summary.deliveries.push(deliverySummary);
        } catch (delErr: any) {
          // Error isolation: allow delivery errors to be logged without stopping other alerts
          console.error(`[SMS Scheduler] Failed processing alert ${alert.id}:`, delErr?.message || delErr);
        }
      }
    }

    return summary;
  } finally {
    cycleRunning = false;
  }
}

/**
 * Starts automatic periodic SMS weather-alert evaluation.
 * Respects SMS_SCHEDULER_ENABLED=false (default) to avoid running during development unless explicitly requested.
 */
export function startSmsAlertScheduler(): boolean {
  const isEnabled = process.env.SMS_SCHEDULER_ENABLED === 'true';
  if (!isEnabled) {
    console.log('[SMS Scheduler] Disabled via SMS_SCHEDULER_ENABLED=false (default).');
    return false;
  }

  if (schedulerTimer !== null) {
    console.warn('[SMS Scheduler] Scheduler is already active.');
    return true;
  }

  const intervalMinutes = getSchedulerIntervalMinutes();
  const intervalMs = intervalMinutes * 60 * 1000;
  const providerType = (process.env.SMS_PROVIDER || 'mock').toLowerCase();

  console.log(`[SMS Scheduler] Enabled: evaluating alerts every ${intervalMinutes} minute(s) using ${providerType} provider.`);

  // Run initial cycle asynchronously without blocking startup
  runSmsAlertCycle().catch((err) => {
    console.error('[SMS Scheduler Error] Initial alert cycle failure:', err?.message || err);
  });

  schedulerTimer = setInterval(() => {
    runSmsAlertCycle().catch((err) => {
      console.error('[SMS Scheduler Error] Periodic alert cycle failure:', err?.message || err);
    });
  }, intervalMs);

  return true;
}

/**
 * Stops the automatic periodic SMS weather-alert scheduler.
 */
export function stopSmsAlertScheduler(): void {
  if (schedulerTimer !== null) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[SMS Scheduler] Stopped successfully.');
  }
}
