import { ClientType } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export interface ClientTypeDetectionInput {
  phone: string;
  address?: string | null;
}

/**
 * Auto-detect client type when creating a request from the site or manually.
 * Match by phone OR address in the clients table; serviced if isServiced=true.
 */
export async function detectClientType(input: ClientTypeDetectionInput): Promise<{
  clientType: ClientType;
  clientId: string | null;
}> {
  const normalizedPhone = input.phone.replace(/\D/g, '');

  const client = await prisma.client.findFirst({
    where: {
      OR: [
        { phone: { contains: normalizedPhone.slice(-10) } },
        ...(input.address ? [{ address: { equals: input.address, mode: 'insensitive' as const } }] : []),
      ],
    },
  });

  if (client && client.isServiced) {
    return { clientType: ClientType.serviced, clientId: client.id };
  }

  return { clientType: ClientType.new_from_site, clientId: client?.id ?? null };
}
