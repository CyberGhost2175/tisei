import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveFont(name: string): string {
  const candidates = [
    path.resolve(__dirname, '../../../assets/fonts', name),
    path.resolve(process.cwd(), 'assets/fonts', name),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Font not found: ${name}`);
}

export type RepairActPartRow = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type RepairActPdfData = {
  number: string;
  closedAt: string | null;
  companyOrFullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  partnerName: string | null;
  equipmentCategoryName: string | null;
  equipmentName: string | null;
  problemDescription: string | null;
  executorName: string | null;
  workPerformed: string | null;
  comments: Array<{ authorName: string | null; text: string; createdAt: string }>;
  parts: RepairActPartRow[];
  attachmentNames: string[];
  incomeAmount: number | null;
};

function fmtMoney(n: number): string {
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₸`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function buildRepairActPdf(data: RepairActPdfData): Promise<Buffer> {
  const font = resolveFont('DejaVuSans.ttf');
  let fontBold = font;
  try {
    fontBold = resolveFont('DejaVuSans-Bold.ttf');
  } catch {
    /* optional */
  }

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.registerFont('Regular', font);
  doc.registerFont('Bold', fontBold);

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.font('Bold').fontSize(16).text('Акт выполненных работ', { align: 'left' });
  doc.moveDown(0.3);
  doc.font('Regular').fontSize(11).fillColor('#333');
  doc.text(`Заявка ${data.number}`);
  doc.text(`Закрыта: ${fmtDate(data.closedAt)}`);
  doc.moveDown();

  const infoRows: Array<[string, string]> = [
    ['Клиент', data.companyOrFullName || '—'],
    ['Телефон', data.phone || '—'],
    ['Email', data.email || '—'],
    ['Адрес', data.address || '—'],
  ];
  if (data.partnerName) infoRows.push(['Партнёр', data.partnerName]);
  infoRows.push([
    'Оборудование',
    [data.equipmentCategoryName, data.equipmentName].filter(Boolean).join(' · ') || '—',
  ]);
  infoRows.push(['Исполнитель', data.executorName || '—']);

  for (const [label, value] of infoRows) {
    doc.font('Bold').fontSize(10).fillColor('#000').text(`${label}: `, { continued: true });
    doc.font('Regular').text(value);
  }

  doc.moveDown();
  section(doc, 'Описание проблемы', data.problemDescription?.trim() || '—', width);
  section(doc, 'Что выполнено', data.workPerformed?.trim() || '—', width);

  if (data.comments.length > 0) {
    doc.font('Bold').fontSize(12).fillColor('#000').text('Комментарии');
    doc.moveDown(0.3);
    for (const c of data.comments) {
      doc
        .font('Regular')
        .fontSize(9)
        .fillColor('#666')
        .text(`${c.authorName ?? 'Система'} · ${fmtDate(c.createdAt)}`);
      doc.font('Regular').fontSize(10).fillColor('#000').text(c.text || '—', { width });
      doc.moveDown(0.4);
    }
  }

  doc.font('Bold').fontSize(12).fillColor('#000').text('Запчасти');
  doc.moveDown(0.3);
  if (data.parts.length === 0) {
    doc.font('Regular').fontSize(10).text('Запчасти не списывались', { width });
    doc.moveDown();
  } else {
    drawPartsTable(doc, data.parts, left, width);
    doc.moveDown();
  }

  if (data.attachmentNames.length > 0) {
    doc.font('Bold').fontSize(12).fillColor('#000').text('Вложения');
    doc.moveDown(0.3);
    doc
      .font('Regular')
      .fontSize(10)
      .text(data.attachmentNames.map((n) => `• ${n}`).join('\n'), { width });
    doc.moveDown();
  }

  const income = data.incomeAmount ?? 0;
  doc.moveDown(0.5);
  doc.font('Bold').fontSize(14).fillColor('#000');
  doc.text(`ИТОГ: ${data.incomeAmount != null ? fmtMoney(income) : '—'}`, {
    align: 'right',
  });
  doc.moveDown(1.5);
  doc
    .font('Regular')
    .fontSize(9)
    .fillColor('#666')
    .text('Документ сформирован автоматически · Береке ТехСервис CRM', { align: 'center' });

  doc.end();
  return done;
}

function section(doc: PDFKit.PDFDocument, title: string, body: string, width: number) {
  doc.font('Bold').fontSize(12).fillColor('#000').text(title);
  doc.moveDown(0.25);
  doc.font('Regular').fontSize(10).text(body, { width });
  doc.moveDown();
}

function drawPartsTable(
  doc: PDFKit.PDFDocument,
  parts: RepairActPartRow[],
  left: number,
  width: number,
) {
  const cols = {
    name: width * 0.46,
    qty: width * 0.12,
    price: width * 0.2,
    total: width * 0.22,
  };
  const rowH = 18;
  let y = doc.y;

  const drawHeader = () => {
    doc.font('Bold').fontSize(9).fillColor('#000');
    doc.rect(left, y, width, rowH).stroke('#999');
    doc.text('Наименование', left + 4, y + 5, { width: cols.name - 8 });
    doc.text('Кол-во', left + cols.name + 4, y + 5, { width: cols.qty - 8, align: 'right' });
    doc.text('Цена', left + cols.name + cols.qty + 4, y + 5, {
      width: cols.price - 8,
      align: 'right',
    });
    doc.text('Сумма', left + cols.name + cols.qty + cols.price + 4, y + 5, {
      width: cols.total - 8,
      align: 'right',
    });
    y += rowH;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }
  };

  drawHeader();

  doc.font('Regular').fontSize(9);
  for (const p of parts) {
    ensureSpace(rowH);
    doc.rect(left, y, width, rowH).stroke('#ccc');
    doc.fillColor('#000');
    doc.text(p.name, left + 4, y + 5, { width: cols.name - 8, ellipsis: true });
    doc.text(String(p.quantity), left + cols.name + 4, y + 5, {
      width: cols.qty - 8,
      align: 'right',
    });
    doc.text(fmtMoney(p.unitPrice), left + cols.name + cols.qty + 4, y + 5, {
      width: cols.price - 8,
      align: 'right',
    });
    doc.text(fmtMoney(p.lineTotal), left + cols.name + cols.qty + cols.price + 4, y + 5, {
      width: cols.total - 8,
      align: 'right',
    });
    y += rowH;
  }

  doc.y = y + 4;
}
