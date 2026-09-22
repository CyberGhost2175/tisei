import type { AssignmentStatus, RequestStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { ForbiddenError, NotFoundError } from '../../common/errors/AppError.js';
import { isFieldRole, isPartnerMaster, isStaffMaster } from '../../common/utils/roles.js';

export type AuthContext = { userId: string; role: UserRole };

type RequestWithAssignments = {
  assignments: { executorId: string; status?: AssignmentStatus }[];
  status: RequestStatus;
  kind?: string;
};

/** Штатный мастер видит свои (в т.ч. закрытые) и свободные активные;
 * партнёрский — только свои назначения.
 * Заявки планового ТО доступны всем мастерам (раздел «Обслуживание»). */
export function fieldRoleCanViewRequest(
  request: RequestWithAssignments,
  userId: string,
  role: UserRole,
): boolean {
  if (request.kind === 'maintenance') return true;
  if (request.assignments.some((a) => a.executorId === userId)) return true;
  if (isPartnerMaster(role)) return false;
  // Свободные закрытые/отменённые штатному не показываем.
  if (request.status === 'closed' || request.status === 'cancelled') {
    return false;
  }
  if (request.assignments.length > 0) return false;
  return true;
}

/** Писать можно только при принятом назначении. */
export function fieldRoleCanWriteRequest(
  request: RequestWithAssignments,
  userId: string,
): boolean {
  return request.assignments.some(
    (a) => a.executorId === userId && (a.status ?? 'accepted') === 'accepted',
  );
}

/** @deprecated use fieldRoleCanViewRequest */
export function executorCanViewRequest(
  request: RequestWithAssignments,
  userId: string,
): boolean {
  return fieldRoleCanViewRequest(request, userId, 'executor');
}

/** @deprecated use fieldRoleCanWriteRequest */
export function executorCanWriteRequest(
  request: RequestWithAssignments,
  userId: string,
): boolean {
  return fieldRoleCanWriteRequest(request, userId);
}

export async function assertRequestAccess(requestId: string, auth: AuthContext) {
  const request = await prisma.request.findFirst({
    where: { id: requestId, deletedAt: null },
    include: { assignments: true },
  });

  if (!request) throw new NotFoundError('Заявка не найдена');

  if (
    isFieldRole(auth.role) &&
    !fieldRoleCanViewRequest(request, auth.userId, auth.role)
  ) {
    throw new ForbiddenError('Нет доступа к этой заявке');
  }

  return request;
}

/** Запись в заявку: мастер должен быть назначен и принять заявку. */
export async function assertRequestWriteAccess(requestId: string, auth: AuthContext) {
  const request = await assertRequestAccess(requestId, auth);

  if (isFieldRole(auth.role) && !fieldRoleCanWriteRequest(request, auth.userId)) {
    const proposed = request.assignments.some(
      (a) => a.executorId === auth.userId && a.status === 'proposed',
    );
    throw new ForbiddenError(
      proposed
        ? 'Примите предложенную заявку, чтобы изменять её'
        : 'Возьмите заявку в работу, чтобы изменять её',
    );
  }

  return request;
}

export function canClaimByRole(role: UserRole): boolean {
  return isStaffMaster(role);
}
