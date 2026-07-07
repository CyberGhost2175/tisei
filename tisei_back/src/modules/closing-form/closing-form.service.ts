import { Prisma, RequestStatus } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../../common/errors/AppError.js';
import { decimalToNumber, round2, toDecimal } from '../../common/utils/money.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { assertRequestAccess, assertRequestWriteAccess, type AuthContext } from '../requests/request-access.js';
import { calculateClosing, serializeClosingCalculation } from './calculate-closing.js';
import { assertClosingFormComplete } from './validate-closing.js';
import type { UpsertClosingFormBody } from './closing-form.schemas.js';

async function assertRequestAccessForClosing(requestId: string, auth: AuthContext) {
  return assertRequestAccess(requestId, auth);
}

async function assertRequestWriteForClosing(requestId: string, auth: AuthContext) {
  return assertRequestWriteAccess(requestId, auth);
}

function toResponse(form: {
  id: string;
  requestId: string;
  executorId: string | null;
  executorName: string | null;
  requestNumberSnapshot: string | null;
  addressSnapshot: string | null;
  workPerformed: string | null;
  incomeAmount: Prisma.Decimal;
  expenseAmount: Prisma.Decimal;
  profit: Prisma.Decimal;
  companyCommission: Prisma.Decimal;
  executorPayout: Prisma.Decimal;
  isLocked: boolean;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: form.id,
    requestId: form.requestId,
    executorId: form.executorId,
    executorName: form.executorName,
    requestNumberSnapshot: form.requestNumberSnapshot,
    addressSnapshot: form.addressSnapshot,
    workPerformed: form.workPerformed,
    incomeAmount: decimalToNumber(form.incomeAmount),
    expenseAmount: decimalToNumber(form.expenseAmount),
    ...serializeClosingCalculation({
      profit: form.profit,
      companyCommission: form.companyCommission,
      executorPayout: form.executorPayout,
    }),
    isLocked: form.isLocked,
    confirmedAt: form.confirmedAt?.toISOString() ?? null,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
  };
}

export async function getClosingForm(requestId: string, auth: AuthContext) {
  await assertRequestAccessForClosing(requestId, auth);

  const form = await prisma.closingForm.findUnique({ where: { requestId } });
  if (!form) throw new NotFoundError('Анкета закрытия не найдена');

  return toResponse(form);
}

export async function upsertClosingForm(
  requestId: string,
  body: UpsertClosingFormBody,
  auth: AuthContext,
) {
  const request = await assertRequestWriteForClosing(requestId, auth);
  const existing = await prisma.closingForm.findUnique({ where: { requestId } });

  if (existing?.isLocked && auth.role === 'executor') {
    throw new ForbiddenError('Анкета закрыта и недоступна для редактирования');
  }

  const financials = calculateClosing({
    incomeAmount: body.incomeAmount,
    expenseAmount: body.expenseAmount,
  });

  const executor = await prisma.user.findUnique({ where: { id: auth.userId } });

  const data = {
    workPerformed: body.workPerformed,
    incomeAmount: round2(toDecimal(body.incomeAmount)),
    expenseAmount: round2(toDecimal(body.expenseAmount)),
    profit: financials.profit,
    companyCommission: financials.companyCommission,
    executorPayout: financials.executorPayout,
    executorId: auth.userId,
    executorName: executor?.fullName ?? null,
    requestNumberSnapshot: request.number,
    addressSnapshot: request.address,
  };

  const form = existing
    ? await prisma.closingForm.update({ where: { requestId }, data })
    : await prisma.closingForm.create({ data: { requestId, ...data } });

  // Sync laborCost on request with income amount
  await prisma.request.update({
    where: { id: requestId },
    data: { laborCost: data.incomeAmount },
  });

  const auditNote =
    existing?.isLocked && auth.role !== 'executor'
      ? 'скорректировано после закрытия'
      : undefined;

  await writeAuditLog({
    userId: auth.userId,
    action: existing ? 'closing_form.update' : 'closing_form.create',
    entityType: 'ClosingForm',
    entityId: form.id,
    after: { ...serializeClosingCalculation(financials), note: auditNote },
  });

  return toResponse(form);
}

export async function confirmClosingForm(
  requestId: string,
  auth: AuthContext,
  body?: UpsertClosingFormBody,
) {
  if (!body) {
    throw new BadRequestError('Заполните анкету закрытия перед подтверждением');
  }

  assertClosingFormComplete(body);
  await upsertClosingForm(requestId, body, auth);

  await assertRequestWriteForClosing(requestId, auth);
  const form = await prisma.closingForm.findUnique({ where: { requestId } });

  if (!form) throw new NotFoundError('Анкета закрытия не заполнена');
  if (form.isLocked) throw new ConflictError('Анкета уже подтверждена');

  const confirmed = await prisma.$transaction(async (tx) => {
    const updatedForm = await tx.closingForm.update({
      where: { requestId },
      data: { isLocked: true, confirmedAt: new Date() },
    });

    await tx.request.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.closed,
        closedAt: new Date(),
        laborCost: form.incomeAmount,
      },
    });

    return updatedForm;
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'closing_form.confirm',
    entityType: 'ClosingForm',
    entityId: confirmed.id,
    after: { requestId, status: RequestStatus.closed },
  });

  return toResponse(confirmed);
}
