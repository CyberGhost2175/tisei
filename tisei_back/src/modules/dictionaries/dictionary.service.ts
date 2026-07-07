import { prisma } from '../../config/prisma.js';
import { ConflictError, NotFoundError } from '../../common/errors/AppError.js';
import { writeAuditLog } from '../audit/audit.service.js';
import type { DictionaryType } from './dictionary.schemas.js';

type DictRow = { id: string; name: string; isActive: boolean; createdAt: Date };

const delegates = {
  'equipment-categories': {
    findMany: (activeOnly: boolean) =>
      prisma.equipmentCategory.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: { name: 'asc' },
      }),
    findUnique: (id: string) => prisma.equipmentCategory.findUnique({ where: { id } }),
    create: (name: string) => prisma.equipmentCategory.create({ data: { name } }),
    update: (id: string, data: { name?: string; isActive?: boolean }) =>
      prisma.equipmentCategory.update({ where: { id }, data }),
    delete: (id: string) => prisma.equipmentCategory.delete({ where: { id } }),
    entityType: 'EquipmentCategory',
  },
  'malfunction-types': {
    findMany: (activeOnly: boolean) =>
      prisma.malfunctionType.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: { name: 'asc' },
      }),
    findUnique: (id: string) => prisma.malfunctionType.findUnique({ where: { id } }),
    create: (name: string) => prisma.malfunctionType.create({ data: { name } }),
    update: (id: string, data: { name?: string; isActive?: boolean }) =>
      prisma.malfunctionType.update({ where: { id }, data }),
    delete: (id: string) => prisma.malfunctionType.delete({ where: { id } }),
    entityType: 'MalfunctionType',
  },
  'freeze-reasons': {
    findMany: (activeOnly: boolean) =>
      prisma.freezeReason.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: { name: 'asc' },
      }),
    findUnique: (id: string) => prisma.freezeReason.findUnique({ where: { id } }),
    create: (name: string) => prisma.freezeReason.create({ data: { name } }),
    update: (id: string, data: { name?: string; isActive?: boolean }) =>
      prisma.freezeReason.update({ where: { id }, data }),
    delete: (id: string) => prisma.freezeReason.delete({ where: { id } }),
    entityType: 'FreezeReason',
  },
} as const;

function toDto(row: DictRow) {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listDictionary(type: DictionaryType, activeOnly = true) {
  const rows = await delegates[type].findMany(activeOnly);
  return rows.map(toDto);
}

export async function createDictionaryEntry(
  type: DictionaryType,
  name: string,
  actorId: string,
) {
  try {
    const row = await delegates[type].create(name);
    await writeAuditLog({
      userId: actorId,
      action: 'dictionary.create',
      entityType: delegates[type].entityType,
      entityId: row.id,
      after: { name },
    });
    return toDto(row);
  } catch {
    throw new ConflictError('Запись с таким названием уже существует');
  }
}

export async function updateDictionaryEntry(
  type: DictionaryType,
  id: string,
  data: { name?: string; isActive?: boolean },
  actorId: string,
) {
  const existing = await delegates[type].findUnique(id);
  if (!existing) throw new NotFoundError('Запись справочника не найдена');

  try {
    const row = await delegates[type].update(id, data);
    await writeAuditLog({
      userId: actorId,
      action: 'dictionary.update',
      entityType: delegates[type].entityType,
      entityId: id,
      after: data,
    });
    return toDto(row);
  } catch {
    throw new ConflictError('Запись с таким названием уже существует');
  }
}

export async function deleteDictionaryEntry(type: DictionaryType, id: string, actorId: string) {
  const existing = await delegates[type].findUnique(id);
  if (!existing) throw new NotFoundError('Запись справочника не найдена');

  await delegates[type].delete(id);
  await writeAuditLog({
    userId: actorId,
    action: 'dictionary.delete',
    entityType: delegates[type].entityType,
    entityId: id,
  });
}
