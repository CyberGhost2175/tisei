import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { calculateClosing } from '../../src/modules/closing-form/calculate-closing.js';

describe('calculateClosing', () => {
  it('calculates profit and splits 10/90 for positive amounts', () => {
    const result = calculateClosing({ incomeAmount: 100_000, expenseAmount: 40_000 });
    expect(result.profit.toNumber()).toBe(60_000);
    expect(result.companyCommission.toNumber()).toBe(6_000);
    expect(result.executorPayout.toNumber()).toBe(54_000);
    expect(result.companyCommissionRate).toBe(0.1);
  });

  it('calculates profit and splits 20/80 for partner master', () => {
    const result = calculateClosing({
      incomeAmount: 100_000,
      expenseAmount: 40_000,
      executorRole: 'master',
    });
    expect(result.profit.toNumber()).toBe(60_000);
    expect(result.companyCommission.toNumber()).toBe(12_000);
    expect(result.executorPayout.toNumber()).toBe(48_000);
    expect(result.companyCommissionRate).toBe(0.2);
  });

  it('handles zero income and expense', () => {
    const result = calculateClosing({ incomeAmount: 0, expenseAmount: 0 });
    expect(result.profit.toNumber()).toBe(0);
    expect(result.companyCommission.toNumber()).toBe(0);
    expect(result.executorPayout.toNumber()).toBe(0);
  });

  it('handles expense greater than income (negative profit)', () => {
    const result = calculateClosing({ incomeAmount: 10_000, expenseAmount: 15_000 });
    expect(result.profit.toNumber()).toBe(-5_000);
    expect(result.companyCommission.toNumber()).toBe(-500);
    expect(result.executorPayout.toNumber()).toBe(-4_500);
  });

  it('rounds income/expense half-up before computing profit', () => {
    const result = calculateClosing({ incomeAmount: '100.005', expenseAmount: '33.333' });
    expect(result.profit.toFixed(2)).toBe('66.68');
    expect(result.companyCommission.toFixed(2)).toBe('6.67');
    expect(result.executorPayout.toFixed(2)).toBe('60.01');
  });

  it('accepts Prisma.Decimal inputs', () => {
    const result = calculateClosing({
      incomeAmount: new Prisma.Decimal('50000.50'),
      expenseAmount: new Prisma.Decimal('10000.25'),
    });
    expect(result.profit.toNumber()).toBe(40_000.25);
    expect(result.companyCommission.toNumber()).toBe(4_000.03);
    expect(result.executorPayout.toNumber()).toBe(36_000.23);
  });
});
