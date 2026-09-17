import { randomUUID } from 'crypto';
import { SmsSubscription, WeatherAlert, SmsDeliveryRecord, maskPhoneNumber } from './types';
import { SmsProvider } from './providers/smsProvider.interface';
import { getSmsProvider, createWeatherAlertTemplateVariables } from './providers';
import { ISmsSubscriptionStorage, ISmsDeliveryStorage } from './storage/storage.interface';
import { getSubscriptionStorage, getDeliveryStorage } from './storage';
import { evaluateSubscriptionEligibility, SubscriberMatchOptions } from './subscriberMatcher';
import {
  evaluateDuplicateProtection,
  getEffectiveCooldownHours,
  createAlertAreaKey
} from './duplicateProtection';

export interface DeliveryPipelineDependencies {
  subscriptionStorage?: ISmsSubscriptionStorage;
  deliveryStorage?: ISmsDeliveryStorage;
  smsProvider?: SmsProvider;
  cooldownHours?: number;
  matchOptions?: SubscriberMatchOptions;
}

export interface SubscriberDeliveryResult {
  subscriptionId: string;
  phoneMasked: string;
  decision: 'sent' | 'suppressed' | 'failed' | 'ineligible';
  reason: string;
  messageId?: string;
  error?: string;
}

export interface AlertDeliverySummary {
  alertId: string;
  alertAreaKey: string;
  totalSubscribersEvaluated: number;
  eligibleCount: number;
  sentCount: number;
  suppressedCount: number;
  failedCount: number;
  ineligibleCount: number;
  results: SubscriberDeliveryResult[];
}

/**
 * Executes the complete alert-to-SMS delivery pipeline.
 *
 * Pipeline steps:
 * 1. Derives coarse geographic alertAreaKey from alert center coordinates.
 * 2. Obtains active subscribers from storage or provided array.
 * 3. Evaluates geographic, severity, alertType, and verification eligibility.
 * 4. Evaluates duplicate and cooldown rules against delivery audit records using alertAreaKey.
 * 5. Dispatches SMS through SmsProvider for approved recipients.
 * 6. Persists SmsDeliveryRecord (including alertAreaKey, strictly storing phoneMasked, never full phone number).
 * 7. Returns a structured diagnostic summary with zero exposed PII.
 */
export async function processAlertDelivery(
  alert: WeatherAlert,
  dependencies: DeliveryPipelineDependencies = {},
  subscriptionsToProcess?: SmsSubscription[]
): Promise<AlertDeliverySummary> {
  const subscriptionStorage = dependencies.subscriptionStorage || getSubscriptionStorage();
  const deliveryStorage = dependencies.deliveryStorage || getDeliveryStorage();
  const smsProvider = dependencies.smsProvider || getSmsProvider();
  const cooldownHours = getEffectiveCooldownHours(dependencies.cooldownHours);
  const matchOptions = dependencies.matchOptions || {};

  const alertAreaKey = createAlertAreaKey(alert.coordinates.latitude, alert.coordinates.longitude);

  // 1. Obtain active subscriptions
  const candidates = subscriptionsToProcess || (await subscriptionStorage.getAllActiveSubscriptions());

  const summary: AlertDeliverySummary = {
    alertId: alert.id,
    alertAreaKey,
    totalSubscribersEvaluated: candidates.length,
    eligibleCount: 0,
    sentCount: 0,
    suppressedCount: 0,
    failedCount: 0,
    ineligibleCount: 0,
    results: []
  };

  for (const sub of candidates) {
    const phoneMasked = maskPhoneNumber(sub.phoneNumber);

    // 2. Geographic and preference eligibility
    const eligibility = evaluateSubscriptionEligibility(sub, alert, matchOptions);
    if (!eligibility.eligible) {
      summary.ineligibleCount++;
      summary.results.push({
        subscriptionId: sub.id,
        phoneMasked,
        decision: 'ineligible',
        reason: eligibility.reason
      });
      continue;
    }

    summary.eligibleCount++;

    // 3. Duplicate and cooldown evaluation (exact alertId checked across history; cooldown checked per alertAreaKey)
    const recentDeliveries = await deliveryStorage.getRecentDeliveriesForSubscription(sub.id);

    const dupCheck = evaluateDuplicateProtection(sub, alert, recentDeliveries, cooldownHours, alertAreaKey);
    if (!dupCheck.shouldSend) {
      summary.suppressedCount++;
      summary.results.push({
        subscriptionId: sub.id,
        phoneMasked,
        decision: 'suppressed',
        reason: dupCheck.reason
      });
      continue;
    }

    // 4. SMS Dispatch via SmsProvider (full number passed ONLY to provider interface)
    const templateVariables = createWeatherAlertTemplateVariables(alert, sub);
    let sendResult;
    try {
      sendResult = await smsProvider.sendSms({
        to: sub.phoneNumber,
        body: alert.smsText,
        alertType: alert.alertType,
        severity: alert.severity,
        templateVariables,
        preferredLanguage: sub.preferredLanguage
      });
    } catch (err: any) {
      sendResult = {
        success: false,
        provider: smsProvider.providerName,
        error: err?.message || 'Unexpected provider dispatch error',
        timestamp: new Date().toISOString()
      };
    }

    // 5. Persist delivery record (strictly phoneMasked, never full phone number, with alertAreaKey)
    const isSuccess = sendResult.success;
    const recordStatus = isSuccess
      ? smsProvider.providerName === 'mock'
        ? 'simulated'
        : 'sent'
      : 'failed';

    const deliveryRecord: SmsDeliveryRecord = {
      id: `del_${randomUUID()}`,
      subscriptionId: sub.id,
      alertId: alert.id,
      alertAreaKey,
      alertType: alert.alertType,
      severity: alert.severity,
      phoneMasked,
      status: recordStatus,
      provider: smsProvider.providerName,
      providerMessageId: sendResult.messageId,
      errorMessage: sendResult.error,
      sentAt: new Date().toISOString()
    };

    await deliveryStorage.recordDelivery(deliveryRecord);

    // 6. Record decision in pipeline summary
    if (isSuccess) {
      summary.sentCount++;
      summary.results.push({
        subscriptionId: sub.id,
        phoneMasked,
        decision: 'sent',
        reason: dupCheck.reason,
        messageId: sendResult.messageId
      });
    } else {
      summary.failedCount++;
      summary.results.push({
        subscriptionId: sub.id,
        phoneMasked,
        decision: 'failed',
        reason: 'provider_send_failed',
        error: sendResult.error
      });
    }
  }

  return summary;
}
