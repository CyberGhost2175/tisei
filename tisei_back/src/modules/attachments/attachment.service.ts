import { prisma } from '../../config/prisma.js';
import { NotFoundError, ForbiddenError } from '../../common/errors/AppError.js';
import { buildPaginated, toSkipTake } from '../../common/utils/pagination.js';
import { uploadToS3, resolveAttachmentUrl } from '../../common/storage/s3.service.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { assertRequestAccess, assertRequestWriteAccess, type AuthContext } from '../requests/request-access.js';
import type { paginationSchema } from '../../common/utils/pagination.js';
import type { z } from 'zod';

type Pagination = z.infer<typeof paginationSchema>;

async function toDto(a: {
  id: string;
  requestId: string;
  uploadedById: string | null;
  url: string;
  fileName: string | null;
  fileType: string | null;
  sizeBytes: number | null;
  createdAt: Date;
}) {
  return {
    ...a,
    url: await resolveAttachmentUrl(a.url),
    createdAt: a.createdAt.toISOString(),
  };
}

export async function listAttachments(requestId: string, query: Pagination, auth: AuthContext) {
  await assertRequestAccess(requestId, auth);
  const { skip, take } = toSkipTake(query);

  const [items, total] = await Promise.all([
    prisma.attachment.findMany({
      where: { requestId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.attachment.count({ where: { requestId } }),
  ]);

  return buildPaginated(await Promise.all(items.map(toDto)), total, query);
}

export async function uploadAttachment(
  requestId: string,
  file: { buffer: Buffer; filename: string; mimetype: string },
  auth: AuthContext,
) {
  await assertRequestWriteAccess(requestId, auth);

  const uploaded = await uploadToS3(file.buffer, file.filename, file.mimetype);

  const attachment = await prisma.attachment.create({
    data: {
      requestId,
      uploadedById: auth.userId,
      url: uploaded.url,
      fileName: uploaded.fileName,
      fileType: uploaded.fileType,
      sizeBytes: uploaded.sizeBytes,
    },
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'attachment.upload',
    entityType: 'Attachment',
    entityId: attachment.id,
    after: { requestId, fileName: uploaded.fileName },
  });

  return toDto(attachment);
}

/** Upload from public landing form (no auth). Only for site requests created recently. */
export async function uploadPublicAttachment(
  requestId: string,
  file: { buffer: Buffer; filename: string; mimetype: string },
) {
  const request = await prisma.request.findFirst({
    where: { id: requestId, deletedAt: null, source: 'site' },
  });
  if (!request) throw new NotFoundError('Заявка не найдена');

  const ageMs = Date.now() - request.createdAt.getTime();
  if (ageMs > 30 * 60 * 1000) {
    throw new ForbiddenError('Время для загрузки фото истекло');
  }

  const uploaded = await uploadToS3(file.buffer, file.filename, file.mimetype);

  const attachment = await prisma.attachment.create({
    data: {
      requestId,
      uploadedById: null,
      url: uploaded.url,
      fileName: uploaded.fileName,
      fileType: uploaded.fileType,
      sizeBytes: uploaded.sizeBytes,
    },
  });

  return toDto(attachment);
}

export async function deleteAttachment(
  requestId: string,
  attachmentId: string,
  auth: AuthContext,
) {
  await assertRequestAccess(requestId, auth);

  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, requestId },
  });
  if (!attachment) throw new NotFoundError('Вложение не найдено');

  await prisma.attachment.delete({ where: { id: attachmentId } });

  await writeAuditLog({
    userId: auth.userId,
    action: 'attachment.delete',
    entityType: 'Attachment',
    entityId: attachmentId,
  });
}
