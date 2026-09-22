import { RequestPriority } from '@prisma/client';
import { findMatchingPartner, getPartnerById } from './partner-match.js';

/** Новые заявки без приоритета — менеджер выставляет P1–P4 вручную. */
export async function resolveRequestPriority(input: {
  requestedPriority?: RequestPriority | null;
  existingPriority?: RequestPriority | null;
  isCreate?: boolean;
}): Promise<RequestPriority | null> {
  if (input.isCreate) return null;
  if (input.requestedPriority !== undefined) return input.requestedPriority;
  return input.existingPriority ?? null;
}

export async function resolvePartnerLink(input: {
  companyOrFullName: string;
  partnerEstablishmentId?: string | null;
}): Promise<string | null> {
  if (input.partnerEstablishmentId) {
    const partner = await getPartnerById(input.partnerEstablishmentId);
    if (partner) return partner.id;
  }

  const matched = await findMatchingPartner(input.companyOrFullName);
  return matched?.id ?? null;
}
