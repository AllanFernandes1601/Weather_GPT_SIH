import { SmsProvider } from './smsProvider.interface';
import {
  SmsMessagePayload,
  SmsSendResult,
  PreferredLanguage,
  isValidE164PhoneNumber,
  maskPhoneNumber
} from '../types';
import { parseConfiguredTemplateVariables } from './templateUtils';

export interface Msg91ProviderConfig {
  authKey?: string;
  flowId?: string;
  flowIdMap?: Partial<Record<PreferredLanguage, string>>;
  senderId?: string;
  liveSendEnabled?: boolean;
  apiEndpoint?: string;
  timeoutMs?: number;
  templateVariables?: string[] | string;
  fetchFn?: typeof fetch;
}

/**
 * Production-capable SMS provider targeting MSG91 Flow V5 API.
 * Adheres to India's TRAI/DLT and template variable regulatory requirements.
 *
 * Safety Gate:
 * Refuses network dispatch unless SMS_LIVE_SEND_ENABLED=true.
 *
 * MSG91 Flow V5 Specification:
 * - POST https://control.msg91.com/api/v5/flow
 * - Header: authkey: <server-side credential>
 * - Body: {
 *     flow_id: "<template_id>",
 *     sender: "<sender_id>",
 *     recipients: [{ mobiles: "919XXXXXXXXX", ...templateVariables }]
 *   }
 */
export class Msg91SmsProvider implements SmsProvider {
  readonly providerName = 'msg91';

