import { CommentType, RequestKind, RequestStatus, type UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/AppError.js';
import { decimalToNumber, round2, toDecimal } from '../../common/utils/money.js';
import { isFieldRole } from '../../common/utils/roles.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { generateRequestNumber } from '../requests/request-number.service.js';
import type {
  CloseMaintenanceBody,
  TransferToRepairBody,
  UpdatePartnerMaintenanceBody,
  UpdatePeriodSettingBody,
} from './maintenance.schemas.js';
import { buildMaintenanceActPdf, type MaintenanceActData } from './maintenance-act-pdf.js';

type AuthContext = { userId: string; role: UserRole };

const MONTHS_RU = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

export function currentPeriod(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parsePeriod(period: string): { year: number; month: number } {
  const [y, m] = period.split('-').map(Number);
  return { year: y, month: m };
}

/** Дедлайн закрытия ТО для периода. closeDay=1 → 1-е число следующего месяца. */
export function defaultCloseByDate(period: string, closeDay: number): Date {
  const { year, month } = parsePeriod(period);
  if (closeDay === 1) {
    // до 1-го следующего месяца
    return new Date(year, month, 1, 23, 59, 59, 999);
  }
  return new Date(year, month - 1, closeDay, 23, 59, 59, 999);
}

/** Дата акта по умолчанию: Golpas (closeDay=1) — 5-е число месяца периода; остальные — 22-е. */
export function defaultActDate(period: string, closeDay = 20): Date {
  const { year, month } = parsePeriod(period);
  const day = closeDay === 1 ? 5 : 22;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function periodLabelRu(period: string): string {
  const { year, month } = parsePeriod(period);
  const prevMonth = month === 1 ? 12 : month - 1;
  // как в образце KFC: «май-июнь» при дате акта в июне
  return `${MONTHS_RU[prevMonth - 1]}-${MONTHS_RU[month - 1]} ${year}`;
}

/** Имя месяца периода (для Golpas: «Обслуживание … за июль месяц»). */
export function periodMonthNameRu(period: string): string {
  const { month } = parsePeriod(period);
  return MONTHS_RU[month - 1]!;
}

export function actFilename(partnerName: string, period: string, actNumber: number, opts?: { golpas?: boolean }): string {
  const label = opts?.golpas
    ? periodMonthNameRu(period)
    : periodLabelRu(period).replace(/\s+/g, ' ');
  const safe = partnerName.replace(/[\\/:*?"<>|]/g, '').trim();
  return `акт ус нов №${actNumber} Ежем план тех обсл ${label} ${safe}.pdf`;
}

async function getOrCreatePeriodSetting(partnerId: string, period: string, closeDay: number) {
  const existing = await prisma.maintenancePeriodSetting.findUnique({
    where: {
      partnerEstablishmentId_period: { partnerEstablishmentId: partnerId, period },
    },
  });
  if (existing) return existing;

  return prisma.maintenancePeriodSetting.create({
    data: {
      partnerEstablishmentId: partnerId,
      period,
      closeByDate: defaultCloseByDate(period, closeDay),
      actDate: defaultActDate(period, closeDay),
    },
  });
}

/** Создаёт заявки ТО на все активные точки партнёров за период (идемпотентно). */
export async function ensureMaintenancePeriod(period = currentPeriod()) {
  const partners = await prisma.partnerEstablishment.findMany({
    where: { isActive: true, maintenanceEnabled: true },
    include: {
      locations: { where: { isActive: true }, orderBy: [{ city: 'asc' }, { name: 'asc' }] },
    },
  });

  let created = 0;

  for (const partner of partners) {
    await getOrCreatePeriodSetting(partner.id, period, partner.maintenanceCloseDay);
    const deadline = defaultCloseByDate(period, partner.maintenanceCloseDay);

    for (const loc of partner.locations) {
      const existing = await prisma.request.findFirst({
        where: {
          kind: RequestKind.maintenance,
          partnerLocationId: loc.id,
          maintenancePeriod: period,
          deletedAt: null,
        },
      });
      if (existing) continue;

      const number = await generateRequestNumber();
      const createdReq = await prisma.request.create({
        data: {
          number,
          source: 'manual',
          clientType: 'serviced',
          status: RequestStatus.new,
          kind: RequestKind.maintenance,
          partnerEstablishmentId: partner.id,
          partnerLocationId: loc.id,
          maintenancePeriod: period,
          companyOrFullName: `${partner.name} · ${loc.name}`,
          phone: '—',
          address: `${loc.city}, ${loc.address}`,
          problemDescription: `Ежемесячное плановое техническое обслуживание · ${period}`,
          equipmentName: 'Плановое ТО',
          deadline,
        },
      });

      await prisma.comment.create({
        data: {
          requestId: createdReq.id,
          type: CommentType.system_event,
          text: `Автосоздана заявка на плановое ТО за период ${period}.`,
        },
      });

      created += 1;
    }
  }

  return { period, created, partners: partners.length };
}

export async function listMaintenanceOverview(_auth: AuthContext, periodInput?: string) {
  const period = periodInput ?? currentPeriod();
  await ensureMaintenancePeriod(period);

  const partners = await prisma.partnerEstablishment.findMany({
    where: { isActive: true, maintenanceEnabled: true },
    orderBy: { name: 'asc' },
    include: {
      locations: { where: { isActive: true }, select: { id: true } },
      maintenancePeriods: { where: { period } },
    },
  });

  const requests = await prisma.request.findMany({
    where: {
      kind: RequestKind.maintenance,
      maintenancePeriod: period,
      deletedAt: null,
      partnerEstablishmentId: { in: partners.map((p) => p.id) },
    },
    select: {
      id: true,
      status: true,
      partnerEstablishmentId: true,
      partnerLocationId: true,
      deadline: true,
    },
  });

  return {
    period,
    periodLabel: periodLabelRu(period),
    rules: [
      'KFC, Hardee\'s, Costa Coffee — закрыть все точки до 20-го числа текущего месяца.',
      'Golpas — закрыть все точки до 1-го числа следующего месяца.',
      'Даты закрытия можно изменить в карточке партнёра на период.',
      'Когда все точки закрыты — доступен акт выполненных работ (дата акта: 22-е число; для Golpas — 5-е).',
    ],
    partners: partners.map((p) => {
      const setting = p.maintenancePeriods[0] ?? null;
      const locs = p.locations.map((l) => l.id);
      const partnerReqs = requests.filter((r) => r.partnerEstablishmentId === p.id);
      const closed = partnerReqs.filter((r) => r.status === 'closed').length;
      const open = partnerReqs.filter((r) => r.status !== 'closed' && r.status !== 'cancelled').length;
      const total = locs.length;
      const closeBy =
        setting?.closeByDate ?? defaultCloseByDate(period, p.maintenanceCloseDay);
      const allClosed = total > 0 && open === 0 && closed >= total;

      return {
        id: p.id,
        name: p.name,
        maintenanceCloseDay: p.maintenanceCloseDay,
        closeByDate: closeBy.toISOString(),
        actDate: (setting?.actDate ?? defaultActDate(period, p.maintenanceCloseDay)).toISOString(),
        actNumber: setting?.actNumber ?? null,
        unitPrice: decimalToNumber(p.maintenanceUnitPrice),
        locationsTotal: total,
        requestsTotal: partnerReqs.length,
        closedCount: closed,
        openCount: open,
        allClosed,
        actReady: allClosed,
        deadlineHint:
          p.maintenanceCloseDay === 1
            ? 'Закрыть до 1-го числа следующего месяца'
            : `Закрыть до ${p.maintenanceCloseDay}-го числа текущего месяца`,
      };
    }),
  };
}

export async function getPartnerMaintenanceDetail(
  partnerId: string,
  _auth: AuthContext,
  periodInput?: string,
) {
  const period = periodInput ?? currentPeriod();
  await ensureMaintenancePeriod(period);

  const partner = await prisma.partnerEstablishment.findFirst({
    where: { id: partnerId, maintenanceEnabled: true, isActive: true },
    include: {
      locations: { where: { isActive: true }, orderBy: [{ city: 'asc' }, { name: 'asc' }] },
      maintenancePeriods: { where: { period } },
    },
  });
  if (!partner) throw new NotFoundError('Партнёр ТО не найден');

  const setting =
    partner.maintenancePeriods[0] ??
    (await getOrCreatePeriodSetting(partner.id, period, partner.maintenanceCloseDay));

  const requests = await prisma.request.findMany({
    where: {
      kind: RequestKind.maintenance,
      maintenancePeriod: period,
      partnerEstablishmentId: partner.id,
      deletedAt: null,
    },
    include: {
      partnerLocation: true,
      assignments: {
        include: { executor: { select: { id: true, fullName: true } } },
      },
      repairRequestsFromMaintenance: {
        where: { deletedAt: null },
        select: { id: true, number: true, status: true },
      },
    },
  });

  const byLocation = new Map(requests.map((r) => [r.partnerLocationId, r]));

  const citiesMap = new Map<
    string,
    Array<{
      locationId: string;
      locationName: string;
      address: string;
      equipmentQuantity: number | null;
      maintenancePrice: number | null;
      request: null | {
        id: string;
        number: string;
        status: RequestStatus;
        findings: string | null;
        deadline: string | null;
        closedAt: string | null;
        transferredRepairs: Array<{ id: string; number: string; status: RequestStatus }>;
      };
    }>
  >();

  for (const loc of partner.locations) {
    const req = byLocation.get(loc.id);
    const row = {
      locationId: loc.id,
      locationName: loc.name,
      address: loc.address,
      equipmentQuantity: loc.equipmentQuantity,
      maintenancePrice:
        loc.maintenancePrice == null ? null : decimalToNumber(loc.maintenancePrice),
      request: req
        ? {
            id: req.id,
            number: req.number,
            status: req.status,
            findings: req.maintenanceFindings,
            deadline: req.deadline?.toISOString() ?? null,
            closedAt: req.closedAt?.toISOString() ?? null,
            transferredRepairs: req.repairRequestsFromMaintenance,
          }
        : null,
    };
    const list = citiesMap.get(loc.city) ?? [];
    list.push(row);
    citiesMap.set(loc.city, list);
  }

  const openCount = requests.filter((r) => r.status !== 'closed' && r.status !== 'cancelled').length;
  const closedCount = requests.filter((r) => r.status === 'closed').length;
  const allClosed = partner.locations.length > 0 && openCount === 0 && closedCount >= partner.locations.length;

  return {
    period,
    periodLabel: periodLabelRu(period),
    partner: {
      id: partner.id,
      name: partner.name,
      maintenanceCloseDay: partner.maintenanceCloseDay,
      unitPrice: decimalToNumber(partner.maintenanceUnitPrice),
      priceIncludesVat: partner.maintenancePriceIncludesVat,
      customerName: partner.maintenanceCustomerName,
      customerBin: partner.maintenanceCustomerBin,
      customerAddress: partner.maintenanceCustomerAddress,
      contractNumber: partner.maintenanceContractNumber,
      contractDate: partner.maintenanceContractDate?.toISOString() ?? null,
      executorName: partner.maintenanceExecutorName,
      executorBin: partner.maintenanceExecutorBin,
      executorAddress: partner.maintenanceExecutorAddress,
    },
    setting: {
      closeByDate: setting.closeByDate.toISOString(),
      actDate: (setting.actDate ?? defaultActDate(period, partner.maintenanceCloseDay)).toISOString(),
      actNumber: setting.actNumber,
    },
    deadlineHint:
      partner.maintenanceCloseDay === 1
        ? 'Мастер должен закрыть все точки до 1-го числа следующего месяца'
        : `Мастер должен закрыть все точки до ${partner.maintenanceCloseDay}-го числа текущего месяца`,
    stats: {
      locationsTotal: partner.locations.length,
      closedCount,
      openCount,
      allClosed,
      actReady: allClosed,
    },
    cities: Array.from(citiesMap.entries()).map(([city, locations]) => ({ city, locations })),
  };
}

export async function updatePartnerMaintenanceSettings(
  partnerId: string,
  body: UpdatePartnerMaintenanceBody,
  auth: AuthContext,
) {
  if (isFieldRole(auth.role)) throw new ForbiddenError('Недостаточно прав');

  const partner = await prisma.partnerEstablishment.findFirst({
    where: { id: partnerId, maintenanceEnabled: true },
  });
  if (!partner) throw new NotFoundError('Партнёр ТО не найден');

  const updated = await prisma.partnerEstablishment.update({
    where: { id: partnerId },
    data: {
      maintenanceCloseDay: body.maintenanceCloseDay,
      maintenanceUnitPrice:
        body.maintenanceUnitPrice === undefined
          ? undefined
          : body.maintenanceUnitPrice === null
            ? null
            : round2(toDecimal(body.maintenanceUnitPrice)),
      maintenanceCustomerName: body.maintenanceCustomerName,
      maintenanceCustomerBin: body.maintenanceCustomerBin,
      maintenanceCustomerAddress: body.maintenanceCustomerAddress,
      maintenanceContractNumber: body.maintenanceContractNumber,
      maintenanceContractDate: body.maintenanceContractDate,
      maintenanceExecutorName: body.maintenanceExecutorName,
      maintenanceExecutorBin: body.maintenanceExecutorBin,
      maintenanceExecutorAddress: body.maintenanceExecutorAddress,
    },
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'maintenance.partner.update',
    entityType: 'PartnerEstablishment',
    entityId: partnerId,
    after: body,
  });

  return updated;
}

export async function updatePeriodSetting(
  partnerId: string,
  period: string,
  body: UpdatePeriodSettingBody,
  auth: AuthContext,
) {
  if (isFieldRole(auth.role)) throw new ForbiddenError('Недостаточно прав');

  const partner = await prisma.partnerEstablishment.findFirst({
    where: { id: partnerId, maintenanceEnabled: true },
  });
  if (!partner) throw new NotFoundError('Партнёр ТО не найден');

  const setting = await getOrCreatePeriodSetting(partnerId, period, partner.maintenanceCloseDay);

  const updated = await prisma.maintenancePeriodSetting.update({
    where: { id: setting.id },
    data: {
      closeByDate: body.closeByDate,
      actDate: body.actDate === undefined ? undefined : body.actDate,
      actNumber: body.actNumber === undefined ? undefined : body.actNumber,
    },
  });

  // Синхронизируем дедлайн открытых заявок ТО периода
  if (body.closeByDate) {
    await prisma.request.updateMany({
      where: {
        kind: RequestKind.maintenance,
        partnerEstablishmentId: partnerId,
        maintenancePeriod: period,
        status: { notIn: ['closed', 'cancelled'] },
        deletedAt: null,
      },
      data: { deadline: body.closeByDate },
    });
  }

  await writeAuditLog({
    userId: auth.userId,
    action: 'maintenance.period.update',
    entityType: 'MaintenancePeriodSetting',
    entityId: updated.id,
    after: body,
  });

  return {
    closeByDate: updated.closeByDate.toISOString(),
    actDate: (updated.actDate ?? defaultActDate(period, partner.maintenanceCloseDay)).toISOString(),
    actNumber: updated.actNumber,
  };
}

export async function updateMaintenanceFindings(
  requestId: string,
  findings: string,
  auth: AuthContext,
) {
  const request = await prisma.request.findFirst({
    where: { id: requestId, kind: RequestKind.maintenance, deletedAt: null },
  });
  if (!request) throw new NotFoundError('Заявка ТО не найдена');
  if (request.status === 'closed' || request.status === 'cancelled') {
    throw new BadRequestError('Заявка уже закрыта');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { maintenanceFindings: findings },
  });

  await prisma.comment.create({
    data: {
      requestId,
      authorId: auth.userId,
      type: CommentType.comment,
      text: findings.trim()
        ? `Замечания по ТО: ${findings.trim()}`
        : 'Замечания по ТО очищены',
    },
  });

  return { id: updated.id, findings: updated.maintenanceFindings };
}

export async function closeMaintenanceRequest(
  requestId: string,
  body: CloseMaintenanceBody,
  auth: AuthContext,
) {
  const request = await prisma.request.findFirst({
    where: { id: requestId, kind: RequestKind.maintenance, deletedAt: null },
  });
  if (!request) throw new NotFoundError('Заявка ТО не найдена');
  if (request.status === 'closed') throw new BadRequestError('Уже закрыта');
  if (request.status === 'cancelled') throw new BadRequestError('Заявка отменена');

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: {
      status: RequestStatus.closed,
      closedAt: new Date(),
      maintenanceFindings: body.findings?.trim() || request.maintenanceFindings,
    },
  });

  await prisma.comment.create({
    data: {
      requestId,
      authorId: auth.userId,
      type: CommentType.system_event,
      text: body.findings?.trim()
        ? `ТО закрыто. Замечания: ${body.findings.trim()}`
        : 'ТО закрыто без замечаний.',
    },
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'maintenance.request.close',
    entityType: 'Request',
    entityId: requestId,
  });

  return { id: updated.id, status: updated.status, closedAt: updated.closedAt?.toISOString() };
}

/** Закрыть все открытые заявки ТО партнёра за период. */
export async function closeAllMaintenanceForPartner(
  partnerId: string,
  periodInput: string | undefined,
  auth: AuthContext,
) {
  const period = periodInput ?? currentPeriod();
  await ensureMaintenancePeriod(period);

  const partner = await prisma.partnerEstablishment.findFirst({
    where: { id: partnerId, maintenanceEnabled: true, isActive: true },
  });
  if (!partner) throw new NotFoundError('Партнёр ТО не найден');

  const open = await prisma.request.findMany({
    where: {
      kind: RequestKind.maintenance,
      partnerEstablishmentId: partnerId,
      maintenancePeriod: period,
      deletedAt: null,
      status: { notIn: ['closed', 'cancelled'] },
    },
    select: { id: true },
  });

  if (open.length === 0) {
    return { period, closed: 0, message: 'Нет открытых точек для закрытия' };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.request.updateMany({
      where: { id: { in: open.map((r) => r.id) } },
      data: { status: RequestStatus.closed, closedAt: now },
    });
    await tx.comment.createMany({
      data: open.map((r) => ({
        requestId: r.id,
        authorId: auth.userId,
        type: CommentType.system_event,
        text: 'ТО закрыто массово (закрыть все точки).',
      })),
    });
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'maintenance.partner.close_all',
    entityType: 'PartnerEstablishment',
    entityId: partnerId,
    after: { period, closed: open.length },
  });

  return { period, closed: open.length };
}

/** Перевод с ТО на обычный ремонт — создаёт заявку с пометкой «С обслуживания». */
export async function transferMaintenanceToRepair(
  requestId: string,
  body: TransferToRepairBody,
  auth: AuthContext,
) {
  const maintenance = await prisma.request.findFirst({
    where: { id: requestId, kind: RequestKind.maintenance, deletedAt: null },
    include: { partnerLocation: true, partnerEstablishment: true },
  });
  if (!maintenance) throw new NotFoundError('Заявка ТО не найдена');
  if (maintenance.status === 'cancelled') throw new BadRequestError('Заявка отменена');

  const findings = body.findings.trim();
  const number = await generateRequestNumber();

  const repair = await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: requestId },
      data: {
        maintenanceFindings: findings,
        // ТО остаётся открытой или закрываем? Пользователь: «переводить на ремонт» —
        // оставляем ТО, можно закрыть отдельно; замечание сохраняем.
      },
    });

    const created = await tx.request.create({
      data: {
        number,
        source: 'manual',
        clientType: 'serviced',
        status: RequestStatus.new,
        kind: RequestKind.repair,
        partnerEstablishmentId: maintenance.partnerEstablishmentId,
        partnerLocationId: maintenance.partnerLocationId,
        fromMaintenanceRequestId: maintenance.id,
        companyOrFullName: maintenance.companyOrFullName,
        phone: maintenance.phone === '—' ? '+77000000000' : maintenance.phone,
        address: maintenance.address,
        problemDescription:
          body.problemDescription?.trim() ||
          `С обслуживания: ${findings}`,
        equipmentName: maintenance.equipmentName,
        malfunctionCustomText: findings,
      },
    });

    await tx.comment.create({
      data: {
        requestId: created.id,
        authorId: auth.userId,
        type: CommentType.system_event,
        text: `Создано с обслуживания (ТО ${maintenance.number}). Поломка: ${findings}`,
      },
    });

    await tx.comment.create({
      data: {
        requestId: maintenance.id,
        authorId: auth.userId,
        type: CommentType.system_event,
        text: `Переведено на ремонт: ${created.number}. ${findings}`,
      },
    });

    return created;
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'maintenance.transfer_to_repair',
    entityType: 'Request',
    entityId: repair.id,
    after: { fromMaintenanceId: requestId, number: repair.number },
  });

  return {
    id: repair.id,
    number: repair.number,
    fromMaintenance: true,
    label: 'С обслуживания',
  };
}

