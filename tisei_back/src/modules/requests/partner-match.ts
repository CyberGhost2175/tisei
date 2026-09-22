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

/** Нормализация адреса/названия точки для сопоставления. */
export function normalizeLocationKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[''`´"«»()]/g, '')
    .replace(/[.\-_/,№#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type LocationMatchCandidate = {
  id: string;
  name: string;
  address: string;
};

/**
 * Оценка совпадения заявки с точкой партнёра (адрес / название).
 * Чем выше — тем лучше; 0 = не подходит.
 */
/** Часто встречающиеся названия точек (кириллица ↔ латиница из CRM). */
const LOCATION_NAME_ALIASES: Record<string, string[]> = {
  'Golden Key': ['золотой ключик', 'голден кей'],
  Respublika: ['республика', 'республики'],
  'Mega Astana (Keruen City)': ['мега астана', 'keruen city', 'керуен'],
  'Zhybek zholy Compass': ['жибек жолы', 'compass', 'компас'],
  'Asia Park': ['азия парк', 'asia park'],
  'Khan Shatyr': ['хан шатыр', 'khan shatyr'],
  'Mega EXPO': ['мега экспо', 'mega expo'],
  Keruen: ['керуен', 'keruen'],
  Ncity: ['n city', 'ncity', 'эн сити'],
  Sauran: ['сауран'],
  Manasa: ['манаса'],
  'Food city': ['фуд сити', 'food city'],
  Bogenbay: ['богенбай'],
  Saryarka: ['сарыарка', 'сары арка'],
  'Момышулы 2в': ['момышулы 2в', 'момышулы 2в'],
};

export function scoreLocationMatch(
  requestAddress: string,
  companyOrFullName: string,
  location: LocationMatchCandidate,
): number {
  const hay = normalizeLocationKey(`${requestAddress} ${companyOrFullName}`);
  if (!hay) return 0;

  const locName = normalizeLocationKey(location.name);
  const locAddr = normalizeLocationKey(location.address);
  let score = 0;

  if (locName && (hay.includes(locName) || locName.includes(hay))) score += 12;

  const aliases = LOCATION_NAME_ALIASES[location.name] ?? [];
  for (const alias of aliases) {
    const key = normalizeLocationKey(alias);
    if (key.length >= 3 && hay.includes(key)) score += 10;
  }

  for (const token of locName.split(' ')) {
    if (token.length >= 3 && hay.includes(token)) score += 4;
  }
  for (const token of locAddr.split(' ')) {
    if (token.length >= 4 && hay.includes(token)) score += 3;
  }

  const numsHay = (hay.match(/\d+[a-zа-я]?/gi) ?? []).map((n) =>
    n.toLowerCase().replace(/ё/g, 'е'),
  );
  const numsLoc = (`${locName} ${locAddr}`.match(/\d+[a-zа-я]?/gi) ?? []).map((n) =>
    n.toLowerCase().replace(/ё/g, 'е'),
  );

  if (numsHay.length > 0 && numsLoc.length > 0) {
    const houseMatch = numsHay.some((n) => numsLoc.includes(n));
    if (houseMatch) score += 8;
    else score -= 8;
  }

  return score;
}

/** Лучшая точка партнёра для заявки без partnerLocationId (порог ≥ 6). */
export function findBestLocationMatch(
  requestAddress: string,
  companyOrFullName: string,
  locations: LocationMatchCandidate[],
  minScore = 6,
): LocationMatchCandidate | null {
  let best: LocationMatchCandidate | null = null;
  let bestScore = 0;
  for (const loc of locations) {
    const score = scoreLocationMatch(requestAddress, companyOrFullName, loc);
    if (score > bestScore) {
      bestScore = score;
      best = loc;
    }
  }
  return bestScore >= minScore ? best : null;
}

export async function resolvePartnerLocationId(input: {
  partnerEstablishmentId: string | null | undefined;
  address: string | null | undefined;
  companyOrFullName: string;
  partnerLocationId?: string | null;
}): Promise<string | null> {
  if (input.partnerLocationId) {
    const loc = await prisma.partnerLocation.findFirst({
      where: {
        id: input.partnerLocationId,
        isActive: true,
        ...(input.partnerEstablishmentId
          ? { partnerEstablishmentId: input.partnerEstablishmentId }
          : {}),
      },
      select: { id: true },
    });
    if (loc) return loc.id;
  }

  if (!input.partnerEstablishmentId) return null;

  const locations = await prisma.partnerLocation.findMany({
    where: { partnerEstablishmentId: input.partnerEstablishmentId, isActive: true },
    select: { id: true, name: true, address: true },
  });
  if (locations.length === 0) return null;

  return (
    findBestLocationMatch(
      input.address ?? '',
      input.companyOrFullName,
      locations,
    )?.id ?? null
  );
}
