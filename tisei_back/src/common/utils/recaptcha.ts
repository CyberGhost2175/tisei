import { env } from '../../config/env.js';
import { BadRequestError } from '../../common/errors/AppError.js';

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

/**
 * Verifies reCAPTCHA v3 token. In development without RECAPTCHA_SECRET, skips check.
 */
export async function verifyRecaptcha(token: string | undefined): Promise<void> {
  if (!env.RECAPTCHA_SECRET) {
    if (env.NODE_ENV === 'production') {
      throw new BadRequestError('reCAPTCHA не настроена');
    }
    return;
  }

  if (!token) {
    throw new BadRequestError('Требуется reCAPTCHA token');
  }

  const params = new URLSearchParams({
    secret: env.RECAPTCHA_SECRET,
    response: token,
  });

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = (await res.json()) as RecaptchaResponse;

  if (!data.success || (data.score !== undefined && data.score < env.RECAPTCHA_MIN_SCORE)) {
    throw new BadRequestError('reCAPTCHA verification failed');
  }
}
