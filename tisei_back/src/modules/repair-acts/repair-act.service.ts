import { RequestKind, RequestStatus, type UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/AppError.js';
import { decimalToNumber } from '../../common/utils/money.js';
import { isFieldRole } from '../../common/utils/roles.js';
import { writeAuditLog } from '../audit/audit.service.js';
import {
  buildMaintenanceActPdf,
  type MaintenanceActData,
  type MaintenanceActLine,
} from '../maintenance/maintenance-act-pdf.js';
import {
  currentPeriod,
  parsePeriod,
} from '../maintenance/maintenance.service.js';
import { findBestLocationMatch } from '../requests/partner-match.js';
import type { UpdateRepairActSettingBody } from './repair-act.schemas.js';

type AuthContext = { userId: string; role: UserRole };

/** Дата акта ремонта: всегда 22-е число месяца периода. */
export function repairActDate(period: string): Date {
  const { year, month } = parsePeriod(period);
  return new Date(year, month - 1, 22, 12, 0, 0, 0);
}

/** Окно заявок: с 1-го по 22-е число месяца периода включительно. */
export function repairActWindow(period: string): { from: Date; to: Date } {
  const { year, month } = parsePeriod(period);
  return {
    from: new Date(year, month - 1, 1, 0, 0, 0, 0),
    to: new Date(year, month - 1, 22, 23, 59, 59, 999),
  };
}

function brandLabel(partnerName: string): string {
  if (partnerName === 'Costa Coffee') return 'Costa';
  return partnerName;
}

function isGolpasPartner(partner: {
  name: string;
  maintenancePriceIncludesVat: boolean;
}): boolean {
  return !partner.maintenancePriceIncludesVat || /golpas/i.test(partner.name);
}

function locationTitle(partnerName: string, locationName: string, address: string): string {
  const brand = brandLabel(partnerName);
  const addr = address.trim();
  return addr ? `${brand} ${locationName}, ${addr}` : `${brand} ${locationName}`;
}

/** Как в образце имени файла: «KFC Zhybek zholy Compass , с. Жибек Жолы …» */
function locationTitleForFilename(
  partnerName: string,
  locationName: string,
  address: string,
): string {
  const brand = brandLabel(partnerName);
  const addr = address.trim();
  return addr ? `${brand} ${locationName} , ${addr}` : `${brand} ${locationName}`;
}

export function repairActFilename(
  actNumber: number,
  partnerName: string,
  locationName: string,
  address: string,
): string {
  const title = locationTitleForFilename(partnerName, locationName, address);
  const safe = title.replace(/[\\/:*?"<>|]/g, '').trim();
  return `акт ус нов №${actNumber} Рем обор ${safe}.pdf`;
}

async function nextSharedActNumber(): Promise<number> {
  const [maint, repair] = await Promise.all([
    prisma.maintenancePeriodSetting.aggregate({ _max: { actNumber: true } }),
    prisma.repairActPeriodSetting.aggregate({ _max: { actNumber: true } }),
  ]);
  const max = Math.max(maint._max.actNumber ?? 29, repair._max.actNumber ?? 29);
  return max + 1;
}

async function getOrCreateRepairActSetting(locationId: string, period: string) {
  const existing = await prisma.repairActPeriodSetting.findUnique({
    where: {
      partnerLocationId_period: { partnerLocationId: locationId, period },
    },
  });
  if (existing) return existing;

  return prisma.repairActPeriodSetting.create({
    data: {
      partnerLocationId: locationId,
      period,
      actDate: repairActDate(period),
    },
  });
}

type ClosedRepairRow = {
  id: string;
  number: string;
  closedAt: Date | null;
  address: string | null;
  companyOrFullName: string;
  partnerEstablishmentId: string | null;
  partnerLocationId: string | null;
  closingForm: {
    workPerformed: string | null;
    incomeAmount: { toNumber(): number } | null;
  } | null;
  partUsages: Array<{
    partNameSnapshot: string;
    unitPriceSnapshot: { toNumber(): number };
    quantity: number;
    lineTotal: { toNumber(): number };
  }>;
};

const closedRepairSelect = {
  id: true,
  number: true,
  closedAt: true,
  address: true,
  companyOrFullName: true,
  partnerEstablishmentId: true,
  partnerLocationId: true,
  closingForm: {
    select: {
      workPerformed: true,
      incomeAmount: true,
    },
  },
  partUsages: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      partNameSnapshot: true,
      unitPriceSnapshot: true,
      quantity: true,
      lineTotal: true,
    },
  },
};

async function loadClosedRepairsForPartner(
  partnerId: string,
  period: string,
): Promise<ClosedRepairRow[]> {
  const { from, to } = repairActWindow(period);
  return prisma.request.findMany({
    where: {
      kind: RequestKind.repair,
      partnerEstablishmentId: partnerId,
      status: RequestStatus.closed,
      deletedAt: null,
      closedAt: { gte: from, lte: to },
    },
    orderBy: { closedAt: 'asc' },
    select: closedRepairSelect,
  });
}

/**
 * Распределяет заявки по точкам: явный partnerLocationId или match по адресу/названию.
 * Одна заявка → максимум одна точка.
 */
function groupRepairsByLocation(
  requests: ClosedRepairRow[],
  locations: Array<{ id: string; name: string; address: string }>,
): Map<string, ClosedRepairRow[]> {
  const byLoc = new Map<string, ClosedRepairRow[]>();
  for (const loc of locations) byLoc.set(loc.id, []);

  const locById = new Map(locations.map((l) => [l.id, l]));

  for (const req of requests) {
    let locationId: string | null = null;

    if (req.partnerLocationId && locById.has(req.partnerLocationId)) {
      locationId = req.partnerLocationId;
    } else {
      locationId =
        findBestLocationMatch(
          req.address ?? '',
          req.companyOrFullName,
          locations,
        )?.id ?? null;
    }

    if (!locationId) continue;
    byLoc.get(locationId)!.push(req);
  }

  return byLoc;
}

async function loadClosedRepairsForLocation(
  locationId: string,
  period: string,
): Promise<{ partnerName: string; location: { name: string; address: string }; requests: ClosedRepairRow[] }> {
  const location = await prisma.partnerLocation.findFirst({
    where: { id: locationId, isActive: true },
    include: {
      partnerEstablishment: true,
    },
  });
  if (!location) throw new NotFoundError('Точка не найдена');

  const allLocations = await prisma.partnerLocation.findMany({
    where: { partnerEstablishmentId: location.partnerEstablishmentId, isActive: true },
    select: { id: true, name: true, address: true },
  });

  const closed = await loadClosedRepairsForPartner(location.partnerEstablishmentId, period);
  const grouped = groupRepairsByLocation(closed, allLocations);

  return {
    partnerName: location.partnerEstablishment.name,
    location: { name: location.name, address: location.address },
    requests: grouped.get(locationId) ?? [],
  };
}

function partsTotalOf(req: ClosedRepairRow): number {
  if (req.partUsages.length > 0) {
    return req.partUsages.reduce(
      (s, p) =>
        s + decimalToNumber(p.lineTotal as Parameters<typeof decimalToNumber>[0]),
      0,
    );
  }
  return decimalToNumber(
    req.closingForm?.incomeAmount as Parameters<typeof decimalToNumber>[0],
  );
}

function buildLines(
  partnerName: string,
  locationName: string,
  address: string,
  requests: ClosedRepairRow[],
): { lines: MaintenanceActLine[]; partsTotal: number; requestCount: number } {
  const title = locationTitle(partnerName, locationName, address);
  const lines: MaintenanceActLine[] = [];
  let partsTotal = 0;

  for (const req of requests) {
    if (req.partUsages.length > 0) {
      for (const part of req.partUsages) {
        const unitPrice = decimalToNumber(
          part.unitPriceSnapshot as Parameters<typeof decimalToNumber>[0],
        );
        const lineTotal = decimalToNumber(
          part.lineTotal as Parameters<typeof decimalToNumber>[0],
        );
        partsTotal += lineTotal;
        lines.push({
          name: `Ремонт оборудования ${title}. ${part.partNameSnapshot}`,
          city: '',
          quantity: part.quantity,
          unitPrice,
        });
      }
      continue;
    }

    const work = req.closingForm?.workPerformed?.trim();
    const income = decimalToNumber(
      req.closingForm?.incomeAmount as Parameters<typeof decimalToNumber>[0],
    );
    if (work || income > 0) {
      partsTotal += income;
      lines.push({
        name: work
          ? `Ремонт оборудования ${title}. ${work}`
          : `Ремонт оборудования ${title}`,
        city: '',
        quantity: 1,
        unitPrice: income,
      });
    } else {
      lines.push({
        name: `Ремонт оборудования ${title}`,
        city: '',
        quantity: 1,
        unitPrice: 0,
      });
    }
  }

  return { lines, partsTotal, requestCount: requests.length };
}

export async function listRepairActsOverview(_auth: AuthContext, periodInput?: string) {
  const period = periodInput ?? currentPeriod();
  const actDate = repairActDate(period);

  const partners = await prisma.partnerEstablishment.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      locations: {
        where: { isActive: true },
        orderBy: [{ city: 'asc' }, { name: 'asc' }],
        include: {
          repairActPeriods: { where: { period } },
        },
      },
    },
  });

  return {
    period,
    actDate: actDate.toISOString(),
    rules: [
      'Один АВР = одна точка партнёра (только заявки ремонта этой точки).',
      'Дата документа всегда 22-е число выбранного месяца.',
      'В акт: закрытые заявки ремонта с 1-го по 22-е; строки — запчасти / выполненные работы.',
      'Смотреть PDF можно сразу в справочнике или скачать файл.',
    ],
    partners: await Promise.all(
      partners.map(async (p) => {
        const closed = await loadClosedRepairsForPartner(p.id, period);
        const grouped = groupRepairsByLocation(
          closed,
          p.locations.map((l) => ({ id: l.id, name: l.name, address: l.address })),
        );

        const locations = p.locations.map((loc) => {
          const reqs = grouped.get(loc.id) ?? [];
          const partsTotal =
            Math.round(reqs.reduce((s, r) => s + partsTotalOf(r), 0) * 100) / 100;
          const setting = loc.repairActPeriods[0] ?? null;
          return {
            locationId: loc.id,
            locationName: loc.name,
            city: loc.city,
            address: loc.address,
            requestCount: reqs.length,
            partsTotal,
            actReady: reqs.length > 0,
            actNumber: setting?.actNumber ?? null,
            actDate: (setting?.actDate ?? actDate).toISOString(),
          };
        });

        const withActs = locations.filter((l) => l.actReady);
        return {
          id: p.id,
          name: p.name,
          priceIncludesVat: p.maintenancePriceIncludesVat,
          locationsTotal: locations.length,
          locationsWithRepairs: withActs.length,
          requestCount: withActs.reduce((s, l) => s + l.requestCount, 0),
          partsTotal:
            Math.round(withActs.reduce((s, l) => s + l.partsTotal, 0) * 100) / 100,
          locations,
        };
      }),
    ),
  };
}

