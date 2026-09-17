import { SmsSubscription, WeatherAlert } from './types';
import { isSeverityGte } from './alertThresholds';
import { getDistanceKm, isValidCoordinate } from './geoUtils';

/**
 * Diagnostic reason explaining a subscriber's eligibility or ineligibility.
 */
export type IneligibilityReason =
  | 'eligible'
  | 'inactive'
  | 'unverified'
  | 'alert_type_disabled'
  | 'below_minimum_severity'
  | 'outside_alert_area'
  | 'invalid_coordinates';

/**
 * Detailed eligibility evaluation result for a single subscriber.
 */
export interface SubscriptionMatchResult {
  subscription: SmsSubscription;
  eligible: boolean;
  reason: IneligibilityReason;
  distanceKm?: number;
}

/**
 * Configurable matching options.
 */
export interface SubscriberMatchOptions {
  /**
   * Whether subscription must have `isVerified === true` to be eligible.
   * Default: `true` for production safety; pass `false` during development/testing.
   */
  requireVerified?: boolean;
}

/**
 * Evaluates whether a single subscription record is eligible to receive a specific WeatherAlert.
 *
 * Rules:
 * 1. Subscriber location must have valid decimal coordinates.
 * 2. Subscription must be active (`isActive === true`).
 * 3. Subscription must be verified if `requireVerified === true`.
 * 4. Subscriber must have subscribed to the specific `alert.alertType`.
 * 5. Alert severity must meet or exceed subscriber's `minSeverity`.
 * 6. Subscriber location must fall within `alert.affectedRadiusKm` (Haversine distance <= affectedRadiusKm).
 *
 * Pure function: does not mutate inputs, performs no network requests, and emits no PII logs.
 */
export function evaluateSubscriptionEligibility(
  subscription: SmsSubscription,
  alert: WeatherAlert,
  options: SubscriberMatchOptions = {}
): SubscriptionMatchResult {
  const requireVerified = options.requireVerified ?? true;

  // 1. Coordinate validity check
  if (
    !subscription.location ||
    !isValidCoordinate(subscription.location.latitude, subscription.location.longitude)
  ) {
    return {
      subscription,
      eligible: false,
      reason: 'invalid_coordinates'
    };
  }

  // 2. Active status check
  if (!subscription.isActive) {
    return {
      subscription,
      eligible: false,
      reason: 'inactive'
    };
  }

  // 3. Phone verification check
  if (requireVerified && !subscription.isVerified) {
    return {
      subscription,
      eligible: false,
      reason: 'unverified'
    };
  }

  // 4. Alert type preference check
  if (!subscription.alertTypes.includes(alert.alertType)) {
    return {
      subscription,
      eligible: false,
      reason: 'alert_type_disabled'
    };
  }

  // 5. Minimum severity threshold check
  if (!isSeverityGte(alert.severity, subscription.minSeverity)) {
    return {
      subscription,
      eligible: false,
      reason: 'below_minimum_severity'
    };
  }

  // 6. Geographic proximity check
  const distanceKm = getDistanceKm(
    subscription.location.latitude,
    subscription.location.longitude,
    alert.coordinates.latitude,
    alert.coordinates.longitude
  );

  // MVP Rule: distance <= alert.affectedRadiusKm (Subscriber radiusKm is NOT added to alert radius)
  if (distanceKm > alert.affectedRadiusKm) {
    return {
      subscription,
      eligible: false,
      reason: 'outside_alert_area',
      distanceKm
    };
  }

  return {
    subscription,
    eligible: true,
    reason: 'eligible',
    distanceKm
  };
}

/**
 * Filters an array of subscribers to return only those eligible to receive the given WeatherAlert.
 *
 * @param subscriptions Array of subscriber records
 * @param alert Evaluated weather alert
 * @param options Matching options (e.g. { requireVerified: false } for development)
 * @returns Array of eligible SmsSubscription records (shallow-copied subset, unmodified)
 */
export function matchSubscribersToAlert(
  subscriptions: readonly SmsSubscription[],
  alert: WeatherAlert,
  options: SubscriberMatchOptions = {}
): SmsSubscription[] {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return [];
  }

  const eligibleList: SmsSubscription[] = [];

  for (const sub of subscriptions) {
    const evaluation = evaluateSubscriptionEligibility(sub, alert, options);
    if (evaluation.eligible) {
      eligibleList.push(sub);
    }
  }

  return eligibleList;
}
