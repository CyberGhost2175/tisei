import type { RequestStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { ForbiddenError, NotFoundError } from '../../common/errors/AppError.js';

export type AuthContext = { userId: string; role: UserRole };

type RequestWithAssignments = {
  assignments: { executorId: string }[];
  status: RequestStatus;
};

/** Исполнитель видит свои заявки и свободные (без назначения) активные заявки. */
export function executorCanViewRequest(request: RequestWithAssignments, userId: string): boolean {
  if (request.assignments.some((a) => a.executorId === userId)) return true;
  if (request.assignments.length > 0) return false;
  return request.status !== 'closed' && request.status !== 'cancelled';
}

export function executorCanWriteRequest(request: RequestWithAssignments, userId: string): boolean {
  return request.assignments.some((a) => a.executorId === userId);
}

export async function assertRequestAccess(requestId: string, auth: AuthContext) {
  const request = await prisma.request.findFirst({
    where: { id: requestId, deletedAt: null },
    include: { assignments: true },
  });

  if (!request) throw new NotFoundError('Заявка не найдена');

  if (auth.role === 'executor' && !executorCanViewRequest(request, auth.userId)) {
    throw new ForbiddenError('Нет доступа к этой заявке');
  }

  return request;
}

/** Запись в заявку: исполнитель должен быть назначен (взял в работу). */
export async function assertRequestWriteAccess(requestId: string, auth: AuthContext) {
  const request = await assertRequestAccess(requestId, auth);

  if (auth.role === 'executor' && !executorCanWriteRequest(request, auth.userId)) {
    throw new ForbiddenError('Возьмите заявку в работу, чтобы изменять её');
  }

  return request;
}
