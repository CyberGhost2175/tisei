import { ServiceEquipmentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import type {
  CreateServiceEquipmentBody,
  UpdateServiceEquipmentBody,
} from './service-equipment.schemas.js';

const include = {
  partnerEstablishment: { select: { id: true, name: true } },
  equipmentCategory: { select: { id: true, name: true } },
  request: { select: { id: true, number: true } },
} as const;

function toDto(row: Awaited<ReturnType<typeof prisma.serviceEquipment.findFirst>>) {
  if (!row) throw new NotFoundError('Запись не найдена');
  return {
    ...row,
    receivedAt: row.receivedAt.toISOString(),
    returnedAt: row.returnedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listServiceEquipment(status?: ServiceEquipmentStatus) {
  const rows = await prisma.serviceEquipment.findMany({
    where: status ? { status } : undefined,
    include,
    orderBy: [{ status: 'asc' }, { receivedAt: 'desc' }],
  });
  return rows.map((r) => toDto(r));
}

export async function createServiceEquipment(body: CreateServiceEquipmentBody) {
  if (!body.equipmentCategoryId && !body.equipmentCategoryText) {
    throw new BadRequestError('Укажите категорию оборудования');
  }
  const row = await prisma.serviceEquipment.create({
    data: {
      companyOrFullName: body.companyOrFullName,
      partnerEstablishmentId: body.partnerEstablishmentId ?? null,
      equipmentCategoryId: body.equipmentCategoryId ?? null,
      equipmentCategoryText: body.equipmentCategoryText ?? null,
      equipmentName: body.equipmentName ?? null,
      problemDescription: body.problemDescription ?? null,
      requestId: body.requestId ?? null,
      notes: body.notes ?? null,
    },
    include,
  });
  return toDto(row);
}

export async function createServiceEquipmentFromRequest(requestId: string) {
  const existing = await prisma.serviceEquipment.findUnique({ where: { requestId } });
  if (existing) return existing;

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      companyOrFullName: true,
      partnerEstablishmentId: true,
      equipmentCategoryId: true,
      equipmentCategoryText: true,
      equipmentName: true,
      problemDescription: true,
    },
  });
  if (!request) throw new NotFoundError('Заявка не найдена');

  if (!request.equipmentCategoryId && !request.equipmentCategoryText) {
    throw new BadRequestError('Укажите категорию оборудования перед переводом в сервис');
  }

  return prisma.serviceEquipment.create({
    data: {
      companyOrFullName: request.companyOrFullName,
      partnerEstablishmentId: request.partnerEstablishmentId,
      equipmentCategoryId: request.equipmentCategoryId,
      equipmentCategoryText: request.equipmentCategoryText,
      equipmentName: request.equipmentName,
      problemDescription: request.problemDescription,
      requestId: request.id,
    },
    include,
  });
}

export async function updateServiceEquipment(id: string, body: UpdateServiceEquipmentBody) {
  const existing = await prisma.serviceEquipment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Запись не найдена');

  const row = await prisma.serviceEquipment.update({
    where: { id },
    data: {
      companyOrFullName: body.companyOrFullName,
      partnerEstablishmentId: body.partnerEstablishmentId,
      equipmentCategoryId: body.equipmentCategoryId,
      equipmentCategoryText: body.equipmentCategoryText,
      equipmentName: body.equipmentName,
      problemDescription: body.problemDescription,
      notes: body.notes,
      status: body.status,
      returnedAt:
        body.status === ServiceEquipmentStatus.returned
          ? new Date()
          : body.status === ServiceEquipmentStatus.in_service
            ? null
            : undefined,
    },
    include,
  });
  return toDto(row);
}

export async function deleteServiceEquipment(id: string) {
  const existing = await prisma.serviceEquipment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Запись не найдена');
  await prisma.serviceEquipment.delete({ where: { id } });
}
