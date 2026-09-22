import { Prisma, type PartSection } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors/AppError.js';
import { decimalToNumber, round2, toDecimal } from '../../common/utils/money.js';
import { writeAuditLog } from '../audit/audit.service.js';
import type { CreatePartBody, PartsSpendingPeriod, UpdatePartBody, BulkSetQuantityBody } from './part.schemas.js';

function toPartDto(row: {
  id: string;
  name: string;
  section: PartSection;
  quantity: number;
  unitPrice: Prisma.Decimal;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    section: row.section,
    quantity: row.quantity,
    unitPrice: decimalToNumber(row.unitPrice),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listParts(activeOnly = false, section?: PartSection) {
  const rows = await prisma.part.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(section ? { section } : {}),
    },
    orderBy: [{ section: 'asc' }, { isActive: 'desc' }, { name: 'asc' }],
  });
  return rows.map(toPartDto);
}

export async function createPart(body: CreatePartBody, userId: string) {
  try {
    const quantity = body.section === 'KFC' ? 0 : (body.quantity ?? 0);
    const row = await prisma.part.create({
      data: {
        name: body.name.trim(),
        section: body.section,
        quantity,
        unitPrice: round2(toDecimal(body.unitPrice)),
      },
    });

    await writeAuditLog({
      userId,
      action: 'part.create',
      entityType: 'Part',
      entityId: row.id,
      after: { name: row.name, section: row.section, quantity: row.quantity },
    });

    return toPartDto(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictError('Запчасть с таким названием уже есть в этом разделе');
    }
    throw e;
  }
}

export async function updatePart(id: string, body: UpdatePartBody, userId: string) {
  const existing = await prisma.part.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Запчасть не найдена');

  const nextSection = body.section ?? existing.section;
  // KFC — без остатков на складе; количество не меняем (всегда 0)
  const quantity =
    nextSection === 'KFC' ? 0 : body.quantity !== undefined ? body.quantity : undefined;

  try {
    const row = await prisma.part.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        section: body.section,
        quantity,
        unitPrice: body.unitPrice !== undefined ? round2(toDecimal(body.unitPrice)) : undefined,
      },
    });

    await writeAuditLog({
      userId,
      action: 'part.update',
      entityType: 'Part',
      entityId: id,
      after: { name: row.name, section: row.section, quantity: row.quantity },
    });

    return toPartDto(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictError('Запчасть с таким названием уже есть в этом разделе');
    }
    throw e;
  }
}

export async function deletePart(id: string, userId: string) {
  const existing = await prisma.part.findUnique({
    where: { id },
    include: { usages: { take: 1 } },
  });
  if (!existing) throw new NotFoundError('Запчасть не найдена');

  if (existing.usages.length > 0) {
    throw new BadRequestError(
      'Нельзя удалить запчасть — она использовалась в заявках. Снимите с учёта или скройте позицию.',
    );
  }

  await prisma.part.delete({ where: { id } });

  await writeAuditLog({
    userId,
    action: 'part.delete',
    entityType: 'Part',
    entityId: id,
  });
}

export async function bulkSetQuantity(body: BulkSetQuantityBody, userId: string) {
  if (body.section !== 'SERVICE') {
    throw new BadRequestError('Количество на складе задаётся только для раздела СЕРВИС');
  }

  const result = await prisma.part.updateMany({
    where: { section: body.section },
    data: { quantity: body.quantity },
  });

  await writeAuditLog({
    userId,
    action: 'part.bulk_set_quantity',
    entityType: 'Part',
    entityId: `section:${body.section}`,
    after: { section: body.section, quantity: body.quantity, updated: result.count },
  });

  return { updated: result.count, section: body.section, quantity: body.quantity };
}

function spendingRange(period: PartsSpendingPeriod) {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);

  if (period === 'day') from.setDate(now.getDate() - 1);
  if (period === 'week') from.setDate(now.getDate() - 7);
  if (period === 'month') from.setMonth(now.getMonth() - 1);
  if (period === 'quarter') from.setMonth(now.getMonth() - 3);

  return { from, to };
}

export async function getPartsSpending(period: PartsSpendingPeriod, section?: PartSection) {
  const { from, to } = spendingRange(period);

  const agg = await prisma.requestPartUsage.aggregate({
    where: {
      createdAt: { gte: from, lte: to },
      ...(section
        ? {
            part: { section },
          }
        : {}),
    },
    _sum: { lineTotal: true },
    _count: true,
  });

  return {
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    totalSpent: decimalToNumber(agg._sum.lineTotal),
    usageCount: agg._count,
    section: section ?? null,
  };
}
