import { prisma } from '../../config/prisma.js';

function currentPeriod(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/**
 * Atomically generates the next request number for the current month.
 * Format: TiSei-YYYYMM-XXXX (4-digit sequence, zero-padded).
 */
export async function generateRequestNumber(): Promise<string> {
  const period = currentPeriod();

  const seq = await prisma.$transaction(async (tx) => {
    const row = await tx.requestSequence.upsert({
      where: { period },
      create: { period, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
    });
    return row.lastValue;
  });

  const padded = String(seq).padStart(4, '0');
  return `TiSei-${period}-${padded}`;
}
