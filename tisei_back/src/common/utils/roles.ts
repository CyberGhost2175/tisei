import type { UserRole } from '@prisma/client';

/** Роли полевых мастеров (штатный и партнёрский). */
export const FIELD_ROLES: UserRole[] = ['executor', 'master'];

export function isFieldRole(role: UserRole): boolean {
  return role === 'executor' || role === 'master';
}

/** Штатный мастер — может сам брать заявки, 10% в кассу. */
export function isStaffMaster(role: UserRole): boolean {
  return role === 'executor';
}

/** Партнёрский мастер — только по предложению менеджера, 20% в кассу. */
export function isPartnerMaster(role: UserRole): boolean {
  return role === 'master';
}
