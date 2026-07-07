import {
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
import { executorCanViewRequest } from './request-access.js';
import { buildPaginated, toSkipTake, type PaginatedResult } from '../../common/utils/pagination.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { notifyNewRequest } from '../notifications/notification.service.js';
import { detectClientType } from './client-type.service.js';
import { generateRequestNumber } from './request-number.service.js';
import { assertTransition } from './status-transition.service.js';
import { createServiceEquipmentFromRequest } from '../service-equipment/service-equipment.service.js';
import { resolvePartnerLink, resolveRequestPriority } from './resolve-priority.js';
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
  assignments: { include: { executor: { select: { id: true, fullName: true, email: true } } } },
  partnerEstablishment: { select: { id: true, name: true } },
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

  if (auth.role === 'executor') {
    if (query.mine) {
      where.assignments = { some: { executorId: auth.userId } };
    } else if (query.available) {
      where.assignments = { none: {} };
      if (!query.status && !query.active) {
        where.status = { notIn: ['closed', 'cancelled'] };
      }
    }
  } else if (query.executorId) {
    where.assignments = { some: { executorId: query.executorId } };
  }

  return where;
}

async function getRequestOrThrow(id: string, _auth?: AuthContext): Promise<RequestDto> {
  const request = await prisma.request.findFirst({
    where: { id },
    include: requestInclude,
  });

  if (!request) throw new NotFoundError('Заявка не найдена');

  return request;
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

  const [items, total] = await Promise.all([
    prisma.request.findMany({ where, skip, take, orderBy, include: requestInclude }),
    prisma.request.count({ where }),
  ]);

  return buildPaginated(items, total, query);
}

export async function getRequestById(id: string, auth: AuthContext): Promise<RequestDto> {
  const request = await getRequestOrThrow(id, auth);
  if (auth.role === 'executor' && !executorCanViewRequest(request, auth.userId)) {
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

    if (auth) {
      await tx.comment.create({
        data: {
          requestId: created.id,
          authorId: auth.userId,
          type: CommentType.system_event,
          text: `Заявка создана (${source === RequestSource.site ? 'с сайта' : 'вручную'})`,
        },
      });
    }

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

  if (body.clientType && body.clientType !== existing.clientType && auth.role === 'executor') {
    throw new ForbiddenError('Исполнитель не может менять тип клиента');
  }

  if ((body.priority !== undefined || body.partnerEstablishmentId !== undefined) && auth.role === 'executor') {
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
  assertTransition(existing.status, status);

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

  const updated = await prisma.request.update({
    where: { id },
    data,
    include: requestInclude,
  });

  if (status === RequestStatus.in_service) {
    await createServiceEquipmentFromRequest(id);
  }

  await prisma.comment.create({
    data: {
      requestId: id,
      authorId: auth.userId,
      type: CommentType.system_event,
      text: `Статус изменён: ${existing.status} → ${status}`,
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

  return updated;
}

export async function assignExecutors(
  id: string,
  executorIds: string[],
  auth: AuthContext,
): Promise<RequestDto> {
  if (auth.role === 'executor') {
    throw new ForbiddenError('Исполнитель не может назначать других исполнителей');
  }

  await getRequestOrThrow(id, auth);

  const executors = await prisma.user.findMany({
    where: { id: { in: executorIds }, role: 'executor', isActive: true },
  });

  if (executors.length !== executorIds.length) {
    throw new BadRequestError('Один или несколько исполнителей не найдены');
  }

  await prisma.$transaction([
    prisma.requestAssignment.deleteMany({ where: { requestId: id } }),
    prisma.requestAssignment.createMany({
      data: executorIds.map((executorId) => ({ requestId: id, executorId })),
    }),
  ]);

  const existing = await prisma.request.findUnique({ where: { id }, select: { status: true } });
  if (existing?.status === RequestStatus.new) {
    await prisma.request.update({
      where: { id },
      data: { status: RequestStatus.in_progress },
    });
  }

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.assign',
    entityType: 'Request',
    entityId: id,
    after: { executorIds },
  });

  return getRequestOrThrow(id, auth);
}

/** Исполнитель берёт заявку в работу */
export async function claimRequest(id: string, auth: AuthContext): Promise<RequestDto> {
  if (auth.role !== 'executor') {
    throw new ForbiddenError('Только исполнитель может взять заявку');
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
    data: { requestId: id, executorId: auth.userId },
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
        text: 'Исполнитель взял заявку в работу',
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

export async function freezeRequest(
  id: string,
  frozenReason: string,
  auth: AuthContext,
): Promise<RequestDto> {
  return changeRequestStatus(id, RequestStatus.frozen, auth, { frozenReason });
}

export async function softDeleteRequest(id: string, auth: AuthContext): Promise<void> {
  if (auth.role === 'executor') throw new ForbiddenError('Недостаточно прав');
  await getRequestOrThrow(id, auth);

  await prisma.request.update({ where: { id }, data: { deletedAt: new Date() } });

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.soft_delete',
    entityType: 'Request',
    entityId: id,
  });
}

export async function restoreRequest(id: string, auth: AuthContext): Promise<RequestDto> {
  if (auth.role === 'executor') throw new ForbiddenError('Недостаточно прав');

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
      priority: source.priority,
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
