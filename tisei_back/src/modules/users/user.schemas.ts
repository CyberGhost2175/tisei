import { z } from 'zod';
import { cuidSchema, emailSchema, phoneSchema } from '../../common/validation/common.schemas.js';
import { paginationSchema } from '../../common/utils/pagination.js';

export const userRoleSchema = z.enum(['manager', 'executor', 'master', 'admin']);

export const userListQuerySchema = paginationSchema.extend({
  role: userRoleSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
});

export const createUserBodySchema = z.object({
  fullName: z.string().min(1).max(255),
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: z.string().min(8).optional(),
  role: userRoleSchema,
  specialization: z.array(z.string()).default([]),
  avatarUrl: z.string().url().optional(),
});

export const updateUserBodySchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional().nullable(),
  role: userRoleSchema.optional(),
  specialization: z.array(z.string()).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  is2faEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const userIdParamSchema = z.object({ id: cuidSchema });

export const adminResetPasswordBodySchema = z.object({
  newPassword: z.string().min(8).optional(),
  sendEmail: z.boolean().default(true),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
