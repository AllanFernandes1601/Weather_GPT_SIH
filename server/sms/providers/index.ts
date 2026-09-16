import { SmsProvider } from './smsProvider.interface';
import { MockSmsProvider } from './mockSmsProvider';

export * from './smsProvider.interface';
export * from './mockSmsProvider';

/**
 * Factory function to retrieve the active SMS provider instance based on environment configuration.
 *
 * If `SMS_PROVIDER` is unset or empty, it safely defaults to 'mock'.
 * If an unsupported or unknown provider is specified, it throws a clear Error.
 */
export function getSmsProvider(): SmsProvider {
  const configuredProvider = (process.env.SMS_PROVIDER || 'mock').trim().toLowerCase();

  switch (configuredProvider) {
    case 'mock':
      return new MockSmsProvider();
    default:
      throw new Error(
        `Unsupported SMS provider "${configuredProvider}". Currently supported providers: ["mock"]. Check SMS_PROVIDER in your environment.`
      );
  }
}
