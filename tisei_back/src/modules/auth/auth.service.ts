import jwt from 'jsonwebtoken';
import type { FastifyReply } from 'fastify';
import { prisma } from '../../config/prisma.js';
import { env, isCookieSecure } from '../../config/env.js';
import {
  UnauthorizedError,
  BadRequestError,
} from '../../common/errors/AppError.js';
import { hashPassword, verifyPassword, generateOpaqueToken, sha256 } from '../../common/utils/crypto.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/utils/jwt.js';
import { getEmailProvider } from '../../common/email/email.factory.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { verifyTotpCode, generateTotpSecret, generateTotpQrDataUrl } from './totp.service.js';
import type { LoginBody, Verify2faBody } from './auth.schemas.js';

const REFRESH_COOKIE = 'tisei_refresh';
const PENDING_2FA_TTL = '5m';

export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  role: 'manager' | 'executor' | 'master' | 'admin';
  is2faEnabled: boolean;
}

export interface AuthTokensResult {
  accessToken: string;
  expiresIn: string;
  user: AuthUserDto;
}

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 15 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * (multipliers[unit] ?? 60_000);
}

function refreshExpiresAt(): Date {
  return new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_TTL));
}

function signPending2faToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'pending_2fa' }, env.JWT_ACCESS_SECRET, {
    expiresIn: PENDING_2FA_TTL,
  });
}

function verifyPending2faToken(token: string): string {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; type: string };
  if (decoded.type !== 'pending_2fa') throw new UnauthorizedError('Недействительный токен 2FA');
  return decoded.sub;
}

async function createSession(
  userId: string,
  meta: { ip?: string; userAgent?: string },
): Promise<{ refreshToken: string; accessToken: string; user: AuthUserDto }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const refreshToken = signRefreshToken({ sub: user.id, jti: generateOpaqueToken(16) });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      ip: meta.ip,
      userAgent: meta.userAgent,
      expiresAt: refreshExpiresAt(),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    email: user.email,
  });

  return {
    refreshToken,
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      is2faEnabled: user.is2faEnabled,
    },
  };
}

export function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isCookieSecure,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: parseDurationToMs(env.JWT_REFRESH_TTL) / 1000,
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

export async function login(
  body: LoginBody,
  meta: { ip?: string; userAgent?: string },
  reply?: FastifyReply,
): Promise<AuthTokensResult | { requires2fa: true; pendingToken: string }> {
  const user = await prisma.user.findUnique({ where: { email: body.email } });

  const fail = async () => {
    if (user) {
      await prisma.loginLog.create({
        data: { userId: user.id, ip: meta.ip, userAgent: meta.userAgent, success: false },
      });
    }
    throw new UnauthorizedError('Неверный email или пароль');
  };

  if (!user || !user.isActive) await fail();

  const valid = await verifyPassword(user!.passwordHash, body.password);
  if (!valid) await fail();

  await prisma.loginLog.create({
    data: { userId: user!.id, ip: meta.ip, userAgent: meta.userAgent, success: true },
  });

  if (user!.is2faEnabled) {
    return { requires2fa: true, pendingToken: signPending2faToken(user!.id) };
  }

  const session = await createSession(user!.id, meta);
  if (reply) setRefreshCookie(reply, session.refreshToken);

  return { accessToken: session.accessToken, expiresIn: env.JWT_ACCESS_TTL, user: session.user };
}

export async function verify2faAndLogin(
  body: Verify2faBody,
  meta: { ip?: string; userAgent?: string },
  reply: FastifyReply,
): Promise<AuthTokensResult> {
  const userId = verifyPending2faToken(body.pendingToken);
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.isActive || !user.is2faEnabled || !user.totpSecret) {
    throw new UnauthorizedError('2FA недоступна для этого пользователя');
  }

  if (!verifyTotpCode(user.totpSecret, body.code)) {
    throw new UnauthorizedError('Неверный код 2FA');
  }

  const session = await createSession(user.id, meta);
  setRefreshCookie(reply, session.refreshToken);
  return { accessToken: session.accessToken, expiresIn: env.JWT_ACCESS_TTL, user: session.user };
}

export async function refreshAccessToken(
  refreshTokenRaw: string | undefined,
  reply: FastifyReply,
): Promise<AuthTokensResult> {
  if (!refreshTokenRaw) {
    throw new UnauthorizedError('Refresh-токен отсутствует');
  }

  try {
    verifyRefreshToken(refreshTokenRaw);
  } catch {
    throw new UnauthorizedError('Недействительный refresh-токен');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(refreshTokenRaw) },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Сессия истекла или отозвана');
  }

  if (!stored.user.isActive) {
    throw new UnauthorizedError('Учётная запись деактивирована');
  }

  const idleMs = env.SESSION_IDLE_MINUTES * 60_000;
  if (Date.now() - stored.lastUsedAt.getTime() > idleMs) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    clearRefreshCookie(reply);
    throw new UnauthorizedError('Сессия истекла из-за бездействия');
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { lastUsedAt: new Date() },
  });

  const accessToken = signAccessToken({
    sub: stored.user.id,
    role: stored.user.role,
    email: stored.user.email,
  });

  return {
    accessToken,
    expiresIn: env.JWT_ACCESS_TTL,
    user: {
      id: stored.user.id,
      email: stored.user.email,
      fullName: stored.user.fullName,
      role: stored.user.role,
      is2faEnabled: stored.user.is2faEnabled,
    },
  };
}

export async function logout(refreshTokenRaw: string | undefined, reply: FastifyReply): Promise<void> {
  if (refreshTokenRaw) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshTokenRaw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearRefreshCookie(reply);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return;

  const rawToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000);

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(rawToken), expiresAt },
  });

  const resetUrl = `${env.FRONTEND_CRM_URL}/reset-password?token=${rawToken}`;
  await getEmailProvider().send({
    to: user.email,
    subject: 'Сброс пароля Береке ТехСервис CRM',
    html: `<p>Для сброса пароля перейдите по ссылке (действует ${env.PASSWORD_RESET_TTL_MINUTES} мин.):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    text: `Сброс пароля: ${resetUrl}`,
  });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new BadRequestError('Недействительный или просроченный токен сброса пароля');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Пользователь не найден');
  }

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) {
    throw new UnauthorizedError('Неверный текущий пароль');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await writeAuditLog({
    userId,
    action: 'auth.change_password',
    entityType: 'User',
    entityId: userId,
  });

  return { message: 'Пароль успешно изменён' };
}

export async function setup2fa(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: secret, is2faEnabled: false },
  });
  const qrCodeDataUrl = await generateTotpQrDataUrl(user.email, secret);
  return { secret, qrCodeDataUrl };
}

export async function enable2fa(userId: string, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.totpSecret) throw new BadRequestError('Сначала выполните setup 2FA');
  if (!verifyTotpCode(user.totpSecret, code)) throw new BadRequestError('Неверный код 2FA');
  await prisma.user.update({ where: { id: userId }, data: { is2faEnabled: true } });
  return { message: '2FA включена' };
}

export async function disable2fa(userId: string, password: string, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.is2faEnabled || !user.totpSecret) throw new BadRequestError('2FA не включена');
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) throw new UnauthorizedError('Неверный пароль');
  if (!verifyTotpCode(user.totpSecret, code)) throw new BadRequestError('Неверный код 2FA');
  await prisma.user.update({
    where: { id: userId },
    data: { is2faEnabled: false, totpSecret: null },
  });
  return { message: '2FA отключена' };
}

export { REFRESH_COOKIE };
