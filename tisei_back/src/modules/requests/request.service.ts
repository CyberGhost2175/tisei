import {
  AssignmentStatus,
  ClientType,
  CommentType,
  Prisma,
  RequestSource,
  RequestStatus,
  type UserRole,
} from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import {
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from '../../common/errors/AppError.js';
import { fieldRoleCanViewRequest } from './request-access.js';
import { buildPaginated, toSkipTake, type PaginatedResult } from '../../common/utils/pagination.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { statusLabelRu } from '../../common/utils/labels.ru.js';
import { isFieldRole, isPartnerMaster, isStaffMaster } from '../../common/utils/roles.js';
import {
  notifyNewRequest,
  notifyRequestAssigned,
  notifyRequestStatusChanged,
} from '../notifications/notification.service.js';
import { detectClientType } from './client-type.service.js';
import { generateRequestNumber } from './request-number.service.js';
import { assertTransitionWithRole } from './status-transition.service.js';
import { createServiceEquipmentFromRequest } from '../service-equipment/service-equipment.service.js';
import { resolvePartnerLink, resolveRequestPriority } from './resolve-priority.js';
import { resolvePartnerLocationId } from './partner-match.js';
import type {
  CreateRequestBody,
  RequestListQuery,
  UpdateRequestBody,
} from './request.schemas.js';

type AuthContext = { userId: string; role: UserRole };

const requestInclude = {
  client: true,
  equipmentCategory: true,
  malfunctionType: true,
  assignments: {
    include: {
      executor: { select: { id: true, fullName: true, email: true, role: true } },
    },
  },
  partnerEstablishment: { select: { id: true, name: true } },
  partnerLocation: { select: { id: true, name: true, city: true, address: true } },
  fromMaintenanceRequest: { select: { id: true, number: true } },
  closingForm: true,
} satisfies Prisma.RequestInclude;

export type RequestDto = Prisma.RequestGetPayload<{ include: typeof requestInclude }>;

function buildWhere(query: RequestListQuery, auth: AuthContext): Prisma.RequestWhereInput {
  const where: Prisma.RequestWhereInput = {};

  if (!query.includeDeleted) {
    where.deletedAt = null;
  }

  if (query.status) {
    where.status = query.status;
  } else if (query.active) {
    where.status = { notIn: ['closed', 'cancelled'] };
  }

  if (query.priority) where.priority = query.priority;
  if (query.clientType) where.clientType = query.clientType;

  if (query.kind === 'all') {
    // оба типа
  } else if (query.kind === 'maintenance') {
    where.kind = 'maintenance';
  } else {
    where.kind = 'repair';
  }

  if (query.deadlineFrom || query.deadlineTo) {
    where.deadline = {};
    if (query.deadlineFrom) where.deadline.gte = query.deadlineFrom;
    if (query.deadlineTo) where.deadline.lte = query.deadlineTo;
  }

  if (query.search) {
    where.OR = [
      { number: { contains: query.search, mode: 'insensitive' } },
      { companyOrFullName: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search } },
      { address: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (isFieldRole(auth.role)) {
    if (query.mine) {
      where.assignments = { some: { executorId: auth.userId } };
    } else if (query.available) {
      // Партнёрский мастер не видит свободный пул — только менеджер назначает.
      if (isPartnerMaster(auth.role)) {
        where.id = { in: [] };
      } else {
        where.assignments = { none: {} };
        if (!query.status && !query.active) {
          where.status = { notIn: ['closed', 'cancelled'] };
        }
      }
    } else if (isPartnerMaster(auth.role)) {
      where.assignments = { some: { executorId: auth.userId } };
    } else if (isStaffMaster(auth.role) && query.status === 'closed') {
      // Штатный мастер в разделе «Закрытые» видит свои закрытые заявки.
      where.assignments = { some: { executorId: auth.userId } };
    }
  } else if (query.executorId) {
    where.assignments = { some: { executorId: query.executorId } };
  }

  return where;
}

function hasAcceptedAssignment(request: RequestDto): boolean {
  return request.assignments.some((a) => a.status === AssignmentStatus.accepted);
}

/** Если есть принятое назначение, а статус «новая» — переводим в «в работе». */
async function syncAssignedStatusInProgress(request: RequestDto): Promise<RequestDto> {
  if (request.status === RequestStatus.new && hasAcceptedAssignment(request)) {
    return prisma.request.update({
      where: { id: request.id },
      data: { status: RequestStatus.in_progress },
      include: requestInclude,
    });
  }
  return request;
}

async function getRequestOrThrow(id: string, _auth?: AuthContext): Promise<RequestDto> {
  const request = await prisma.request.findFirst({
    where: { id },
    include: requestInclude,
  });

  if (!request) throw new NotFoundError('Заявка не найдена');

  return syncAssignedStatusInProgress(request);
}

export async function listRequests(
  query: RequestListQuery,
  auth: AuthContext,
): Promise<PaginatedResult<RequestDto>> {
  const where = buildWhere(query, auth);
  const { skip, take } = toSkipTake(query);

  const orderBy: Prisma.RequestOrderByWithRelationInput = {
    [query.sortBy]: query.sortOrder,
  };

  const [rawItems, total] = await Promise.all([
    prisma.request.findMany({ where, skip, take, orderBy, include: requestInclude }),
    prisma.request.count({ where }),
  ]);

  const items = await Promise.all(rawItems.map(syncAssignedStatusInProgress));

  return buildPaginated(items, total, query);
}

export async function getRequestById(id: string, auth: AuthContext): Promise<RequestDto> {
  const request = await getRequestOrThrow(id, auth);
  if (
    isFieldRole(auth.role) &&
    !fieldRoleCanViewRequest(request, auth.userId, auth.role)
  ) {
    throw new ForbiddenError('Нет доступа к этой заявке');
  }
  return request;
}

export async function createRequest(
  body: CreateRequestBody,
  auth: AuthContext | null,
  source: RequestSource = RequestSource.manual,
): Promise<RequestDto> {
  let clientType = body.clientType;
  let clientId = body.clientId ?? null;

  if (!clientType) {
    const detected = await detectClientType({ phone: body.phone, address: body.address });
    clientType = detected.clientType;
    clientId = clientId ?? detected.clientId;
  }

  const number = await generateRequestNumber();

  const partnerEstablishmentId = await resolvePartnerLink({
    companyOrFullName: body.companyOrFullName,
    partnerEstablishmentId: body.partnerEstablishmentId,
  });

  const partnerLocationId = await resolvePartnerLocationId({
    partnerEstablishmentId,
    address: body.address,
    companyOrFullName: body.companyOrFullName,
  });

  const priority = await resolveRequestPriority({
    isCreate: true,
  });

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.request.create({
      data: {
        number,
        source,
        clientType: clientType as ClientType,
        clientId,
        partnerEstablishmentId,
        partnerLocationId,
        companyOrFullName: body.companyOrFullName,
        phone: body.phone,
        email: body.email,
        address: body.address,
        equipmentCategoryId: body.equipmentCategoryId,
        equipmentCategoryText: body.equipmentCategoryText,
        equipmentName: body.equipmentName,
        problemDescription: body.problemDescription,
        malfunctionTypeId: body.malfunctionTypeId,
        malfunctionCustomText: body.malfunctionCustomText,
        priority,
        deadline: body.deadline,
      },
      include: requestInclude,
    });

    await tx.comment.create({
      data: {
        requestId: created.id,
        authorId: auth?.userId ?? null,
        type: CommentType.system_event,
        text:
          source === RequestSource.site
            ? 'Заявка создана с сайта. Исполнитель не назначен.'
            : 'Заявка создана вручную. Исполнитель не назначен.',
      },
    });

    return created;
  });

  if (auth) {
    await writeAuditLog({
      userId: auth.userId,
      action: 'request.create',
      entityType: 'Request',
      entityId: request.id,
      after: { number: request.number, status: request.status },
    });
  }

  if (body.address) {
    void enqueueGeocode(request.id, body.address);
  }

  void notifyNewRequest(request).catch(() => {
    /* уведомления не блокируют создание */
  });

  return request;
}

export async function updateRequest(
  id: string,
  body: UpdateRequestBody,
  auth: AuthContext,
): Promise<RequestDto> {
  const existing = await getRequestOrThrow(id, auth);

  if (body.clientType && body.clientType !== existing.clientType && isFieldRole(auth.role)) {
    throw new ForbiddenError('Исполнитель не может менять тип клиента');
  }

  if (
    (body.priority !== undefined || body.partnerEstablishmentId !== undefined) &&
    isFieldRole(auth.role)
  ) {
    throw new ForbiddenError('Исполнитель не может менять приоритет и партнёра');
  }

  const companyName = body.companyOrFullName ?? existing.companyOrFullName;

  let partnerEstablishmentId: string | null;
  if (body.partnerEstablishmentId !== undefined) {
    partnerEstablishmentId = body.partnerEstablishmentId;
  } else if (body.companyOrFullName !== undefined) {
    partnerEstablishmentId = await resolvePartnerLink({
      companyOrFullName: companyName,
      partnerEstablishmentId: null,
    });
  } else {
    partnerEstablishmentId = existing.partnerEstablishmentId;
  }

  const address = body.address ?? existing.address;
  const partnerLocationId = await resolvePartnerLocationId({
    partnerEstablishmentId,
    address,
    companyOrFullName: companyName,
    partnerLocationId: existing.partnerLocationId,
  });

  const priority = await resolveRequestPriority({
    requestedPriority: body.priority,
    existingPriority: existing.priority,
  });

  const { priority: _omitPriority, ...restBody } = body;

  const updated = await prisma.request.update({
    where: { id },
    data: {
      ...restBody,
      clientType: body.clientType as ClientType | undefined,
      partnerEstablishmentId,
      partnerLocationId,
      priority,
    },
    include: requestInclude,
  });

  if (body.clientType && body.clientType !== existing.clientType) {
    await writeAuditLog({
      userId: auth.userId,
      action: 'request.clientType.override',
      entityType: 'Request',
      entityId: id,
      before: { clientType: existing.clientType },
      after: { clientType: body.clientType },
    });
  }

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.update',
    entityType: 'Request',
    entityId: id,
    before: { status: existing.status },
    after: { status: updated.status },
  });

  if (body.address && body.address !== existing.address) {
    void enqueueGeocode(id, body.address);
  }

  return updated;
}

