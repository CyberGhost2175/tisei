import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../utils/jwt.js';

/** Attaches authUser when a valid Bearer token is present; does not fail otherwise. */
export async function optionalAuthenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return;

  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    request.authUser = { id: payload.sub, role: payload.role, email: payload.email };
  } catch {
    // Public access continues without auth
  }
}
