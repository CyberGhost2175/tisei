import { prisma } from '../../config/prisma.js';
import { BadRequestError, NotFoundError } from '../../common/errors/AppError.js';
import { generateOpaqueToken, sha256 } from '../../common/utils/crypto.js';
import { decimalToNumber } from '../../common/utils/money.js';
import { resolveAttachmentUrl } from '../../common/storage/s3.service.js';
import { env } from '../../config/env.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { assertRequestAccess, type AuthContext } from './request-access.js';
import { buildRepairActPdf } from './repair-act-pdf.js';

function publicActUrls(rawToken: string) {
  const pageUrl = `${env.FRONTEND_CRM_URL.replace(/\/$/, '')}/act/${rawToken}`;
  const pdfUrl = `${env.API_BASE_URL.replace(/\/$/, '')}/api/v1/public/acts/${rawToken}/pdf`;
  return { url: pageUrl, pdfUrl, token: rawToken };
}

export async function createOrGetActShare(requestId: string, auth: AuthContext) {
  const request = await assertRequestAccess(requestId, auth);

  if (request.status !== 'closed') {
    throw new BadRequestError('Ссылку на акт можно создать только для закрытой заявки');
  }

  if (request.deletedAt) {
    throw new NotFoundError('Заявка не найдена');
  }

  const rawToken = generateOpaqueToken(32);
  const tokenHash = sha256(rawToken);

  await prisma.request.update({
    where: { id: requestId },
    data: {
      actShareTokenHash: tokenHash,
      actShareCreatedAt: new Date(),
    },
  });

  await writeAuditLog({
    userId: auth.userId,
    action: 'request.act_share.create',
    entityType: 'Request',
    entityId: requestId,
  });

  return publicActUrls(rawToken);
}

async function loadPublicActRequest(token: string) {
  const tokenHash = sha256(token);
  const request = await prisma.request.findFirst({
    where: {
      actShareTokenHash: tokenHash,
      deletedAt: null,
      status: 'closed',
    },
    include: {
      equipmentCategory: { select: { name: true } },
      partnerEstablishment: { select: { name: true } },
      assignments: {
        include: { executor: { select: { fullName: true } } },
      },
      closingForm: true,
      comments: {
        include: { author: { select: { fullName: true } } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: {
        orderBy: { createdAt: 'asc' },
      },
      partUsages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!request) {
    throw new NotFoundError('Акт не найден или ссылка недействительна');
  }

  return request;
}

function mapParts(
  partUsages: Array<{
    id: string;
    partNameSnapshot: string;
    quantity: number;
    unitPriceSnapshot: Parameters<typeof decimalToNumber>[0];
    lineTotal: Parameters<typeof decimalToNumber>[0];
  }>,
) {
  return partUsages.map((p) => ({
    id: p.id,
    name: p.partNameSnapshot,
    quantity: p.quantity,
    unitPrice: decimalToNumber(p.unitPriceSnapshot),
    lineTotal: decimalToNumber(p.lineTotal),
  }));
}

export async function getPublicActByToken(token: string) {
  const request = await loadPublicActRequest(token);

  const attachments = await Promise.all(
    request.attachments.map(async (a) => ({
      id: a.id,
      url: await resolveAttachmentUrl(a.url),
      fileName: a.fileName,
      fileType: a.fileType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
    })),
  );

  const closing = request.closingForm;
  const parts = mapParts(request.partUsages);

  return {
    number: request.number,
    status: request.status,
    closedAt: request.closedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    companyOrFullName: request.companyOrFullName,
    phone: request.phone,
    email: request.email,
    address: request.address,
    partnerName: request.partnerEstablishment?.name ?? null,
    equipmentCategoryName:
      request.equipmentCategory?.name ?? request.equipmentCategoryText ?? null,
    equipmentName: request.equipmentName,
    problemDescription: request.problemDescription,
    executors: request.assignments.map((a) => ({ fullName: a.executor.fullName })),
    closing: closing
      ? {
          workPerformed: closing.workPerformed,
          executorName: closing.executorName,
          confirmedAt: closing.confirmedAt?.toISOString() ?? null,
          addressSnapshot: closing.addressSnapshot,
          incomeAmount: decimalToNumber(closing.incomeAmount),
        }
      : null,
    parts,
    comments: request.comments.map((c) => ({
      id: c.id,
      type: c.type,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
      authorName: c.author?.fullName ?? null,
    })),
    attachments,
  };
}

export async function getPublicActPdfByToken(token: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const request = await loadPublicActRequest(token);
  const closing = request.closingForm;
  const parts = mapParts(request.partUsages);
  const buffer = await buildRepairActPdf({
    number: request.number,
    closedAt: request.closedAt?.toISOString() ?? closing?.confirmedAt?.toISOString() ?? null,
    companyOrFullName: request.companyOrFullName,
    phone: request.phone,
    email: request.email,
    address: closing?.addressSnapshot ?? request.address,
    partnerName: request.partnerEstablishment?.name ?? null,
    equipmentCategoryName:
      request.equipmentCategory?.name ?? request.equipmentCategoryText ?? null,
    equipmentName: request.equipmentName,
    problemDescription: request.problemDescription,
    executorName:
      closing?.executorName ??
      (request.assignments.map((a) => a.executor.fullName).join(', ') || null),
    workPerformed: closing?.workPerformed ?? null,
    comments: request.comments
      .filter((c) => c.type === 'comment')
      .map((c) => ({
        authorName: c.author?.fullName ?? null,
        text: c.text,
        createdAt: c.createdAt.toISOString(),
      })),
    parts,
    attachmentNames: request.attachments.map((a) => a.fileName ?? 'Файл'),
    incomeAmount: closing ? decimalToNumber(closing.incomeAmount) : null,
  });

  return {
    buffer,
    filename: `act-${request.number}.pdf`,
  };
}
