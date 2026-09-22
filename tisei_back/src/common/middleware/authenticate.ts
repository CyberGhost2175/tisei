import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Auth guard: verifies the Bearer access token and attaches `request.authUser`.
 * Also accepts `access_token` / `token` query (for opening PDFs in the browser).
 * Attach as a route `preHandler`. Does NOT check role — use requireRole for that.
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  let token: string | undefined;
  if (header?.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length).trim();
  } else {
    const q = request.query as { access_token?: string; token?: string };
    token = (q.access_token ?? q.token)?.trim();
  }

  if (!token) {
    throw new UnauthorizedError('Отсутствует токен доступа');
  }

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