export async function changeRequestStatus(
  id: string,
  status: RequestStatus,
  auth: AuthContext,
  options?: { frozenReason?: string; equipmentCategoryId?: string },
): Promise<RequestDto> {
  const existing = await getRequestOrThrow(id, auth);
  assertTransitionWithRole(existing.status, status, auth.role);

  const data: Prisma.RequestUpdateInput = { status };

  if (status === RequestStatus.frozen) {
    if (!options?.frozenReason) throw new BadRequestError('Укажите причину заморозки');
    data.frozenAt = new Date();
    data.frozenReason = options.frozenReason;
  }

  if (status === RequestStatus.in_service) {
    if (options?.equipmentCategoryId) {
      data.equipmentCategory = { connect: { id: options.equipmentCategoryId } };
    }
    const categoryId = options?.equipmentCategoryId ?? existing.equipmentCategoryId;
    const categoryText = existing.equipmentCategoryText;
    if (!categoryId && !categoryText) {
      throw new BadRequestError('Укажите категорию оборудования для перевода в сервис');
    }
  }

  if (status === RequestStatus.closed) {
    const closingForm = await prisma.closingForm.findUnique({ where: { requestId: id } });
    if (!closingForm?.isLocked) {
      throw new BadRequestError(
        'Закрытие возможно только через анкету: заполните приход, расход, работы и нажмите «Подтвердить и закрыть»',
      );
    }
    data.closedAt = new Date();
  }

  const reactivatingFromClosed =
    existing.status === RequestStatus.closed && status !== RequestStatus.closed;

  if (reactivatingFromClosed) {
    data.closedAt = null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    // При реактивации закрытой заявки сбрасываем исполнителей — нужно назначить заново.
    if (reactivatingFromClosed) {
      await tx.requestAssignment.deleteMany({ where: { requestId: id } });
      await tx.closingForm.updateMany({
        where: { requestId: id },
        data: { isLocked: false, confirmedAt: null },
      });
    }

    return tx.request.update({
      where: { id },
      data,
      include: requestInclude,
    });
  });

  if (status === RequestStatus.in_service) {
    await createServiceEquipmentFromRequest(id);
  }

  await prisma.comment.create({
    data: {
      requestId: id,
      authorId: auth.userId,
      type: CommentType.system_event,
      text: reactivatingFromClosed
        ? `Статус изменён: ${statusLabelRu(existing.status)} → ${statusLabelRu(status)}. Исполнитель сброшен — назначьте заново.`
        : `Статус изменён: ${statusLabelRu(existing.status)} → ${statusLabelRu(status)}`,
    },
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.status.change',
    entityType: 'Request',
    entityId: id,
    before: { status: existing.status },
    after: { status },
  });

  void notifyRequestStatusChanged(
    {
      id: updated.id,
      number: updated.number,
      companyOrFullName: updated.companyOrFullName,
    },
    existing.status,
    status,
    { excludeUserId: auth.userId },
  ).catch(() => {
    /* уведомления не блокируют смену статуса */
  });

  return updated;
}

