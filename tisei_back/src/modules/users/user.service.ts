import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../common/errors/AppError.js';
import { hashPassword, generateOpaqueToken } from '../../common/utils/crypto.js';
import { buildPaginated, toSkipTake, type PaginatedResult } from '../../common/utils/pagination.js';
import { getEmailProvider } from '../../common/email/email.factory.js';
import { writeAuditLog } from '../audit/audit.service.js';
import type { CreateUserBody, UpdateUserBody, UserListQuery } from './user.schemas.js';

const publicSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  specialization: true,
  avatarUrl: true,
  is2faEnabled: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type UserPublic = Prisma.UserGetPayload<{ select: typeof publicSelect }>;

function toPublic(user: UserPublic) {
  return {
    ...user,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function listUsers(query: UserListQuery): Promise<PaginatedResult<ReturnType<typeof toPublic>>> {
  const where: Prisma.UserWhereInput = {};
  if (query.role) where.role = query.role;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search } },
    ];
  }

  const { skip, take } = toSkipTake(query);
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: publicSelect }),
    prisma.user.count({ where }),
  ]);

  return buildPaginated(items.map(toPublic), total, query);
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: publicSelect });
  if (!user) throw new NotFoundError('Пользователь не найден');
  return toPublic(user);
}

export async function createUser(body: CreateUserBody, actorId: string) {
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new ConflictError('Пользователь с таким email уже существует');

  const password = body.password ?? generateOpaqueToken(12);
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      passwordHash,
      role: body.role,
      specialization: body.specialization,
      avatarUrl: body.avatarUrl,
    },
    select: publicSelect,
  });

  if (!body.password) {
    await getEmailProvider().send({
      to: user.email,
      subject: 'Добро пожаловать в Береке ТехСервис CRM',
      html: `<p>Ваш аккаунт создан. Временный пароль: <strong>${password}</strong></p><p>Войдите: ${env.FRONTEND_CRM_URL}/login</p>`,
      text: `Временный пароль: ${password}`,
    });
  }

  await writeAuditLog({
    userId: actorId,
    action: 'user.create',
    entityType: 'User',
    entityId: user.id,
    after: { email: user.email, role: user.role },
  });

  return toPublic(user);
}

export async function updateUser(id: string, body: UpdateUserBody, actorId: string, actorRole: UserRole) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Пользователь не найден');

  if (id === actorId) {
    if (body.isActive === false) {
      throw new BadRequestError('Нельзя деактивировать свой аккаунт');
    }
    if (body.role && body.role !== existing.role) {
      throw new BadRequestError('Нельзя менять свою роль');
    }
  }

  if (body.email && body.email !== existing.email) {
    const dup = await prisma.user.findUnique({ where: { email: body.email } });
    if (dup) throw new ConflictError('Email уже занят');
  }

  if (body.role && actorRole !== 'admin') {
    throw new BadRequestError('Только администратор может менять роль');
  }

  const targetRole = body.role ?? existing.role;
  const targetActive = body.isActive ?? existing.isActive;

  if (existing.role === 'admin' && (targetRole !== 'admin' || targetActive === false)) {
    const adminCount = await prisma.user.count({ where: { role: 'admin', isActive: true } });
    if (adminCount <= 1) {
      throw new BadRequestError('Нельзя изменить роль или отключить последнего администратора');
    }
  }

  const updateData: Parameters<typeof prisma.user.update>[0]['data'] = { ...body };
  if (body.is2faEnabled === false) {
    updateData.totpSecret = null;
  }
  if (body.isActive === false) {
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: publicSelect,
  });

  await writeAuditLog({
    userId: actorId,
    action: 'user.update',
    entityType: 'User',
    entityId: id,
    before: { email: existing.email, role: existing.role },
    after: { email: user.email, role: user.role },
  });

  return toPublic(user);
}

export async function deleteUser(id: string, actorId: string) {
  if (id === actorId) throw new BadRequestError('Нельзя удалить свой аккаунт');

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Пользователь не найден');
  if (user.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin', isActive: true } });
    if (adminCount <= 1) throw new BadRequestError('Нельзя удалить последнего администратора');
  }

  await prisma.user.delete({ where: { id } });

  await writeAuditLog({
    userId: actorId,
    action: 'user.delete',
    entityType: 'User',
    entityId: id,
    before: { email: user.email },
  });
}

export async function archiveUser(id: string, actorId: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Пользователь не найден');
  if (!user.isActive) throw new BadRequestError('Пользователь уже архивирован');

  if (user.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin', isActive: true } });
    if (adminCount <= 1) throw new BadRequestError('Нельзя архивировать последнего администратора');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: publicSelect,
  });

  await prisma.refreshToken.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await writeAuditLog({
    userId: actorId,
    action: 'user.archive',
    entityType: 'User',
    entityId: id,
  });

  return toPublic(updated);
}

export async function adminResetPassword(
  id: string,
  actorId: string,
  options: { newPassword?: string; sendEmail?: boolean },
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Пользователь не найден');

  const password = options.newPassword ?? generateOpaqueToken(12);
  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  if (options.sendEmail !== false) {
    await getEmailProvider().send({
      to: user.email,
      subject: 'Новый пароль Береке ТехСервис CRM',
      html: `<p>Администратор сбросил ваш пароль. Новый пароль: <strong>${password}</strong></p>`,
      text: `Новый пароль: ${password}`,
    });
  }

  await writeAuditLog({
    userId: actorId,
    action: 'user.reset_password',
    entityType: 'User',
    entityId: id,
  });

  return { message: 'Пароль сброшен', temporaryPassword: options.sendEmail === false ? password : undefined };
}

const executorSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

export async function listExecutors() {
  const users = await prisma.user.findMany({
    where: { role: { in: ['executor', 'master'] }, isActive: true },
    select: executorSelect,
    orderBy: { fullName: 'asc' },
  });
  return users;
}
