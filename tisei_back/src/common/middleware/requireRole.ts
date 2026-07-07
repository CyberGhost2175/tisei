import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError.js';

/**
 * Role guard factory. Use at the ROUTE level (preHandler) rather than inside
 * controllers, e.g. `preHandler: [authenticate, requireRole(['manager','admin'])]`.
 */
export function requireRole(roles: UserRole[]) {
  return async function roleGuard(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!request.authUser) {
      throw new UnauthorizedError('Требуется аутентификация');
    }
    if (!roles.includes(request.authUser.role)) {
      throw new ForbiddenError('Недостаточно прав для выполнения операции');
    }
  };
}
