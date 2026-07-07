import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { buildPaginated, toSkipTake, type PaginatedResult } from '../../common/utils/pagination.js';
import { writeAuditLog } from '../audit/audit.service.js';
import type { CreateClientBody, ClientListQuery, UpdateClientBody } from './client.schemas.js';

function toDto(client: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isServiced: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...client,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

export async function listClients(
  query: ClientListQuery,
): Promise<PaginatedResult<ReturnType<typeof toDto>>> {
  const where: Prisma.ClientWhereInput = {};
  if (query.isServiced !== undefined) where.isServiced = query.isServiced;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { address: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const { skip, take } = toSkipTake(query);
  const [items, total] = await Promise.all([
    prisma.client.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.client.count({ where }),
  ]);

  return buildPaginated(items.map(toDto), total, query);
}

export async function getClientById(id: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new NotFoundError('Клиент не найден');
  return toDto(client);
}

export async function createClient(body: CreateClientBody, actorId: string) {
  const client = await prisma.client.create({ data: body });
  await writeAuditLog({
    userId: actorId,
    action: 'client.create',
    entityType: 'Client',
    entityId: client.id,
    after: { name: client.name },
  });
  return toDto(client);
}

export async function updateClient(id: string, body: UpdateClientBody, actorId: string) {
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Клиент не найден');

  const client = await prisma.client.update({ where: { id }, data: body });
  await writeAuditLog({
    userId: actorId,
    action: 'client.update',
    entityType: 'Client',
    entityId: id,
    before: { isServiced: existing.isServiced },
    after: { isServiced: client.isServiced },
  });
  return toDto(client);
}

export async function deleteClient(id: string, actorId: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new NotFoundError('Клиент не найден');

  await prisma.client.delete({ where: { id } });
  await writeAuditLog({
    userId: actorId,
    action: 'client.delete',
    entityType: 'Client',
    entityId: id,
  });
}
