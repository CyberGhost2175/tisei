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

export type RoutingTodayQuery = z.infer<typeof routingTodayQuerySchema>;
export type OptimizeRouteBody = z.infer<typeof optimizeRouteBodySchema>;
