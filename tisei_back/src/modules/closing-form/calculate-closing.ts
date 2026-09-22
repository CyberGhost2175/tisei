import { Prisma, type UserRole } from '@prisma/client';
import { round2, toDecimal } from '../../common/utils/money.js';
import { isPartnerMaster } from '../../common/utils/roles.js';

export interface ClosingCalculationInput {
  incomeAmount: number | string | Prisma.Decimal;
  expenseAmount: number | string | Prisma.Decimal;
  /** Роль назначенного мастера — влияет на % в кассу. */
  executorRole?: UserRole | null;
}

export interface ClosingCalculationResult {
  profit: Prisma.Decimal;
  companyCommission: Prisma.Decimal;
  executorPayout: Prisma.Decimal;
  companyCommissionRate: number;
  executorPayoutRate: number;
}

/** Штатный мастер — 10% в кассу; партнёрский мастер — 20%. */
export function commissionRatesForRole(role?: UserRole | null): {
  company: Prisma.Decimal;
  executor: Prisma.Decimal;
  companyRate: number;
  executorRate: number;
} {
  if (role && isPartnerMaster(role)) {
    return {
      company: new Prisma.Decimal('0.20'),
      executor: new Prisma.Decimal('0.80'),
      companyRate: 0.2,
      executorRate: 0.8,
    };
  }
  return {
    company: new Prisma.Decimal('0.10'),
    executor: new Prisma.Decimal('0.90'),
    companyRate: 0.1,
    executorRate: 0.9,
  };
}

/**
 * Pure financial calculation for the closing form.
 * Always recomputed server-side — client-supplied profit/payout values are ignored.
 */
export function calculateClosing(input: ClosingCalculationInput): ClosingCalculationResult {
  const income = round2(toDecimal(input.incomeAmount));
  const expense = round2(toDecimal(input.expenseAmount));
  const profit = round2(income.minus(expense));
  const rates = commissionRatesForRole(input.executorRole);
  const companyCommission = round2(profit.mul(rates.company));
  const executorPayout = round2(profit.mul(rates.executor));

  return {
    profit,
    companyCommission,
    executorPayout,
    companyCommissionRate: rates.companyRate,
    executorPayoutRate: rates.executorRate,
  };
}

export function serializeClosingCalculation(result: ClosingCalculationResult): {
  profit: number;
  companyCommission: number;
  executorPayout: number;
  companyCommissionRate: number;
  executorPayoutRate: number;
} {
  return {
    profit: result.profit.toNumber(),
    companyCommission: result.companyCommission.toNumber(),
    executorPayout: result.executorPayout.toNumber(),
    companyCommissionRate: result.companyCommissionRate,
    executorPayoutRate: result.executorPayoutRate,
  };
}
