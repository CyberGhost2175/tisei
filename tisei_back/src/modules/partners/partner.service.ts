import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/AppError.js';
import { decimalToNumber, round2, toDecimal } from '../../common/utils/money.js';
import { writeAuditLog } from '../audit/audit.service.js';
import type {
  CreatePartnerBody,
  CreatePartnerLocationBody,
  UpdatePartnerBody,
  UpdatePartnerLocationBody,
} from './partner.schemas.js';

function toLocationDto(row: {
  id: string;
  partnerEstablishmentId: string;
  name: string;
  city: string;
  address: string;
  equipmentQuantity: number | null;
  maintenancePrice: Prisma.Decimal | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    partnerEstablishmentId: row.partnerEstablishmentId,
    name: row.name,
    city: row.city,
    address: row.address,
    equipmentQuantity: row.equipmentQuantity,
    maintenancePrice:
      row.maintenancePrice == null ? null : decimalToNumber(row.maintenancePrice),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDto(
  row: {
    id: string;
    name: string;
    aliases: string[];
    isBuiltin: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    locations?: Array<{
      id: string;
      partnerEstablishmentId: string;
      name: string;
      city: string;
      address: string;
      equipmentQuantity: number | null;
      maintenancePrice: Prisma.Decimal | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>;
    _count?: { locations: number };
  },
  includeLocations = false,
) {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    isBuiltin: row.isBuiltin,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    locationsCount: row._count?.locations ?? row.locations?.length,
    ...(includeLocations && row.locations
      ? { locations: row.locations.map(toLocationDto) }
      : {}),
  };
}

export async function listPartners(activeOnly = true, includeLocations = false) {
  const rows = await prisma.partnerEstablishment.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { locations: true } },
      ...(includeLocations
        ? {
            locations: {
              where: activeOnly ? { isActive: true } : undefined,
              orderBy: { name: 'asc' },
            },
          }
        : {}),
    },
  });
  return rows.map((row) => toDto(row, includeLocations));
}

export async function createPartner(body: CreatePartnerBody, actorId: string) {
  try {
    const row = await prisma.partnerEstablishment.create({
      data: {
        name: body.name.trim(),
        aliases: body.aliases.map((a) => a.trim()).filter(Boolean),
      },
      include: { _count: { select: { locations: true } } },
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
      include: { _count: { select: { locations: true } } },
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
  if (existing.isBuiltin) throw new ForbiddenError('Встроенного партнёра нельзя удалить');

  await prisma.partnerEstablishment.delete({ where: { id } });
  await writeAuditLog({
    userId: actorId,
    action: 'partner.delete',
    entityType: 'PartnerEstablishment',
    entityId: id,
  });
}

export async function listPartnerLocations(partnerId: string, activeOnly = true) {
  const partner = await prisma.partnerEstablishment.findUnique({ where: { id: partnerId } });
  if (!partner) throw new NotFoundError('Партнёр не найден');

  const rows = await prisma.partnerLocation.findMany({
    where: {
      partnerEstablishmentId: partnerId,
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: { name: 'asc' },
  });
  return rows.map(toLocationDto);
}

export async function createPartnerLocation(
  partnerId: string,
  body: CreatePartnerLocationBody,
  actorId: string,
) {
  const partner = await prisma.partnerEstablishment.findUnique({ where: { id: partnerId } });
  if (!partner) throw new NotFoundError('Партнёр не найден');

  try {
    const row = await prisma.partnerLocation.create({
      data: {
        partnerEstablishmentId: partnerId,
        name: body.name.trim(),
        city: body.city.trim(),
        address: body.address.trim(),
        equipmentQuantity: body.equipmentQuantity ?? null,
        maintenancePrice:
          body.maintenancePrice === undefined || body.maintenancePrice === null
            ? null
            : round2(toDecimal(body.maintenancePrice)),
      },
    });
    await writeAuditLog({
      userId: actorId,
      action: 'partner_location.create',
      entityType: 'PartnerLocation',
      entityId: row.id,
      after: { partnerId, name: row.name, address: row.address },
    });
    return toLocationDto(row);
  } catch {
    throw new ConflictError('Точка с таким названием уже есть у этого партнёра');
  }
}

export async function updatePartnerLocation(
  partnerId: string,
  locationId: string,
  body: UpdatePartnerLocationBody,
  actorId: string,
) {
  const existing = await prisma.partnerLocation.findFirst({
    where: { id: locationId, partnerEstablishmentId: partnerId },
  });
  if (!existing) throw new NotFoundError('Точка не найдена');

  try {
    const row = await prisma.partnerLocation.update({
      where: { id: locationId },
      data: {
        name: body.name?.trim(),
        city: body.city?.trim(),
        address: body.address?.trim(),
        equipmentQuantity:
          body.equipmentQuantity === undefined ? undefined : body.equipmentQuantity,
        maintenancePrice:
          body.maintenancePrice === undefined
            ? undefined
            : body.maintenancePrice === null
              ? null
              : round2(toDecimal(body.maintenancePrice)),
        isActive: body.isActive,
      },
    });
    await writeAuditLog({
      userId: actorId,
      action: 'partner_location.update',
      entityType: 'PartnerLocation',
      entityId: locationId,
      after: body,
    });
    return toLocationDto(row);
  } catch {
    throw new ConflictError('Точка с таким названием уже есть у этого партнёра');
  }
}

export async function deletePartnerLocation(partnerId: string, locationId: string, actorId: string) {
  const existing = await prisma.partnerLocation.findFirst({
    where: { id: locationId, partnerEstablishmentId: partnerId },
  });
  if (!existing) throw new NotFoundError('Точка не найдена');

  await prisma.partnerLocation.delete({ where: { id: locationId } });
  await writeAuditLog({
    userId: actorId,
    action: 'partner_location.delete',
    entityType: 'PartnerLocation',
    entityId: locationId,
  });
}
