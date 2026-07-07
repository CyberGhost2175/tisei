import type { EmailMessage, EmailProvider } from '../email.types.js';

/** Development provider — logs emails instead of sending. */
export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.info('[email:console]', {
      to: message.to,
      subject: message.subject,
      preview: message.text ?? message.html.slice(0, 120),
    });
  }
}
