import { z } from 'zod';
import { cuidSchema } from '../../common/validation/common.schemas.js';

export const routingTodayQuerySchema = z.object({
  executorId: cuidSchema.optional(),
  date: z.coerce.date().optional(),
});

export const optimizeRouteBodySchema = z.object({
  executorId: cuidSchema.optional(),
  requestIds: z.array(cuidSchema).min(1),
  startLat: z.number().optional(),
  startLon: z.number().optional(),
});

export const mapOverviewQuerySchema = z.object({
  status: z
    .enum([
      'new',
      'in_progress',
      'awaiting_parts',
      'frozen',
      'in_service',
      'awaiting_approval',
      'repeat',
      'closed',
      'cancelled',
    ])
    .optional(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  executorId: cuidSchema.optional(),
  unassigned: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
});

export type RoutingTodayQuery = z.infer<typeof routingTodayQuerySchema>;
export type OptimizeRouteBody = z.infer<typeof optimizeRouteBodySchema>;
export type MapOverviewQuery = z.infer<typeof mapOverviewQuerySchema>;
