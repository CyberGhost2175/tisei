import { z } from 'zod';

export const reportTypeSchema = z.enum([
  'requests_by_status',
  'requests_by_executor',
  'financial_summary',
  'overdue_requests',
  'client_types',
]);

export const analyticsDateRangeSchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const analyticsExportQuerySchema = analyticsDateRangeSchema.extend({
  format: z.enum(['csv', 'json']).default('csv'),
  type: reportTypeSchema.default('requests_by_status'),
});

export const executorKpiPeriodSchema = z.enum(['day', 'week', 'month']);

export const executorKpiQuerySchema = z.object({
  period: executorKpiPeriodSchema.default('day'),
  search: z.string().optional(),
});

export const executorKpiDetailParamsSchema = z.object({
  executorId: z.string(),
});

export const executorKpiDetailQuerySchema = z.object({
  period: executorKpiPeriodSchema.default('day'),
});

export type ReportType = z.infer<typeof reportTypeSchema>;
export type ExecutorKpiPeriod = z.infer<typeof executorKpiPeriodSchema>;