export async function getRepairActPartnerDetail(
  partnerId: string,
  _auth: AuthContext,
  periodInput?: string,
) {
  const period = periodInput ?? currentPeriod();
  const overview = await listRepairActsOverview(_auth, period);
  const partner = overview.partners.find((p) => p.id === partnerId);
  if (!partner) throw new NotFoundError('Партнёр не найден');

  const full = await prisma.partnerEstablishment.findUniqueOrThrow({
    where: { id: partnerId },
  });

  return {
    period: overview.period,
    actDate: overview.actDate,
    partner: {
      id: full.id,
      name: full.name,
      priceIncludesVat: full.maintenancePriceIncludesVat,
      customerName: full.maintenanceCustomerName,
      customerBin: full.maintenanceCustomerBin,
      customerAddress: full.maintenanceCustomerAddress,
      contractNumber: full.maintenanceContractNumber,
      contractDate: full.maintenanceContractDate?.toISOString() ?? null,
      executorName: full.maintenanceExecutorName,
      executorBin: full.maintenanceExecutorBin,
      executorAddress: full.maintenanceExecutorAddress,
    },
    locations: partner.locations,
  };
}

export async function updateRepairActSetting(
  locationId: string,
  period: string,
  body: UpdateRepairActSettingBody,
  auth: AuthContext,
) {
  if (isFieldRole(auth.role)) throw new ForbiddenError('Недостаточно прав');

  const location = await prisma.partnerLocation.findFirst({
    where: { id: locationId, isActive: true },
  });
  if (!location) throw new NotFoundError('Точка не найдена');

  const setting = await getOrCreateRepairActSetting(locationId, period);
  const updated = await prisma.repairActPeriodSetting.update({
    where: { id: setting.id },
    data: {
      actDate: body.actDate === undefined ? undefined : body.actDate,
      actNumber: body.actNumber === undefined ? undefined : body.actNumber,
    },
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'repair_act.period.update',
    entityType: 'RepairActPeriodSetting',
    entityId: updated.id,
    after: body,
  });

  return {
    actDate: (updated.actDate ?? repairActDate(period)).toISOString(),
    actNumber: updated.actNumber,
  };
}

