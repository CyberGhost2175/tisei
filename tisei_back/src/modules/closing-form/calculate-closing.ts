import { Prisma } from '@prisma/client';
import { round2, toDecimal } from '../../common/utils/money.js';

export interface ClosingCalculationInput {
  incomeAmount: number | string | Prisma.Decimal;
  expenseAmount: number | string | Prisma.Decimal;
}

export interface ClosingCalculationResult {
  profit: Prisma.Decimal;
  companyCommission: Prisma.Decimal;
  executorPayout: Prisma.Decimal;
}

const COMMISSION_RATE = new Prisma.Decimal('0.10');
const EXECUTOR_RATE = new Prisma.Decimal('0.90');

/**
 * Pure financial calculation for the closing form.
 * Always recomputed server-side — client-supplied profit/payout values are ignored.
 */
export function calculateClosing(input: ClosingCalculationInput): ClosingCalculationResult {
  const income = round2(toDecimal(input.incomeAmount));
  const expense = round2(toDecimal(input.expenseAmount));
  const profit = round2(income.minus(expense));
  const companyCommission = round2(profit.mul(COMMISSION_RATE));
  const executorPayout = round2(profit.mul(EXECUTOR_RATE));

  return { profit, companyCommission, executorPayout };
}

export function serializeClosingCalculation(result: ClosingCalculationResult): {
  profit: number;
  companyCommission: number;
  executorPayout: number;
} {
  return {
    profit: result.profit.toNumber(),
    companyCommission: result.companyCommission.toNumber(),
    executorPayout: result.executorPayout.toNumber(),
  };
}
