import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { decimalToNumber } from '../../common/utils/money.js';
import type { ReportType, ExecutorKpiPeriod } from './analytics.schemas.js';

interface DateRange {
  dateFrom?: Date;
  dateTo?: Date;
}

function dateFilter(range: DateRange): Prisma.RequestWhereInput {
  if (!range.dateFrom && !range.dateTo) return {};
  return {
    createdAt: {
      ...(range.dateFrom ? { gte: range.dateFrom } : {}),
      ...(range.dateTo ? { lte: range.dateTo } : {}),
    },
  };
}

export async function getExecutorDashboard(executorId: string) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const mine = { deletedAt: null, assignments: { some: { executorId } } };

  const [active, todayNew, inProgress, closedToday, overdue, partnerActive] = await Promise.all([
    prisma.request.count({
      where: { ...mine, status: { notIn: ['closed', 'cancelled'] } },
    }),
    prisma.request.count({
      where: { ...mine, createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.request.count({
      where: { ...mine, status: 'in_progress' },
    }),
    prisma.request.count({
      where: {
        ...mine,
        status: 'closed',
        closedAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.request.count({
      where: {
        ...mine,
        deadline: { lt: now },
        status: { notIn: ['closed', 'cancelled'] },
      },
    }),
    prisma.request.count({
      where: {
        ...mine,
        status: { notIn: ['closed', 'cancelled'] },
        partnerEstablishmentId: { not: null },
      },
    }),
  ]);

  return {
    kpi: {
      totalRequests: active,
      todayRequests: todayNew,
      overdueRequests: overdue,
      closedRequests: closedToday,
      activeExecutors: 0,
      inProgress,
      partnerActive,
      byStatus: {
        in_progress: inProgress,
      },
      financials: {
        totalIncome: 0,
        totalExpense: 0,
        totalProfit: 0,
        companyCommission: 0,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function getDashboard(range: DateRange = {}) {
  const baseWhere: Prisma.RequestWhereInput = { deletedAt: null, ...dateFilter(range) };
  const now = new Date();

  const [
    total,
    byStatus,
    overdue,
    closedThisMonth,
    financialAgg,
    activeExecutors,
  ] = await Promise.all([
    prisma.request.count({ where: baseWhere }),
    prisma.request.groupBy({ by: ['status'], where: baseWhere, _count: true }),
    prisma.request.count({
      where: {
        ...baseWhere,
        deadline: { lt: now },
        status: { notIn: ['closed', 'cancelled'] },
      },
    }),
    prisma.request.count({
      where: { ...baseWhere, status: 'closed' },
    }),
    prisma.closingForm.aggregate({
      _sum: { incomeAmount: true, expenseAmount: true, profit: true, companyCommission: true },
      where: {
        confirmedAt: { not: null },
        ...(range.dateFrom || range.dateTo
          ? {
              confirmedAt: {
                ...(range.dateFrom ? { gte: range.dateFrom } : {}),
                ...(range.dateTo ? { lte: range.dateTo } : {}),
              },
            }
          : {}),
      },
    }),
    prisma.user.count({ where: { role: { in: ['executor', 'master'] }, isActive: true } }),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));

  return {
    kpi: {
      totalRequests: total,
      overdueRequests: overdue,
      closedRequests: closedThisMonth,
      activeExecutors,
      byStatus: statusMap,
      financials: {
        totalIncome: decimalToNumber(financialAgg._sum.incomeAmount),
        totalExpense: decimalToNumber(financialAgg._sum.expenseAmount),
        totalProfit: decimalToNumber(financialAgg._sum.profit),
        companyCommission: decimalToNumber(financialAgg._sum.companyCommission),
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function getReport(type: ReportType, range: DateRange = {}) {
  const baseWhere: Prisma.RequestWhereInput = { deletedAt: null, ...dateFilter(range) };

  switch (type) {
    case 'requests_by_status': {
      const rows = await prisma.request.groupBy({ by: ['status'], where: baseWhere, _count: true });
      return { type, rows: rows.map((r) => ({ status: r.status, count: r._count })) };
    }

    case 'requests_by_executor': {
      const assignments = await prisma.requestAssignment.groupBy({
        by: ['executorId'],
        _count: true,
        where: { request: baseWhere },
      });
      const executors = await prisma.user.findMany({
        where: { id: { in: assignments.map((a) => a.executorId) } },
        select: { id: true, fullName: true },
      });
      const nameMap = new Map(executors.map((e) => [e.id, e.fullName]));
      return {
        type,
        rows: assignments.map((a) => ({
          executorId: a.executorId,
          executorName: nameMap.get(a.executorId) ?? 'Unknown',
          count: a._count,
        })),
      };
    }

    case 'financial_summary': {
      const forms = await prisma.closingForm.findMany({
        where: {
          confirmedAt: { not: null },
          ...(range.dateFrom || range.dateTo
            ? {
                confirmedAt: {
                  ...(range.dateFrom ? { gte: range.dateFrom } : {}),
                  ...(range.dateTo ? { lte: range.dateTo } : {}),
                },
              }
            : {}),
        },
        include: { request: { select: { number: true } } },
        orderBy: { confirmedAt: 'desc' },
        take: 500,
      });
      return {
        type,
        rows: forms.map((f) => ({
          requestNumber: f.requestNumberSnapshot ?? f.request.number,
          executorName: f.executorName,
          income: decimalToNumber(f.incomeAmount),
          expense: decimalToNumber(f.expenseAmount),
          profit: decimalToNumber(f.profit),
          companyCommission: decimalToNumber(f.companyCommission),
          executorPayout: decimalToNumber(f.executorPayout),
          confirmedAt: f.confirmedAt?.toISOString(),
        })),
      };
    }

    case 'overdue_requests': {
      const now = new Date();
      const requests = await prisma.request.findMany({
        where: {
          ...baseWhere,
          deadline: { lt: now },
          status: { notIn: ['closed', 'cancelled'] },
        },
        select: {
          id: true,
          number: true,
          companyOrFullName: true,
          deadline: true,
          status: true,
          priority: true,
        },
        orderBy: { deadline: 'asc' },
      });
      return {
        type,
        rows: requests.map((r) => ({
          ...r,
          deadline: r.deadline?.toISOString() ?? null,
        })),
      };
    }

    case 'client_types': {
      const rows = await prisma.request.groupBy({
        by: ['clientType'],
        where: baseWhere,
        _count: true,
      });
      return { type, rows: rows.map((r) => ({ clientType: r.clientType, count: r._count })) };
    }

    default:
      return { type, rows: [] };
  }
}

export function reportToCsv(type: ReportType, data: { rows: Record<string, unknown>[] }): string {
  if (data.rows.length === 0) return 'no data\n';

  const headers = Object.keys(data.rows[0]!);
  const lines = [
    headers.join(','),
    ...data.rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val == null ? '' : String(val);
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(','),
    ),
  ];
  return `# Report: ${type}\n${lines.join('\n')}\n`;
}

function periodRange(period: ExecutorKpiPeriod): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  if (period === 'week') {
    const day = from.getDay();
    const diff = day === 0 ? 6 : day - 1;
    from.setDate(from.getDate() - diff);
  } else if (period === 'month') {
    from.setDate(1);
  }

  return { from, to };
}

/** КПД мастеров: сколько заявок взяли за день / неделю / месяц. */
export async function getExecutorKpi(period: ExecutorKpiPeriod, search?: string) {
  const { from, to } = periodRange(period);

  const executors = await prisma.user.findMany({
    where: {
      role: { in: ['executor', 'master'] },
      isActive: true,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: 'asc' },
  });

  const [claimed, closed, profits] = await Promise.all([
    prisma.requestAssignment.groupBy({
      by: ['executorId'],
      where: { assignedAt: { gte: from, lte: to } },
      _count: true,
    }),
    prisma.closingForm.groupBy({
      by: ['executorId'],
      where: {
        executorId: { not: null },
        confirmedAt: { gte: from, lte: to },
      },
      _count: true,
    }),
    prisma.closingForm.groupBy({
      by: ['executorId'],
      where: {
        executorId: { not: null },
        confirmedAt: { gte: from, lte: to },
      },
      _sum: { profit: true },
    }),
  ]);

  const claimedMap = new Map(claimed.map((c) => [c.executorId, c._count]));
  const closedMap = new Map(
    closed.filter((c) => c.executorId).map((c) => [c.executorId!, c._count]),
  );
  const profitMap = new Map(
    profits
      .filter((p) => p.executorId)
      .map((p) => [p.executorId!, decimalToNumber(p._sum.profit)]),
  );

  const rows = executors
    .map((e) => ({
      executorId: e.id,
      executorName: e.fullName,
      email: e.email,
      claimed: claimedMap.get(e.id) ?? 0,
      closed: closedMap.get(e.id) ?? 0,
      earned: profitMap.get(e.id) ?? 0,
    }))
    .sort((a, b) => b.earned - a.earned || b.claimed - a.claimed || b.closed - a.closed);

  return {
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    totalClaimed: rows.reduce((s, r) => s + r.claimed, 0),
    totalClosed: rows.reduce((s, r) => s + r.closed, 0),
    rows,
  };
}

/** Детализация КПД мастера: какие заявки взял и закрыл за период. */
export async function getExecutorKpiDetail(executorId: string, period: ExecutorKpiPeriod) {
  const executor = await prisma.user.findFirst({
    where: { id: executorId, role: { in: ['executor', 'master'] }, isActive: true },
    select: { id: true, fullName: true, email: true },
  });
  if (!executor) throw new NotFoundError('Мастер не найден');

  const { from, to } = periodRange(period);

  const [assignments, closedForms] = await Promise.all([
    prisma.requestAssignment.findMany({
      where: { executorId, assignedAt: { gte: from, lte: to } },
      include: {
        request: {
          select: {
            id: true,
            number: true,
            companyOrFullName: true,
            address: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.closingForm.findMany({
      where: {
        executorId,
        confirmedAt: { gte: from, lte: to },
      },
      include: {
        request: {
          select: {
            id: true,
            number: true,
            companyOrFullName: true,
            address: true,
            status: true,
            priority: true,
          },
        },
      },
      orderBy: { confirmedAt: 'desc' },
    }),
  ]);

  return {
    executor,
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    claimed: assignments.map((a) => ({
      requestId: a.request.id,
      number: a.request.number,
      companyOrFullName: a.request.companyOrFullName,
      address: a.request.address,
      status: a.request.status,
      priority: a.request.priority,
      assignedAt: a.assignedAt.toISOString(),
    })),
    closed: closedForms.map((f) => ({
      requestId: f.requestId,
      number: f.requestNumberSnapshot ?? f.request.number,
      companyOrFullName: f.request.companyOrFullName,
      address: f.addressSnapshot ?? f.request.address,
      status: f.request.status,
      priority: f.request.priority,
      workPerformed: f.workPerformed,
      incomeAmount: decimalToNumber(f.incomeAmount),
      expenseAmount: decimalToNumber(f.expenseAmount),
      profit: decimalToNumber(f.profit),
      confirmedAt: f.confirmedAt?.toISOString() ?? null,
    })),
  };
}
