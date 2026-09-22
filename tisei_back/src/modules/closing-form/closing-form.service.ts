import { CommentType, Prisma, RequestStatus, type UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../../common/errors/AppError.js';
import { decimalToNumber, round2, toDecimal } from '../../common/utils/money.js';
import { isFieldRole } from '../../common/utils/roles.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { notifyRequestStatusChanged } from '../notifications/notification.service.js';
import { assertRequestAccess, assertRequestWriteAccess, type AuthContext } from '../requests/request-access.js';
import {
  calculateClosing,
  commissionRatesForRole,
  serializeClosingCalculation,
} from './calculate-closing.js';
import { assertClosingFormComplete } from './validate-closing.js';
import type { UpsertClosingFormBody } from './closing-form.schemas.js';
import {
  sumRequestPartsExpense,
  syncClosingFormPartsExpense,
} from '../parts/sync-closing-parts-expense.js';

async function resolveAssignedMasterRole(requestId: string): Promise<UserRole | null> {
  const assignment = await prisma.requestAssignment.findFirst({
    where: { requestId, status: 'accepted' },
    include: { executor: { select: { role: true } } },
    orderBy: { assignedAt: 'asc' },
  });
  return assignment?.executor.role ?? null;
}

async function assertRequestAccessForClosing(requestId: string, auth: AuthContext) {
  return assertRequestAccess(requestId, auth);
}

async function assertRequestWriteForClosing(requestId: string, auth: AuthContext) {
  return assertRequestWriteAccess(requestId, auth);
}

function toResponse(
  form: {
    id: string;
    requestId: string;
    executorId: string | null;
    executorName: string | null;
    requestNumberSnapshot: string | null;
    addressSnapshot: string | null;
    workPerformed: string | null;
    incomeAmount: Prisma.Decimal;
    expenseAmount: Prisma.Decimal;
    partsExpenseAmount: Prisma.Decimal;
    profit: Prisma.Decimal;
    companyCommission: Prisma.Decimal;
    executorPayout: Prisma.Decimal;
    isLocked: boolean;
    confirmedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  executorRole?: UserRole | null,
) {
  const partsExpense = decimalToNumber(form.partsExpenseAmount);
  const expense = decimalToNumber(form.expenseAmount);
  const rates = commissionRatesForRole(executorRole);
  return {
    id: form.id,
    requestId: form.requestId,
    executorId: form.executorId,
    executorName: form.executorName,
    requestNumberSnapshot: form.requestNumberSnapshot,
    addressSnapshot: form.addressSnapshot,
    workPerformed: form.workPerformed,
    incomeAmount: decimalToNumber(form.incomeAmount),
    expenseAmount: expense,
    partsExpenseAmount: partsExpense,
    additionalExpenseAmount: Math.max(0, expense - partsExpense),
    ...serializeClosingCalculation({
      profit: form.profit,
      companyCommission: form.companyCommission,
      executorPayout: form.executorPayout,
      companyCommissionRate: rates.companyRate,
      executorPayoutRate: rates.executorRate,
    }),
    isLocked: form.isLocked,
    confirmedAt: form.confirmedAt?.toISOString() ?? null,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
  };
}

export async function getClosingForm(requestId: string, auth: AuthContext) {
  const request = await assertRequestAccessForClosing(requestId, auth);

  await unlockStaleClosingFormIfRequestOpen(requestId, request.status);
  await syncClosingFormPartsExpense(requestId);

  const form = await prisma.closingForm.findUnique({ where: { requestId } });
  if (!form) throw new NotFoundError('Анкета закрытия не найдена');

  const executorRole = await resolveAssignedMasterRole(requestId);
  return toResponse(form, executorRole);
}

/** Статусы, из которых заявку можно закрыть анкетой (включая «Повтор»). */
const CLOSABLE_VIA_FORM = new Set([
  'new',
  'in_progress',
  'awaiting_parts',
  'frozen',
  'in_service',
  'awaiting_approval',
  'repeat',
]);

/** Если заявка снова открыта, а анкета осталась locked — разблокируем для повторного закрытия. */
async function unlockStaleClosingFormIfRequestOpen(
  requestId: string,
  requestStatus: string,
): Promise<void> {
  if (requestStatus === 'closed' || requestStatus === 'cancelled') return;
  await prisma.closingForm.updateMany({
    where: { requestId, isLocked: true },
    data: { isLocked: false, confirmedAt: null },
  });
}

export async function upsertClosingForm(
  requestId: string,
  body: UpsertClosingFormBody,
  auth: AuthContext,
) {
  const request = await assertRequestWriteForClosing(requestId, auth);
  await unlockStaleClosingFormIfRequestOpen(requestId, request.status);

  const existing = await prisma.closingForm.findUnique({ where: { requestId } });

  if (existing?.isLocked && isFieldRole(auth.role)) {
    throw new ForbiddenError('Анкета закрыта и недоступна для редактирования');
  }

  const partsTotal = await sumRequestPartsExpense(requestId);
  const additionalExpense =
    body.additionalExpenseAmount !== undefined
      ? body.additionalExpenseAmount
      : Math.max(0, (body.expenseAmount ?? 0) - partsTotal);
  const totalExpense = partsTotal + additionalExpense;

  const assignedRole = await resolveAssignedMasterRole(requestId);
  const executorRole = assignedRole ?? (isFieldRole(auth.role) ? auth.role : null);

  const financials = calculateClosing({
    incomeAmount: body.incomeAmount,
    expenseAmount: totalExpense,
    executorRole,
  });

  const executor = await prisma.user.findUnique({ where: { id: auth.userId } });

  const data = {
    workPerformed: body.workPerformed,
    incomeAmount: round2(toDecimal(body.incomeAmount)),
    partsExpenseAmount: round2(toDecimal(partsTotal)),
    expenseAmount: round2(toDecimal(totalExpense)),
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
    existing?.isLocked && !isFieldRole(auth.role)
      ? 'скорректировано после закрытия'
      : undefined;

  await writeAuditLog({
    userId: auth.userId,
    action: existing ? 'closing_form.update' : 'closing_form.create',
    entityType: 'ClosingForm',
    entityId: form.id,
    after: { ...serializeClosingCalculation(financials), note: auditNote },
  });

  return toResponse(form, executorRole);
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

  const requestBefore = await assertRequestWriteForClosing(requestId, auth);
  if (!CLOSABLE_VIA_FORM.has(requestBefore.status)) {
    throw new BadRequestError(
      requestBefore.status === 'closed'
        ? 'Заявка уже закрыта'
        : 'В текущем статусе заявку нельзя закрыть через анкету',
    );
  }
  await unlockStaleClosingFormIfRequestOpen(requestId, requestBefore.status);

  await upsertClosingForm(requestId, body, auth);

  const form = await prisma.closingForm.findUnique({ where: { requestId } });

  if (!form) throw new NotFoundError('Анкета закрытия не заполнена');
  if (form.isLocked) throw new ConflictError('Анкета уже подтверждена');

  const existing = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      number: true,
      companyOrFullName: true,
      status: true,
    },
  });
  if (!existing) throw new NotFoundError('Заявка не найдена');
  if (!CLOSABLE_VIA_FORM.has(existing.status)) {
    throw new BadRequestError('В текущем статусе заявку нельзя закрыть через анкету');
  }

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

    await tx.comment.create({
      data: {
        requestId,
        authorId: auth.userId,
        type: CommentType.system_event,
        text: 'Анкета закрытия подтверждена. Заявка закрыта.',
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

  void notifyRequestStatusChanged(
    {
      id: existing.id,
      number: existing.number,
      companyOrFullName: existing.companyOrFullName,
    },
    existing.status,
    RequestStatus.closed,
    { excludeUserId: auth.userId },
  ).catch(() => {
    /* уведомления не блокируют закрытие */
  });

  return toResponse(confirmed);
}