export async function downloadRepairAct(
  locationId: string,
  periodInput: string | undefined,
  auth: AuthContext,
): Promise<{ buffer: Buffer; filename: string }> {
  const period = periodInput ?? currentPeriod();

  const location = await prisma.partnerLocation.findFirst({
    where: { id: locationId, isActive: true },
    include: { partnerEstablishment: true },
  });
  if (!location) throw new NotFoundError('Точка не найдена');

  const partner = location.partnerEstablishment;
  const { requests } = await loadClosedRepairsForLocation(locationId, period);
  const { lines, partsTotal } = buildLines(
    partner.name,
    location.name,
    location.address,
    requests,
  );

  if (lines.length === 0) {
    throw new BadRequestError(
      'Нет закрытых заявок ремонта по этой точке за период до 22-го числа',
    );
  }

  let setting = await getOrCreateRepairActSetting(locationId, period);
  if (!setting.actNumber) {
    const next = await nextSharedActNumber();
    setting = await prisma.repairActPeriodSetting.update({
      where: { id: setting.id },
      data: {
        actNumber: next,
        actDate: setting.actDate ?? repairActDate(period),
      },
    });
  }

  const actDate = setting.actDate ?? repairActDate(period);
  const { from, to } = repairActWindow(period);
  const golpas = isGolpasPartner(partner);

  const data: MaintenanceActData = {
    actNumber: setting.actNumber!,
    actDate,
    periodFrom: from,
    periodTo: to,
    periodLabel: period,
    customerName: partner.maintenanceCustomerName ?? partner.name,
    customerBin: partner.maintenanceCustomerBin ?? '',
    customerAddress: partner.maintenanceCustomerAddress ?? '',
    executorName:
      partner.maintenanceExecutorName ??
      'Индивидуальный Предприниматель «BerekeТехСервис»',
    executorBin: partner.maintenanceExecutorBin ?? '',
    executorAddress: partner.maintenanceExecutorAddress ?? '',
    contractNumber: partner.maintenanceContractNumber ?? '',
    contractDate: partner.maintenanceContractDate,
    priceIncludesVat: partner.maintenancePriceIncludesVat,
    variant: golpas ? 'golpas' : 'caspian',
    rawLineNames: true,
    lines,
  };

  const buffer = await buildMaintenanceActPdf(data);
  const filename = repairActFilename(
    setting.actNumber!,
    partner.name,
    location.name,
    location.address,
  );

  await writeAuditLog({
    userId: auth.userId,
    action: 'repair_act.download',
    entityType: 'PartnerLocation',
    entityId: locationId,
    after: {
      period,
      actNumber: setting.actNumber,
      lines: lines.length,
      partsTotal,
    },
  });

  return { buffer, filename };
}
