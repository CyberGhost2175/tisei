import type { ThemeMode } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export async function getUserSettings(userId: string) {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, theme: 'light' },
    update: {},
  });

  return { theme: settings.theme as ThemeMode };
}

export async function updateUserSettings(userId: string, theme: ThemeMode) {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, theme },
    update: { theme },
  });

  return { theme: settings.theme };
}
