import { SmsProvider } from './smsProvider.interface';
import { MockSmsProvider } from './mockSmsProvider';
import { Msg91SmsProvider } from './msg91SmsProvider';

export * from './smsProvider.interface';
export * from './mockSmsProvider';
export * from './msg91SmsProvider';
export * from './templateUtils';

/**
 * Factory function to retrieve the active SMS provider instance based on environment configuration.
 *
 * If `SMS_PROVIDER` is unset or empty, it safely defaults to 'mock'.
 * If 'msg91' is configured, returns Msg91SmsProvider.
 * If an unsupported or unknown provider is specified, it throws an explicit configuration Error.
 */
export function getSmsProvider(): SmsProvider {
  const configuredProvider = (process.env.SMS_PROVIDER || 'mock').trim().toLowerCase();

  switch (configuredProvider) {
    case 'mock':
      return new MockSmsProvider();
    case 'msg91':
      return new Msg91SmsProvider();
    default:
      throw new Error(
        `Unsupported SMS provider "${configuredProvider}". Currently supported providers: ["mock", "msg91"]. Check SMS_PROVIDER in your environment.`
      );
  }
}

