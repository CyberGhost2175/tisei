import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Auth guard: verifies the Bearer access token and attaches `request.authUser`.
 * Attach as a route `preHandler`. Does NOT check role — use requireRole for that.
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Отсутствует токен доступа');
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    request.authUser = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
  } catch {
    throw new UnauthorizedError('Недействительный или просроченный токен доступа');
  }
}
