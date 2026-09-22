import { z } from 'zod';
import { cuidSchema } from '../../common/validation/common.schemas.js';

export const maintenancePeriodQuerySchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Формат периода: YYYY-MM')
    .optional(),
});

/** Query for opening act PDF in the browser (token via URL). */
export const maintenanceActPdfQuerySchema = maintenancePeriodQuerySchema.extend({
  access_token: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
});

export const partnerIdParamSchema = z.object({
  partnerId: cuidSchema,
});

export const requestIdParamSchema = z.object({
  requestId: cuidSchema,
});

export const updatePartnerMaintenanceBodySchema = z.object({
  maintenanceCloseDay: z.number().int().min(1).max(28).optional(),
  maintenanceUnitPrice: z.number().min(0).nullable().optional(),
  maintenanceCustomerName: z.string().max(500).nullable().optional(),
  maintenanceCustomerBin: z.string().max(32).nullable().optional(),
  maintenanceCustomerAddress: z.string().max(500).nullable().optional(),
  maintenanceContractNumber: z.string().max(100).nullable().optional(),
  maintenanceContractDate: z.coerce.date().nullable().optional(),
  maintenanceExecutorName: z.string().max(500).nullable().optional(),
  maintenanceExecutorBin: z.string().max(32).nullable().optional(),
  maintenanceExecutorAddress: z.string().max(500).nullable().optional(),
});

export const updatePeriodSettingBodySchema = z.object({
  closeByDate: z.coerce.date().optional(),
  actDate: z.coerce.date().nullable().optional(),
  actNumber: z.number().int().min(1).nullable().optional(),
});

export const closeMaintenanceBodySchema = z.object({
  findings: z.string().max(5000).optional(),
});

export const updateFindingsBodySchema = z.object({
  findings: z.string().max(5000),
});

export const transferToRepairBodySchema = z.object({
  findings: z.string().min(1).max(5000),
  problemDescription: z.string().max(5000).optional(),
});

export type UpdatePartnerMaintenanceBody = z.infer<typeof updatePartnerMaintenanceBodySchema>;
export type UpdatePeriodSettingBody = z.infer<typeof updatePeriodSettingBodySchema>;
export type CloseMaintenanceBody = z.infer<typeof closeMaintenanceBodySchema>;
export type TransferToRepairBody = z.infer<typeof transferToRepairBodySchema>;
