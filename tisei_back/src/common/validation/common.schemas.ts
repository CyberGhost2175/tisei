import { z } from 'zod';

export const cuidSchema = z.string().min(1, 'ID обязателен');

export const idParamSchema = z.object({
  id: cuidSchema,
});

export const emailSchema = z.string().email('Некорректный email').toLowerCase();

// Loose international phone: digits, +, spaces, dashes, parens
export const phoneSchema = z
  .string()
  .min(5)
  .max(32)
  .regex(/^[+()\d\s-]+$/, 'Некорректный номер телефона');

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

/** Reusable "success" envelope schema for OpenAPI responses. */
export const messageResponseSchema = z.object({
  message: z.string(),
});

export const errorResponseSchema = z.object({
  error: z.object({
    statusCode: z.number(),
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
