import { prisma } from '../../config/prisma.js';
import type { RegisterDeviceTokenBody } from './notification.schemas.js';

type DevicePlatform = 'ios' | 'android' | 'web';

function toDto(row: {
  id: string;
  token: string;
  platform: string;
  deviceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    token: row.token,
    platform: row.platform as DevicePlatform,
    deviceId: row.deviceId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Register or refresh an FCM device token for the authenticated user.
 * Same token moved to a new user is reassigned (logout/login on shared device).
 * Optional deviceId upserts per-device so reinstalls with a new token replace the old one.
 */
export async function registerDeviceToken(userId: string, body: RegisterDeviceTokenBody) {
  const existingByToken = await prisma.devicePushToken.findUnique({
    where: { token: body.token },
  });

  if (existingByToken) {
    const updated = await prisma.devicePushToken.update({
      where: { token: body.token },
      data: {
        userId,
        platform: body.platform,
        ...(body.deviceId !== undefined ? { deviceId: body.deviceId } : {}),
      },
    });
    return toDto(updated);
  }

  if (body.deviceId) {
    const existingByDevice = await prisma.devicePushToken.findFirst({
      where: { userId, deviceId: body.deviceId },
    });
    if (existingByDevice) {
      const updated = await prisma.devicePushToken.update({
        where: { id: existingByDevice.id },
        data: { token: body.token, platform: body.platform },
      });
      return toDto(updated);
    }
  }

  const created = await prisma.devicePushToken.create({
    data: {
      userId,
      token: body.token,
      platform: body.platform,
      deviceId: body.deviceId,
    },
  });
  return toDto(created);
}

export async function unregisterDeviceToken(userId: string, token: string) {
  const result = await prisma.devicePushToken.deleteMany({
    where: { userId, token },
  });
  return { deleted: result.count };
}

export async function listDeviceTokens(userId: string) {
  const items = await prisma.devicePushToken.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
  return { items: items.map(toDto) };
}