export async function assignExecutors(
  id: string,
  executorIds: string[],
  auth: AuthContext,
): Promise<RequestDto> {
  if (isFieldRole(auth.role)) {
    throw new ForbiddenError('Мастер не может назначать исполнителей');
  }

  await getRequestOrThrow(id, auth);

  const executors = await prisma.user.findMany({
    where: { id: { in: executorIds }, role: { in: ['executor', 'master'] }, isActive: true },
  });

  if (executors.length !== executorIds.length) {
    throw new BadRequestError('Один или несколько мастеров не найдены');
  }

  const names = executors.map((e) => e.fullName).join(', ');
  const hasAccepted = executors.some((e) => isStaffMaster(e.role));
  const offeredIds = executors.filter((e) => isPartnerMaster(e.role)).map((e) => e.id);
  const assignedIds = executors.filter((e) => isStaffMaster(e.role)).map((e) => e.id);

  await prisma.$transaction([
    prisma.requestAssignment.deleteMany({ where: { requestId: id } }),
    prisma.requestAssignment.createMany({
      data: executors.map((e) => ({
        requestId: id,
        executorId: e.id,
        status: isPartnerMaster(e.role)
          ? AssignmentStatus.proposed
          : AssignmentStatus.accepted,
      })),
    }),
  ]);

  const existing = await prisma.request.findUnique({ where: { id }, select: { status: true } });
  if (hasAccepted && existing?.status === RequestStatus.new) {
    await prisma.request.update({
      where: { id },
      data: { status: RequestStatus.in_progress },
    });
  }

  const commentText =
    offeredIds.length > 0 && assignedIds.length === 0
      ? `Предложена заявка мастеру: ${names}`
      : offeredIds.length > 0
        ? `Назначен / предложен мастер: ${names}`
        : `Назначен мастер: ${names}`;

  await prisma.comment.create({
    data: {
      requestId: id,
      authorId: auth.userId,
      type: CommentType.system_event,
      text: commentText,
    },
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.assign',
    entityType: 'Request',
    entityId: id,
    after: { executorIds },
  });

  const assigned = await prisma.request.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      companyOrFullName: true,
      address: true,
    },
  });
  if (assigned) {
    if (assignedIds.length > 0) {
      void notifyRequestAssigned(assigned, assignedIds).catch(() => {
        /* уведомления не блокируют назначение */
      });
    }
    if (offeredIds.length > 0) {
      void notifyRequestAssigned(assigned, offeredIds, { proposed: true }).catch(() => {
        /* уведомления не блокируют назначение */
      });
    }
  }

  return getRequestOrThrow(id, auth);
}

