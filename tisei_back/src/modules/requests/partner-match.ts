import { prisma } from '../../config/prisma.js';

/** Нормализация названия для сравнения (регистр, пробелы, пунктуация). */
export function normalizeBrandKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[''`´"«»]/g, '')
    .replace(/[.\-_/,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '');
}

export function matchesPartnerAliases(companyName: string, aliases: string[]): boolean {
  const norm = normalizeBrandKey(companyName);
  if (!norm) return false;

  return aliases.some((alias) => {
    const key = normalizeBrandKey(alias);
    if (key.length < 2) return false;
    return norm.includes(key) || key.includes(norm);
  });
}

export type PartnerMatch = { id: string; name: string };

export async function findMatchingPartner(companyName: string): Promise<PartnerMatch | null> {
  const partners = await prisma.partnerEstablishment.findMany({
    where: { isActive: true },
    select: { id: true, name: true, aliases: true },
  });

  for (const p of partners) {
    const allAliases = [p.name, ...p.aliases];
    if (matchesPartnerAliases(companyName, allAliases)) {
      return { id: p.id, name: p.name };
    }
  }

  return null;
}

export async function getPartnerById(id: string) {
  return prisma.partnerEstablishment.findFirst({
    where: { id, isActive: true },
    select: { id: true, name: true },
  });
}
