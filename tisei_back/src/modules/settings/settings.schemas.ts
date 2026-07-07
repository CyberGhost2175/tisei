import { z } from 'zod';

export const themeModeSchema = z.enum(['light', 'dark', 'system']);

export const userSettingsResponseSchema = z.object({
  theme: themeModeSchema,
});

export const updateUserSettingsBodySchema = z.object({
  theme: themeModeSchema,
});

export type UpdateUserSettingsBody = z.infer<typeof updateUserSettingsBodySchema>;
