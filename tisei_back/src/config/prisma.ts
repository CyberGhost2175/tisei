import { PrismaClient } from '@prisma/client';
import { env, isProd } from './env.js';

/**
 * Singleton Prisma client. In dev we cache on globalThis to survive HMR reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!isProd) {
  globalForPrisma.prisma = prisma;
}

export type Prisma = typeof prisma;

void env; // ensure env is validated before prisma is used