  private readonly authKey?: string;
  private readonly defaultFlowId?: string;
  private readonly flowIdMap?: Partial<Record<PreferredLanguage, string>>;
  private readonly senderId?: string;
  private readonly liveSendEnabled: boolean;
  private readonly apiEndpoint: string;
  private readonly configuredTemplateVariables?: string[];
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: Msg91ProviderConfig = {}) {
    this.authKey = config.authKey ?? process.env.MSG91_AUTH_KEY;
    this.defaultFlowId = config.flowId ?? process.env.MSG91_FLOW_ID;
    this.flowIdMap = config.flowIdMap;
    this.senderId = config.senderId ?? process.env.MSG91_SENDER_ID;
    this.liveSendEnabled =
      config.liveSendEnabled ?? (process.env.SMS_LIVE_SEND_ENABLED === 'true');
    this.apiEndpoint =
      config.apiEndpoint ??
      process.env.MSG91_API_ENDPOINT ??
      'https://control.msg91.com/api/v5/flow';
    this.configuredTemplateVariables =
      config.templateVariables !== undefined
        ? parseConfiguredTemplateVariables(config.templateVariables)
        : undefined;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
  }

  /**
   * Resolves the appropriate MSG91 flow_id.
   * Priority:
   * 1. Explicit payload.templateId
   * 2. Language-specific flow ID from flowIdMap if configured
   * 3. Default configured flow ID (MSG91_FLOW_ID)
   */
  private resolveFlowId(payload: SmsMessagePayload): string | undefined {
    if (payload.templateId?.trim()) {
      return payload.templateId.trim();
    }
    if (payload.preferredLanguage && this.flowIdMap?.[payload.preferredLanguage]) {
      return this.flowIdMap[payload.preferredLanguage]?.trim();
    }
    return this.defaultFlowId?.trim();
  }

  async sendSms(payload: SmsMessagePayload): Promise<SmsSendResult> {
    const timestamp = new Date().toISOString();

    // 1. Validate Recipient Phone Format (E.164)
    if (!payload || !payload.to || typeof payload.to !== 'string') {
      return {
        success: false,
        provider: this.providerName,
        error: 'Missing recipient phone number (payload.to)',
        timestamp
      };
    }

    if (!isValidE164PhoneNumber(payload.to)) {
      const masked = maskPhoneNumber(payload.to);
      return {
        success: false,
        provider: this.providerName,
        error: `Invalid E.164 phone number format: ${masked}`,
        timestamp
      };
    }

    const maskedPhone = maskPhoneNumber(payload.to);

    // 2. Validate Credentials & Configuration (Never log credential values)
    const effectiveAuthKey = this.authKey?.trim();
    if (!effectiveAuthKey) {
      return {
        success: false,
        provider: this.providerName,
        error: 'MSG91_AUTH_KEY is not configured',
        timestamp
      };
    }

    const effectiveFlowId = this.resolveFlowId(payload);
    if (!effectiveFlowId) {
      return {
        success: false,
        provider: this.providerName,
        error: 'MSG91_FLOW_ID is not configured',
        timestamp
      };
    }

    const effectiveSenderId = (payload.senderId || this.senderId)?.trim();
    if (!effectiveSenderId) {
      return {
        success: false,
        provider: this.providerName,
        error: 'MSG91_SENDER_ID is not configured',
        timestamp
      };
    }

    // 3. Live-Send Safety Gate Check
    if (!this.liveSendEnabled) {
      console.warn(
        `[Msg91SmsProvider] Live dispatch blocked by safety gate (SMS_LIVE_SEND_ENABLED !== true) for recipient ${maskedPhone}`
      );
      return {
        success: false,
        provider: this.providerName,
        error: 'Live SMS sending is disabled (SMS_LIVE_SEND_ENABLED is not true)',
        timestamp
      };
    }

    // 4. Normalize E.164 to MSG91 outbound format (remove leading '+')
    // e.g. +919876543210 -> 919876543210
    const outboundMobile = payload.to.trim().replace(/^\+/, '');

    // 5. Construct & Filter DLT Template Variables
    // The recipient payload must always contain `mobiles`.
    // Then include ONLY explicitly configured template variables.
    const configuredVarNames =
      this.configuredTemplateVariables !== undefined
        ? this.configuredTemplateVariables
        : parseConfiguredTemplateVariables(process.env.MSG91_TEMPLATE_VARIABLES);

    const recipientPayload: Record<string, string> = {
      mobiles: outboundMobile
    };

    const sourceVariables = payload.templateVariables || {};

    if (configuredVarNames.length > 0) {
      for (const varName of configuredVarNames) {
        // 'mobiles' cannot be overridden; skip if present
        if (varName === 'mobiles') continue;

        // Verify that the requested variable exists in sourceVariables
        if (sourceVariables[varName] === undefined || sourceVariables[varName] === null) {
          return {
            success: false,
            provider: this.providerName,
            error: `Configured template variable "${varName}" is missing from alert data`,
            timestamp
          };
        }

        recipientPayload[varName] = String(sourceVariables[varName]);
      }
    }
    // If configuredVarNames is empty, recipientPayload contains ONLY `mobiles`.
    // This safely supports variable-free MSG91 templates.

    const requestBody = {
      flow_id: effectiveFlowId,
      sender: effectiveSenderId,
      recipients: [recipientPayload]
    };

    // 6. Network Dispatch with AbortController Timeout (Default 10s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      console.log(
        `[Msg91SmsProvider] Dispatching SMS via Flow V5 [flow=${effectiveFlowId}, sender=${effectiveSenderId}] to ${maskedPhone}`
      );

      const response = await this.fetchFn(this.apiEndpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authkey: effectiveAuthKey
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Parse JSON response safely
      let data: any;
      try {
        data = await response.json();
      } catch {
        return {
          success: false,
          provider: this.providerName,
          error: `Invalid non-JSON response from MSG91 (HTTP status ${response.status})`,
          timestamp
        };
      }

      // Check HTTP status code
      if (!response.ok) {
        const errorMsg =
          typeof data?.message === 'string'
            ? data.message
            : `HTTP request failed with status ${response.status}`;
        return {
          success: false,
          provider: this.providerName,
          error: errorMsg,
          timestamp
        };
      }

      // Check MSG91 Flow V5 business response: type === "success"
      if (data && data.type === 'success') {
        const messageId =
          typeof data.message === 'string' ? data.message : 'msg91_dispatched';
        return {
          success: true,
          provider: this.providerName,
          messageId,
          timestamp
        };
      }

      // MSG91 returned 200 but type was error or not success
      const failureReason =
        typeof data?.message === 'string'
          ? data.message
          : 'MSG91 reported unsuccessful response status';
      return {
        success: false,
        provider: this.providerName,
        error: failureReason,
        timestamp
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err?.name === 'AbortError') {
        return {
          success: false,
          provider: this.providerName,
          error: `MSG91 request timed out after ${this.timeoutMs}ms`,
          timestamp
        };
      }

      // Safe error message - never leak headers or internal stack
      return {
        success: false,
        provider: this.providerName,
        error: err?.message
          ? `MSG91 network dispatch error: ${err.message}`
          : 'Network error communicating with MSG91',
        timestamp
      };
    }
  }
}
