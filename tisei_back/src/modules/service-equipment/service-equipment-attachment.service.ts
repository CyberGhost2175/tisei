import type { UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { uploadToS3, resolveAttachmentUrl } from '../../common/storage/s3.service.js';
import { writeAuditLog } from '../audit/audit.service.js';

type AuthContext = { userId: string; role: UserRole };

async function toDto(a: {
  id: string;
  serviceEquipmentId: string;
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

async function getEquipmentOrThrow(id: string) {
  const row = await prisma.serviceEquipment.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('Запись не найдена');
  return row;
}

export async function listServiceEquipmentAttachments(serviceEquipmentId: string) {
  await getEquipmentOrThrow(serviceEquipmentId);
  const items = await prisma.serviceEquipmentAttachment.findMany({
    where: { serviceEquipmentId },
    orderBy: { createdAt: 'desc' },
  });
  return Promise.all(items.map(toDto));
}

export async function uploadServiceEquipmentAttachment(
  serviceEquipmentId: string,
  file: { buffer: Buffer; filename: string; mimetype: string },
  auth: AuthContext,
) {
  await getEquipmentOrThrow(serviceEquipmentId);

  const uploaded = await uploadToS3(file.buffer, file.filename, file.mimetype);

  const attachment = await prisma.serviceEquipmentAttachment.create({
    data: {
      serviceEquipmentId,
      uploadedById: auth.userId,
      url: uploaded.url,
      fileName: uploaded.fileName,
      fileType: uploaded.fileType,
      sizeBytes: uploaded.sizeBytes,
    },
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'service_equipment.attachment.upload',
    entityType: 'ServiceEquipmentAttachment',
    entityId: attachment.id,
    after: { serviceEquipmentId, fileName: uploaded.fileName },
  });

  return toDto(attachment);
}

export async function deleteServiceEquipmentAttachment(
  serviceEquipmentId: string,
  attachmentId: string,
  auth: AuthContext,
) {
  await getEquipmentOrThrow(serviceEquipmentId);

  const attachment = await prisma.serviceEquipmentAttachment.findFirst({
    where: { id: attachmentId, serviceEquipmentId },
  });
  if (!attachment) throw new NotFoundError('Фото не найдено');

  await prisma.serviceEquipmentAttachment.delete({ where: { id: attachmentId } });

  await writeAuditLog({
    userId: auth.userId,
    action: 'service_equipment.attachment.delete',
    entityType: 'ServiceEquipmentAttachment',
    entityId: attachmentId,
  });
}

export async function mapAttachmentsForDto(
  attachments: Array<{
    id: string;
    serviceEquipmentId: string;
    uploadedById: string | null;
    url: string;
    fileName: string | null;
    fileType: string | null;
    sizeBytes: number | null;
    createdAt: Date;
  }>,
) {
  return Promise.all(attachments.map(toDto));
}
