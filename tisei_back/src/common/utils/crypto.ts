import { randomBytes, createHash } from 'node:crypto';
import argon2 from 'argon2';

/**
 * Password hashing uses Argon2id (memory-hard, recommended by OWASP).
 * Plaintext passwords are never logged or stored.
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** Generates a cryptographically strong opaque token (URL-safe). */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 hash used for storing refresh / reset tokens at rest. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
