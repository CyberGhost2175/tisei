import { prisma } from '../../config/prisma.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { decimalToNumber } from '../../common/utils/money.js';
import type { AuthContext } from '../requests/request-access.js';
import { assertRequestAccess } from '../requests/request-access.js';

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Minimal valid PDF 1.4 document with request summary text. */
function buildSimplePdf(lines: string[]): Buffer {
  const content = lines.map((l, i) => `BT /F1 11 Tf 50 ${750 - i * 16} Td (${escapePdfText(l)}) Tj ET`).join('\n');
  const stream = `stream\n${content}\nendstream`;

  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj',
    `4 0 obj<< /Length ${Buffer.byteLength(content) + 16} >>${stream}`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += obj + '\n';
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf);
}

export async function exportRequestPdf(requestId: string, auth: AuthContext): Promise<Buffer> {
  await assertRequestAccess(requestId, auth);

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      client: true,
      equipmentCategory: true,
      malfunctionType: true,
      assignments: { include: { executor: { select: { fullName: true } } } },
      closingForm: true,
      comments: { orderBy: { createdAt: 'asc' }, take: 20 },
    },
  });

  if (!request) throw new NotFoundError('Заявка не найдена');

  const lines = [
    'Береке ТехСервис CRM - Eksport zayavki',
    `Nomer: ${request.number}`,
    `Status: ${request.status}`,
    `Prioritet: ${request.priority}`,
    `Klient: ${request.companyOrFullName}`,
    `Telefon: ${request.phone}`,
    `Email: ${request.email ?? '-'}`,
    `Adres: ${request.address ?? '-'}`,
    `Oborudovanie: ${request.equipmentCategory?.name ?? '-'} / ${request.equipmentName ?? '-'}`,
    `Neispravnost: ${request.malfunctionType?.name ?? request.malfunctionCustomText ?? '-'}`,
    `Opisanie: ${(request.problemDescription ?? '-').slice(0, 120)}`,
    `Deadline: ${request.deadline?.toISOString().slice(0, 10) ?? '-'}`,
    `Ispolniteli: ${request.assignments.map((a) => a.executor.fullName).join(', ') || '-'}`,
  ];

  if (request.closingForm?.confirmedAt) {
    lines.push(
      '--- Anketa zakrytiya ---',
      `Raboty: ${(request.closingForm.workPerformed ?? '-').slice(0, 80)}`,
      `Prikhod: ${decimalToNumber(request.closingForm.incomeAmount)}`,
      `Raskhod: ${decimalToNumber(request.closingForm.expenseAmount)}`,
      `Pribyl: ${decimalToNumber(request.closingForm.profit)}`,
    );
  }

  lines.push(`Sozdana: ${request.createdAt.toISOString()}`);

  return buildSimplePdf(lines);
}
