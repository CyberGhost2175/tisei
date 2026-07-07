import { RequestPriority } from '@prisma/client';
import { findMatchingPartner, getPartnerById } from './partner-match.js';

/** Все новые заявки — обычный приоритет; менеджер меняет вручную. */
export async function resolveRequestPriority(input: {
  requestedPriority?: RequestPriority;
  existingPriority?: RequestPriority;
  isCreate?: boolean;
}): Promise<RequestPriority> {
  if (input.isCreate) return RequestPriority.normal;
  if (input.requestedPriority !== undefined) return input.requestedPriority;
  return input.existingPriority ?? RequestPriority.normal;
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
