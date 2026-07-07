import { prisma } from '../../config/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/AppError.js';
import { writeAuditLog } from '../audit/audit.service.js';
import type { CreatePartnerBody, UpdatePartnerBody } from './partner.schemas.js';

function toDto(row: {
  id: string;
  name: string;
  aliases: string[];
  isBuiltin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPartners(activeOnly = true) {
  const rows = await prisma.partnerEstablishment.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { name: 'asc' },
  });
  return rows.map(toDto);
}

export async function createPartner(body: CreatePartnerBody, actorId: string) {
  try {
    const row = await prisma.partnerEstablishment.create({
      data: {
        name: body.name.trim(),
        aliases: body.aliases.map((a) => a.trim()).filter(Boolean),
      },
    });
    await writeAuditLog({
      userId: actorId,
      action: 'partner.create',
      entityType: 'PartnerEstablishment',
      entityId: row.id,
      after: { name: row.name },
    });
    return toDto(row);
  } catch {
    throw new ConflictError('Партнёр с таким названием уже существует');
  }
}

export async function updatePartner(id: string, body: UpdatePartnerBody, actorId: string) {
  const existing = await prisma.partnerEstablishment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Партнёр не найден');

  try {
    const row = await prisma.partnerEstablishment.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        aliases: body.aliases?.map((a) => a.trim()).filter(Boolean),
        isActive: body.isActive,
      },
    });
    await writeAuditLog({
      userId: actorId,
      action: 'partner.update',
      entityType: 'PartnerEstablishment',
      entityId: id,
      after: body,
    });
    return toDto(row);
  } catch {
    throw new ConflictError('Партнёр с таким названием уже существует');
  }
}

export async function deletePartner(id: string, actorId: string) {
  const existing = await prisma.partnerEstablishment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Партнёр не найден');
  if (existing.isBuiltin) {
    throw new ForbiddenError('Встроенного партнёра нельзя удалить — отключите через «Активен»');
  }

  await prisma.partnerEstablishment.delete({ where: { id } });
  await writeAuditLog({
    userId: actorId,
    action: 'partner.delete',
    entityType: 'PartnerEstablishment',
    entityId: id,
  });
}