export async function downloadMaintenanceAct(
  partnerId: string,
  periodInput: string | undefined,
  auth: AuthContext,
): Promise<{ buffer: Buffer; filename: string }> {
  const period = periodInput ?? currentPeriod();
  const detail = await getPartnerMaintenanceDetail(partnerId, auth, period);

  if (!detail.stats.actReady) {
    throw new BadRequestError(
      'Акт доступен, когда закрыты все точки обслуживания за период',
    );
  }

  const partner = await prisma.partnerEstablishment.findUniqueOrThrow({
    where: { id: partnerId },
  });

  let setting = await getOrCreatePeriodSetting(partnerId, period, partner.maintenanceCloseDay);
  if (!setting.actNumber) {
    const max = await prisma.maintenancePeriodSetting.aggregate({ _max: { actNumber: true } });
    const next = (max._max.actNumber ?? 29) + 1;
    setting = await prisma.maintenancePeriodSetting.update({
      where: { id: setting.id },
      data: {
        actNumber: next,
        actDate: setting.actDate ?? defaultActDate(period, partner.maintenanceCloseDay),
      },
    });
  }

  const isGolpas =
    !partner.maintenancePriceIncludesVat || /golpas/i.test(partner.name);

  const defaultUnitPrice = decimalToNumber(partner.maintenanceUnitPrice) || 0;
  const priceIncludesVat = partner.maintenancePriceIncludesVat;
  // В образцах: «Costa …», «Hardee's …» (не «Costa Coffee»)
  const brandLabel = partner.name === 'Costa Coffee' ? 'Costa' : partner.name;
  const locationLines = detail.cities.flatMap((c) =>
    c.locations
      .filter((l) => l.request?.status === 'closed')
      .map((l) => {
        // Только в образце Hardee's Asia Park адрес в наименовании
        const withAddress =
          partner.name === "Hardee's" &&
          l.address &&
          /asia park/i.test(l.locationName)
            ? `${brandLabel} ${l.locationName}, ${l.address}`
            : `${brandLabel} ${l.locationName}`;
        return {
          name: withAddress,
          city: c.city,
          quantity: 1,
          unitPrice: l.maintenancePrice ?? defaultUnitPrice,
        };
      }),
  );

  // Golpas: одна строка на 600 000 ₸ без НДС (не сумма по точкам из КП)
  const GOLPAS_ACT_AMOUNT = 600_000;
  const lines = isGolpas
    ? [
        {
          name: `Обслуживание холодильного оборудования за ${periodMonthNameRu(period)} месяц`,
          city: '',
          quantity: 1,
          unitPrice: defaultUnitPrice > 0 ? defaultUnitPrice : GOLPAS_ACT_AMOUNT,
        },
      ]
    : locationLines;

  const actDate = setting.actDate ?? defaultActDate(period, partner.maintenanceCloseDay);
  const { year, month } = parsePeriod(period);
  const periodFrom = new Date(year, month - 1, 1);
  const periodTo = new Date(year, month, 0);

  const data: MaintenanceActData = {
    actNumber: setting.actNumber!,
    actDate,
    periodFrom,
    periodTo,
    periodLabel: isGolpas ? periodMonthNameRu(period) : periodLabelRu(period),
    periodMonthName: periodMonthNameRu(period),
    customerName: partner.maintenanceCustomerName ?? partner.name,
    customerBin: partner.maintenanceCustomerBin ?? '',
    customerAddress: partner.maintenanceCustomerAddress ?? '',
    executorName: partner.maintenanceExecutorName ?? 'ИП «BerekeТехСервис»',
    executorBin: partner.maintenanceExecutorBin ?? '',
    executorAddress: partner.maintenanceExecutorAddress ?? '',
    contractNumber: partner.maintenanceContractNumber ?? '',
    contractDate: partner.maintenanceContractDate,
    priceIncludesVat,
    variant: isGolpas ? 'golpas' : 'caspian',
    lines,
  };

  const buffer = await buildMaintenanceActPdf(data);
  const filename = actFilename(partner.name, period, setting.actNumber!, { golpas: isGolpas });
  return { buffer, filename };
}
