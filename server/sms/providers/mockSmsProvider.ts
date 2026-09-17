import { randomUUID } from 'crypto';
import { SmsProvider } from './smsProvider.interface';
import { SmsMessagePayload, SmsSendResult, isValidE164PhoneNumber, maskPhoneNumber } from '../types';

/**
 * Mock SMS provider for development, testing, and demonstration.
 * Validates inputs, masks sensitive recipient data, logs simulation to console,
 * and performs zero external network calls.
 */
export class MockSmsProvider implements SmsProvider {
  readonly providerName = 'mock';

  async sendSms(payload: SmsMessagePayload): Promise<SmsSendResult> {
    const timestamp = new Date().toISOString();

    if (!payload || !payload.to || typeof payload.to !== 'string') {
      return {
        success: false,
        provider: this.providerName,
        error: 'Missing recipient phone number (payload.to)',
        timestamp
      };
    }

    if (!isValidE164PhoneNumber(payload.to)) {
      const maskedAttempt = maskPhoneNumber(payload.to);
      console.warn(`[MockSmsProvider] Rejected SMS to invalid number format: ${maskedAttempt}`);
      return {
        success: false,
        provider: this.providerName,
        error: `Invalid E.164 phone number format: ${maskedAttempt}`,
        timestamp
      };
    }

    if (!payload.body || typeof payload.body !== 'string' || !payload.body.trim()) {
      return {
        success: false,
        provider: this.providerName,
        error: 'Message body cannot be empty',
        timestamp
      };
    }

    const maskedPhone = maskPhoneNumber(payload.to);
    const messageId = `mock_${randomUUID()}`;

    // Log the simulated delivery without revealing the real phone number
    console.log(
      `[MockSmsProvider] Simulated SMS sent [id=${messageId}] to ${maskedPhone}: "${payload.body.trim()}"`
    );

    return {
      success: true,
      provider: this.providerName,
      messageId,
      timestamp
    };
  }
}