/** Штатный мастер берёт заявку в работу */
export async function claimRequest(id: string, auth: AuthContext): Promise<RequestDto> {
  if (!isStaffMaster(auth.role)) {
    throw new ForbiddenError(
      isPartnerMaster(auth.role)
        ? 'Мастер не может самостоятельно брать заявки — дождитесь назначения менеджера'
        : 'Только штатный мастер может взять заявку',
    );
  }

  const request = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    include: requestInclude,
  });
  if (!request) throw new NotFoundError('Заявка не найдена');
  if (request.status === 'closed' || request.status === 'cancelled') {
    throw new BadRequestError('Нельзя взять закрытую или отменённую заявку');
  }

  const already = request.assignments.some((a) => a.executorId === auth.userId);
  if (already) return request;

  await prisma.requestAssignment.create({
    data: {
      requestId: id,
      executorId: auth.userId,
      status: AssignmentStatus.accepted,
    },
  });

  if (request.status === RequestStatus.new) {
    await prisma.request.update({
      where: { id },
      data: { status: RequestStatus.in_progress },
    });
    await prisma.comment.create({
      data: {
        requestId: id,
        authorId: auth.userId,
        type: CommentType.system_event,
        text: 'Штатный мастер взял заявку в работу',
      },
    });
  }

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.claim',
    entityType: 'Request',
    entityId: id,
  });

  return getRequestOrThrow(id, auth);
}

