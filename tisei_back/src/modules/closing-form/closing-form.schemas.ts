import { z } from 'zod';

export const upsertClosingFormBodySchema = z.object({
  workPerformed: z.string().max(10000).optional(),
  incomeAmount: z.coerce.number().min(0),
  expenseAmount: z.coerce.number().min(0),
  // profit / companyCommission / executorPayout intentionally excluded — server-side only
});

export const closingFormResponseSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  executorId: z.string().nullable(),
  executorName: z.string().nullable(),
  requestNumberSnapshot: z.string().nullable(),
  addressSnapshot: z.string().nullable(),
  workPerformed: z.string().nullable(),
  incomeAmount: z.number(),
  expenseAmount: z.number(),
  profit: z.number(),
  companyCommission: z.number(),
  executorPayout: z.number(),
  isLocked: z.boolean(),
  confirmedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UpsertClosingFormBody = z.infer<typeof upsertClosingFormBodySchema>;
