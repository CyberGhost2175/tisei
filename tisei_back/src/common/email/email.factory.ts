import { env } from '../../config/env.js';
import type { EmailProvider } from './email.types.js';
import { ConsoleEmailProvider } from './providers/console.provider.js';

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;

  switch (env.EMAIL_PROVIDER) {
    case 'console':
    default:
      provider = new ConsoleEmailProvider();
      break;
    // TODO: wire SMTP / SendGrid / Mailgun providers
  }

  return provider;
}