/** Партнёрский мастер принимает предложенную заявку */
export async function acceptRequestOffer(id: string, auth: AuthContext): Promise<RequestDto> {
  if (!isFieldRole(auth.role)) {
    throw new ForbiddenError('Только мастер может принять предложенную заявку');
  }

  const request = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    include: requestInclude,
  });
  if (!request) throw new NotFoundError('Заявка не найдена');

  const mine = request.assignments.find((a) => a.executorId === auth.userId);
  if (!mine) throw new BadRequestError('Вам не предложена эта заявка');
  if (mine.status === AssignmentStatus.accepted) return request;

  await prisma.requestAssignment.update({
    where: { id: mine.id },
    data: { status: AssignmentStatus.accepted },
  });

  if (request.status === RequestStatus.new) {
    await prisma.request.update({
      where: { id },
      data: { status: RequestStatus.in_progress },
    });
  }

  await prisma.comment.create({
    data: {
      requestId: id,
      authorId: auth.userId,
      type: CommentType.system_event,
      text: 'Мастер принял предложенную заявку',
    },
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.accept_offer',
    entityType: 'Request',
    entityId: id,
  });

  return getRequestOrThrow(id, auth);
}

/** Любой мастер отказывается от заявки — она возвращается в «Новые». */
export async function declineRequest(id: string, auth: AuthContext): Promise<RequestDto> {
  if (!isFieldRole(auth.role)) {
    throw new ForbiddenError('Только мастер может отказаться от заявки');
  }

  const request = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    include: requestInclude,
  });
  if (!request) throw new NotFoundError('Заявка не найдена');
  if (request.status === 'closed' || request.status === 'cancelled') {
    throw new BadRequestError('Нельзя отказаться от закрытой или отменённой заявки');
  }

  const mine = request.assignments.find((a) => a.executorId === auth.userId);
  if (!mine) throw new BadRequestError('Вы не назначены на эту заявку');

  await prisma.requestAssignment.delete({ where: { id: mine.id } });

  await prisma.request.update({
    where: { id },
    data: { status: RequestStatus.new },
  });

  await prisma.comment.create({
    data: {
      requestId: id,
      authorId: auth.userId,
      type: CommentType.system_event,
      text: 'Мастер отказался от заявки. Статус: Новая',
    },
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.decline',
    entityType: 'Request',
    entityId: id,
  });

  void notifyRequestStatusChanged(
    {
      id: request.id,
      number: request.number,
      companyOrFullName: request.companyOrFullName,
    },
    request.status,
    RequestStatus.new,
    { excludeUserId: auth.userId },
  ).catch(() => {
    /* уведомления не блокируют отказ */
  });

  return getRequestOrThrow(id, auth);
}

