import type { RequestStatus } from '@prisma/client';
import { InvalidStatusTransitionError } from '../../common/errors/AppError.js';

/**
 * Hard-coded status transition graph (not stored in DB).
 * Final state: closed — no outgoing transitions.
 */
const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  new: ['in_progress', 'frozen'],
  in_progress: ['awaiting_parts', 'frozen', 'in_service', 'closed'],
  awaiting_parts: ['in_progress', 'frozen', 'in_service'],
  frozen: ['in_progress'],
  in_service: ['in_progress', 'closed'],
  closed: [],
  cancelled: [],
};

const FINAL_STATUSES: ReadonlySet<RequestStatus> = new Set(['closed', 'cancelled']);

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  if (from === to) return false;
  if (FINAL_STATUSES.has(from)) return false;
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: RequestStatus): RequestStatus[] {
  return [...TRANSITIONS[from]];
}

export function assertTransition(from: RequestStatus, to: RequestStatus): void {
  if (!canTransition(from, to)) {
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
  'closed',
];
