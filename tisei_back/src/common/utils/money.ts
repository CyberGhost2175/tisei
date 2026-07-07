import { Prisma } from '@prisma/client';

/**
 * Money is stored as Prisma.Decimal (14,2) — tenge with 2 decimal places.
 * These helpers keep rounding consistent (half-up to 2 decimals).
 */
export function toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** Round a Decimal to 2 decimal places, half-up. */
export function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  return value ? value.toNumber() : 0;
}
