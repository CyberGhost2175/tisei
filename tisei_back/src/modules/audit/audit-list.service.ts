import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { buildPaginated, toSkipTake } from '../../common/utils/pagination.js';
import type { AuditListQuery } from './audit.schemas.js';

export async function listAuditLogs(query: AuditListQuery) {
  const where: Prisma.AuditLogWhereInput = {};

  if (query.userId) where.userId = query.userId;
  if (query.entityType) where.entityType = query.entityType;
  if (query.entityId) where.entityId = query.entityId;
  if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) where.createdAt.gte = query.dateFrom;
    if (query.dateTo) where.createdAt.lte = query.dateTo;
  }

  const { skip, take } = toSkipTake(query);
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const mapped = items.map((log) => ({
    id: log.id,
    userId: log.userId,
    user: log.user,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    before: log.before,
    after: log.after,
    createdAt: log.createdAt.toISOString(),
  }));

  return buildPaginated(mapped, total, query);
}
