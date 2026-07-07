import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { env } from '../../config/env.js';

authenticator.options = { window: 1 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotpCode(secret: string, token: string): boolean {
  return authenticator.verify({ token, secret });
}

export function getTotpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, env.TOTP_ISSUER, secret);
}

export async function generateTotpQrDataUrl(email: string, secret: string): Promise<string> {
  const uri = getTotpUri(email, secret);
  return QRCode.toDataURL(uri);
}
