import { SmsMessagePayload, SmsSendResult } from '../types';

/**
 * Standard interface for all SMS delivery providers.
 */
export interface SmsProvider {
  readonly providerName: string;
  sendSms(payload: SmsMessagePayload): Promise<SmsSendResult>;
}
