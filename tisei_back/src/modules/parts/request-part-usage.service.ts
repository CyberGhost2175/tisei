import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { decimalToNumber, round2 } from '../../common/utils/money.js';
import { writeAuditLog } from '../audit/audit.service.js';
import {
  assertRequestAccess,
  assertRequestWriteAccess,
  type AuthContext,
} from '../requests/request-access.js';
import type { CreatePartUsageBody } from './request-part-usage.schemas.js';
import {
  sumRequestPartsExpense,
  syncClosingFormPartsExpense,
} from './sync-closing-parts-expense.js';

const usageInclude = {
  addedBy: { select: { id: true, fullName: true } },
} as const;

function toUsageDto(row: {
  id: string;
  requestId: string;
  partId: string | null;
  partNameSnapshot: string;
  unitPriceSnapshot: Prisma.Decimal;
  quantity: number;
  lineTotal: Prisma.Decimal;
  addedById: string | null;
  createdAt: Date;
  addedBy?: { id: string; fullName: string } | null;
}) {
  return {
    id: row.id,
    requestId: row.requestId,
    partId: row.partId,
    partNameSnapshot: row.partNameSnapshot,
    unitPriceSnapshot: decimalToNumber(row.unitPriceSnapshot),
    quantity: row.quantity,
    lineTotal: decimalToNumber(row.lineTotal),
    addedById: row.addedById,
    createdAt: row.createdAt.toISOString(),
    addedBy: row.addedBy ?? null,
  };
}

const WRITABLE_STATUSES = new Set(['in_progress', 'awaiting_parts', 'in_service']);

async function assertCanAddParts(requestId: string, auth: AuthContext) {
  const request = await assertRequestWriteAccess(requestId, auth);
  if (!WRITABLE_STATUSES.has(request.status)) {
    throw new BadRequestError(
      'Списание запчастей доступно для заявок в работе, ожидании запчастей или в сервисе',
    );
  }
  return request;
}

export async function listRequestPartUsages(requestId: string, auth: AuthContext) {
  await assertRequestAccess(requestId, auth);
  const rows = await prisma.requestPartUsage.findMany({
    where: { requestId },
    include: usageInclude,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toUsageDto);
}

export async function addRequestPartUsage(
  requestId: string,
  body: CreatePartUsageBody,
  auth: AuthContext,
) {
  await assertCanAddParts(requestId, auth);

  const partsTotalBefore = await sumRequestPartsExpense(requestId);

  const result = await prisma.$transaction(async (tx) => {
    const part = await tx.part.findFirst({
      where: { id: body.partId, isActive: true },
    });
    if (!part) throw new NotFoundError('Запчасть не найдена на складе');

    const tracksStock = part.section !== 'KFC';
    if (tracksStock && part.quantity < body.quantity) {
      throw new BadRequestError(
        `Недостаточно на складе: «${part.name}» — осталось ${part.quantity} шт.`,
      );
    }

    const unitPrice = round2(part.unitPrice);
    const lineTotal = round2(unitPrice.mul(body.quantity));

    // KFC — прайс-лист без остатков: кол-во только при списании, склад не уменьшаем
    if (tracksStock) {
      await tx.part.update({
        where: { id: part.id },
        data: { quantity: { decrement: body.quantity } },
      });
    }

    const usage = await tx.requestPartUsage.create({
      data: {
        requestId,
        partId: part.id,
        partNameSnapshot: part.name,
        unitPriceSnapshot: unitPrice,
        quantity: body.quantity,
        lineTotal,
        addedById: auth.userId,
      },
      include: usageInclude,
    });

    return usage;
  });

  await syncClosingFormPartsExpense(requestId, partsTotalBefore);

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.part_usage.add',
    entityType: 'RequestPartUsage',
    entityId: result.id,
    after: { requestId, partName: result.partNameSnapshot, quantity: result.quantity },
  });

  return toUsageDto(result);
}

export async function deleteRequestPartUsage(
  requestId: string,
  usageId: string,
  auth: AuthContext,
) {
  await assertCanAddParts(requestId, auth);

  const usage = await prisma.requestPartUsage.findFirst({
    where: { id: usageId, requestId },
  });
  if (!usage) throw new NotFoundError('Списание не найдено');

  const partsTotalBefore = await sumRequestPartsExpense(requestId);

  await prisma.$transaction(async (tx) => {
    if (usage.partId) {
      const part = await tx.part.findUnique({ where: { id: usage.partId } });
      if (part && part.section !== 'KFC') {
        await tx.part.update({
          where: { id: usage.partId },
          data: { quantity: { increment: usage.quantity } },
        });
      }
    }
    await tx.requestPartUsage.delete({ where: { id: usageId } });
  });

  await syncClosingFormPartsExpense(requestId, partsTotalBefore);

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.part_usage.delete',
    entityType: 'RequestPartUsage',
    entityId: usageId,
    after: { requestId, partName: usage.partNameSnapshot },
  });
}
