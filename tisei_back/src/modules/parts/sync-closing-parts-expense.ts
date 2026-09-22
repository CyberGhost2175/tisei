import type { UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { decimalToNumber, round2, toDecimal } from '../../common/utils/money.js';
import { calculateClosing } from '../closing-form/calculate-closing.js';

export async function sumRequestPartsExpense(requestId: string): Promise<number> {
  const agg = await prisma.requestPartUsage.aggregate({
    where: { requestId },
    _sum: { lineTotal: true },
  });
  return decimalToNumber(agg._sum.lineTotal);
}

async function resolveAssignedMasterRole(requestId: string): Promise<UserRole | null> {
  const assignment = await prisma.requestAssignment.findFirst({
    where: { requestId, status: 'accepted' },
    include: { executor: { select: { role: true } } },
    orderBy: { assignedAt: 'asc' },
  });
  return assignment?.executor.role ?? null;
}

/** Синхронизирует расход в анкете закрытия с суммой списанных запчастей. */
export async function syncClosingFormPartsExpense(
  requestId: string,
  partsTotalBefore?: number,
): Promise<number> {
  const partsTotal = await sumRequestPartsExpense(requestId);
  const form = await prisma.closingForm.findUnique({ where: { requestId } });
  const executorRole = await resolveAssignedMasterRole(requestId);

  if (!form) {
    if (partsTotal <= 0) return 0;
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { number: true, address: true },
    });
    if (!request) return partsTotal;

    const partsDecimal = round2(toDecimal(partsTotal));
    const financials = calculateClosing({
      incomeAmount: 0,
      expenseAmount: partsTotal,
      executorRole,
    });
    await prisma.closingForm.create({
      data: {
        requestId,
        requestNumberSnapshot: request.number,
        addressSnapshot: request.address,
        partsExpenseAmount: partsDecimal,
        expenseAmount: partsDecimal,
        profit: financials.profit,
        companyCommission: financials.companyCommission,
        executorPayout: financials.executorPayout,
      },
    });
    return partsTotal;
  }

  if (form.isLocked) return partsTotal;

  const prevParts =
    partsTotalBefore !== undefined
      ? partsTotalBefore
      : decimalToNumber(form.partsExpenseAmount);
  const currentExpense = decimalToNumber(form.expenseAmount);
  const additional = Math.max(0, currentExpense - prevParts);
  const newExpense = round2(toDecimal(additional + partsTotal));
  const partsDecimal = round2(toDecimal(partsTotal));

  const financials = calculateClosing({
    incomeAmount: decimalToNumber(form.incomeAmount),
    expenseAmount: decimalToNumber(newExpense),
    executorRole,
  });

  await prisma.closingForm.update({
    where: { requestId },
    data: {
      partsExpenseAmount: partsDecimal,
      expenseAmount: newExpense,
      profit: financials.profit,
      companyCommission: financials.companyCommission,
      executorPayout: financials.executorPayout,
    },
  });

  return partsTotal;
}