export async function freezeRequest(
  id: string,
  frozenReason: string,
  auth: AuthContext,
): Promise<RequestDto> {
  return changeRequestStatus(id, RequestStatus.frozen, auth, { frozenReason });
}

export async function softDeleteRequest(id: string, auth: AuthContext): Promise<void> {
  if (isFieldRole(auth.role)) throw new ForbiddenError('Недостаточно прав');
  await getRequestOrThrow(id, auth);

  await prisma.request.update({ where: { id }, data: { deletedAt: new Date() } });

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.soft_delete',
    entityType: 'Request',
    entityId: id,
  });
}

/** Массовое мягкое удаление заявок. */
export async function softDeleteRequests(ids: string[], auth: AuthContext): Promise<{ deleted: number }> {
  if (isFieldRole(auth.role)) throw new ForbiddenError('Недостаточно прав');
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) throw new BadRequestError('Не выбраны заявки');
  if (uniqueIds.length > 100) throw new BadRequestError('За один раз не больше 100 заявок');

  const result = await prisma.request.updateMany({
    where: { id: { in: uniqueIds }, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.soft_delete_bulk',
    entityType: 'Request',
    entityId: uniqueIds[0]!,
    after: { ids: uniqueIds, deleted: result.count },
  });

  return { deleted: result.count };
}

export async function restoreRequest(id: string, auth: AuthContext): Promise<RequestDto> {
  if (isFieldRole(auth.role)) throw new ForbiddenError('Недостаточно прав');

  const request = await prisma.request.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!request) throw new NotFoundError('Заявка не найдена или не удалена');

  const retentionMs = env.SOFT_DELETE_RETENTION_DAYS * 86_400_000;
  if (Date.now() - request.deletedAt!.getTime() > retentionMs) {
    throw new BadRequestError('Срок восстановления заявки истёк');
  }

  const restored = await prisma.request.update({
    where: { id },
    data: { deletedAt: null },
    include: requestInclude,
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.restore',
    entityType: 'Request',
    entityId: id,
  });

  return restored;
}

export async function duplicateRequest(id: string, auth: AuthContext): Promise<RequestDto> {
  const source = await getRequestOrThrow(id, auth);
  const number = await generateRequestNumber();

  const duplicate = await prisma.request.create({
    data: {
      number,
      source: source.source,
      clientType: source.clientType,
      status: RequestStatus.new,
      priority: null,
      clientId: source.clientId,
      companyOrFullName: source.companyOrFullName,
      phone: source.phone,
      email: source.email,
      address: source.address,
      latitude: source.latitude,
      longitude: source.longitude,
      equipmentCategoryId: source.equipmentCategoryId,
      equipmentName: source.equipmentName,
      problemDescription: source.problemDescription,
      malfunctionTypeId: source.malfunctionTypeId,
      malfunctionCustomText: source.malfunctionCustomText,
      deadline: source.deadline,
      usedParts: source.usedParts,
    },
    include: requestInclude,
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.duplicate',
    entityType: 'Request',
    entityId: duplicate.id,
    after: { sourceId: id, number: duplicate.number },
  });

  return duplicate;
}

async function enqueueGeocode(requestId: string, address: string): Promise<void> {
  try {
    const { geocodeQueue } = await import('../../jobs/queues.js');
    await geocodeQueue.add('geocode', { requestId, address }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
  } catch {
    // Queue unavailable in dev without worker — non-blocking
  }
}
