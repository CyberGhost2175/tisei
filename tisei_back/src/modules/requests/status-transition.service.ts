import type { RequestStatus, UserRole } from '@prisma/client';
import { InvalidStatusTransitionError } from '../../common/errors/AppError.js';

/**
 * Hard-coded status transition graph (not stored in DB).
 * Closed/cancelled are terminal for the base graph; staff may reactivate closed
 * into working statuses (except "new").
 */
const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  new: ['in_progress', 'frozen', 'awaiting_approval', 'repeat'],
  in_progress: [
    'awaiting_parts',
    'frozen',
    'in_service',
    'closed',
    'awaiting_approval',
    'repeat',
  ],
  awaiting_parts: ['in_progress', 'frozen', 'in_service', 'awaiting_approval', 'repeat'],
  frozen: ['in_progress', 'awaiting_approval', 'repeat'],
  in_service: ['in_progress', 'closed', 'awaiting_approval', 'repeat'],
  awaiting_approval: [
    'new',
    'in_progress',
    'awaiting_parts',
    'frozen',
    'in_service',
    'closed',
    'repeat',
  ],
  repeat: [
    'new',
    'in_progress',
    'awaiting_parts',
    'frozen',
    'in_service',
    'closed',
    'awaiting_approval',
  ],
  closed: [],
  cancelled: [],
};

/** Реактивация закрытой заявки — без возврата в «Новая». */
const REACTIVATE_FROM_CLOSED: RequestStatus[] = [
  'repeat',
  'awaiting_approval',
  'in_progress',
  'awaiting_parts',
  'frozen',
  'in_service',
];

/** Штатный мастер (executor), менеджер и админ. */
const REACTIVATE_ROLES: ReadonlySet<UserRole> = new Set([
  'manager',
  'admin',
  'executor',
]);

const FINAL_STATUSES: ReadonlySet<RequestStatus> = new Set(['closed', 'cancelled']);

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  if (from === to) return false;
  if (FINAL_STATUSES.has(from)) return false;
  return TRANSITIONS[from].includes(to);
}

/** Менеджер/админ/мастер может вернуть закрытую заявку в рабочий статус (кроме new). */
export function canTransitionWithRole(
  from: RequestStatus,
  to: RequestStatus,
  role: UserRole,
): boolean {
  if (from === to) return false;
  if (from === 'closed' && REACTIVATE_ROLES.has(role) && REACTIVATE_FROM_CLOSED.includes(to)) {
    return true;
  }
  return canTransition(from, to);
}

export function allowedTransitions(from: RequestStatus): RequestStatus[] {
  return [...TRANSITIONS[from]];
}

export function allowedTransitionsWithRole(
  from: RequestStatus,
  role: UserRole,
): RequestStatus[] {
  if (from === 'closed' && REACTIVATE_ROLES.has(role)) {
    return [...REACTIVATE_FROM_CLOSED];
  }
  return allowedTransitions(from);
}

export function assertTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}

export function assertTransitionWithRole(
  from: RequestStatus,
  to: RequestStatus,
  role: UserRole,
): void {
  if (!canTransitionWithRole(from, to, role)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}

/** Статусы, доступные в UI (без отменённых). */
export const UI_REQUEST_STATUSES: RequestStatus[] = [
  'new',
  'in_progress',
  'awaiting_parts',
  'frozen',
  'in_service',
  'awaiting_approval',
  'repeat',
  'closed',
];
