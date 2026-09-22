import { z } from 'zod';
import { emailSchema } from '../../common/validation/common.schemas.js';

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Пароль должен содержать минимум 8 символов'),
});

export const verify2faBodySchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().length(6, 'Код TOTP должен содержать 6 цифр'),
});

export const totpCodeBodySchema = z.object({
  code: z.string().length(6, 'Код TOTP должен содержать 6 цифр'),
});

export const disable2faBodySchema = z.object({
  password: z.string().min(8),
  code: z.string().length(6),
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Пароль должен содержать минимум 8 символов'),
});

export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1, 'Укажите текущий пароль'),
    newPassword: z.string().min(8, 'Новый пароль должен содержать минимум 8 символов'),
    confirmPassword: z.string().min(8, 'Подтвердите новый пароль'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Новый пароль должен отличаться от текущего',
    path: ['newPassword'],
  });

export const authTokensResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    fullName: z.string(),
    role: z.enum(['manager', 'executor', 'master', 'admin']),
    is2faEnabled: z.boolean(),
  }),
});

export const loginResponseSchema = z.object({
  requires2fa: z.boolean().optional(),
  pendingToken: z.string().optional(),
  accessToken: z.string().optional(),
  expiresIn: z.string().optional(),
  user: z
    .object({
      id: z.string(),
      email: z.string(),
      fullName: z.string(),
      role: z.enum(['manager', 'executor', 'master', 'admin']),
      is2faEnabled: z.boolean(),
    })
    .optional(),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type Verify2faBody = z.infer<typeof verify2faBodySchema>;
