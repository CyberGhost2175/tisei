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

export type MaintenanceActLine = {
  name: string;
  city: string;
  quantity: number;
  unitPrice: number;
};

export type MaintenanceActData = {
  actNumber: number;
  actDate: Date;
  periodFrom: Date;
  periodTo: Date;
  periodLabel: string;
  /** Имя месяца в родительном/именительном для Golpas: «июль» */
  periodMonthName?: string;
  customerName: string;
  customerBin: string;
  customerAddress: string;
  executorName: string;
  executorBin: string;
  executorAddress: string;
  contractNumber: string;
  contractDate: Date | null;
  /** true — unitPrice уже с НДС; false — без НДС (Golpas) */
  priceIncludesVat: boolean;
  /**
   * golpas — одна строка, кол.8 = «без НДС», кол.9 = сумма без НДС
   * caspian — по точкам (Costa/Hardee's/KFC), кол.8 = «c НДС», кол.9 = сумма с НДС
   */
  variant?: 'standard' | 'golpas' | 'caspian';
  /** Если true — line.name пишется как есть (ремонт). Иначе для caspian добавляется префикс ТО. */
  rawLineNames?: boolean;
  lines: MaintenanceActLine[];
};

function fmtDateShort(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}г`;
}

function fmtDateFull(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}

function fmtMoney(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Col = { x: number; w: number };

function drawCell(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    font?: string;
    size?: number;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle';
    pad?: number;
  } = {},
) {
  const font = opts.font ?? 'Regular';
  const size = opts.size ?? 6;
  const pad = opts.pad ?? 2;
  const align = opts.align ?? 'left';
  doc.font(font).fontSize(size);
  const textH = doc.heightOfString(text, { width: w - pad * 2, align });
  let ty = y + pad;
  if (opts.valign === 'middle') {
    ty = y + Math.max(pad, (h - textH) / 2);
  }
  doc.text(text, x + pad, ty, {
    width: w - pad * 2,
    height: h - pad * 2,
    align,
    lineBreak: true,
  });
}

function strokeRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) {
  doc.lineWidth(0.4).strokeColor('#000').rect(x, y, w, h).stroke();
}

function partyLine(name: string, address: string): string {
  return [name, address].filter(Boolean).join(', ');
}

/**
 * Акт выполненных работ — Форма Р-1
 * (Приложение 50 к приказу Министра финансов РК от 20.12.2012 № 562)
 */
export async function buildMaintenanceActPdf(data: MaintenanceActData): Promise<Buffer> {
  const font = resolveFont('DejaVuSans.ttf');
  let fontBold = font;
  try {
    fontBold = resolveFont('DejaVuSans-Bold.ttf');
  } catch {
    /* optional */
  }

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 28, bottom: 28, left: 28, right: 28 },
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
  const right = doc.page.width - doc.page.margins.right;
  const pageW = right - left;
  let y = doc.page.margins.top;
  const isGolpas = data.variant === 'golpas';
  const isCaspian = data.variant === 'caspian' || (!isGolpas && data.priceIncludesVat);

  // ─── Шапка: приложение слева, форма справа ───
  doc.font('Regular').fontSize(6).fillColor('#000');
  doc.text(
    'Приложение 50\nк приказу Министра финансов\nРеспублики Казахстан\nот 20 декабря 2012 года № 562',
    left,
    y,
    { width: 160, lineGap: 1 },
  );
  doc.font('Bold').fontSize(10).text('Форма Р-1', right - 80, y, { width: 80, align: 'right' });
  y += 38;

  // ИИН/БИН над правой колонкой (как в образце Golpas)
  const binW = 95;
  const labelW = 70;
  const partyInnerW = pageW - labelW - binW;
  doc.font('Regular').fontSize(6).text('ИИН/БИН', right - binW, y, { width: binW, align: 'center' });
  y += 10;

  const partyH = 40;

  // Заказчик
  strokeRect(doc, left, y, labelW, partyH);
  drawCell(doc, 'Заказчик', left, y, labelW, partyH, {
    font: 'Bold',
    size: 7,
    align: 'center',
    valign: 'middle',
  });
  strokeRect(doc, left + labelW, y, partyInnerW, partyH);
  drawCell(doc, partyLine(data.customerName, data.customerAddress), left + labelW, y, partyInnerW, partyH - 10, {
    size: 6.5,
    valign: 'top',
  });
  doc
    .font('Regular')
    .fontSize(5)
    .fillColor('#444')
    .text('полное наименование, адрес, данные о средствах связи', left + labelW + 2, y + partyH - 9, {
      width: partyInnerW - 4,
    });
  doc.fillColor('#000');
  strokeRect(doc, left + labelW + partyInnerW, y, binW, partyH);
  drawCell(doc, data.customerBin || '—', left + labelW + partyInnerW, y, binW, partyH, {
    size: 7,
    align: 'center',
    valign: 'middle',
  });
  y += partyH;

  // Исполнитель
  strokeRect(doc, left, y, labelW, partyH);
  drawCell(doc, 'Исполнитель', left, y, labelW, partyH, {
    font: 'Bold',
    size: 7,
    align: 'center',
    valign: 'middle',
  });
  strokeRect(doc, left + labelW, y, partyInnerW, partyH);
  drawCell(doc, partyLine(data.executorName, data.executorAddress), left + labelW, y, partyInnerW, partyH - 10, {
    size: 6.5,
    valign: 'top',
  });
  doc
    .font('Regular')
    .fontSize(5)
    .fillColor('#444')
    .text('полное наименование, адрес, данные о средствах связи', left + labelW + 2, y + partyH - 9, {
      width: partyInnerW - 4,
    });
  doc.fillColor('#000');
  strokeRect(doc, left + labelW + partyInnerW, y, binW, partyH);
  drawCell(doc, data.executorBin || '—', left + labelW + partyInnerW, y, binW, partyH, {
    size: 7,
    align: 'center',
    valign: 'middle',
  });
  y += partyH + 4;

  // ─── Договор + номер + дата + период ───
  const metaH = 28;
  const contractW = pageW * 0.42;
  const numW = pageW * 0.14;
  const dateW = pageW * 0.14;
  const periodW = pageW - contractW - numW - dateW;

  const contractDateStr = data.contractDate ? `${fmtDateFull(data.contractDate)}г.` : '—';
  strokeRect(doc, left, y, contractW, metaH);
  drawCell(
    doc,
    `Договор (контракт) № ${data.contractNumber || '—'} от ${contractDateStr}`,
    left,
    y,
    contractW,
    metaH,
    { size: 7, valign: 'middle' },
  );

  strokeRect(doc, left + contractW, y, numW, metaH);
  drawCell(doc, 'Номер\nдокумента', left + contractW, y, numW, 14, {
    size: 5,
    align: 'center',
  });
  drawCell(
    doc,
    String(data.actNumber).padStart(11, '0'),
    left + contractW,
    y + 12,
    numW,
    14,
    { font: 'Bold', size: 8, align: 'center' },
  );

  strokeRect(doc, left + contractW + numW, y, dateW, metaH);
  drawCell(doc, 'Дата\nсоставления', left + contractW + numW, y, dateW, 14, {
    size: 5,
    align: 'center',
  });
  drawCell(doc, fmtDateShort(data.actDate), left + contractW + numW, y + 12, dateW, 14, {
    font: 'Bold',
    size: 8,
    align: 'center',
  });

  strokeRect(doc, left + contractW + numW + dateW, y, periodW, metaH);
  drawCell(doc, 'Отчетный период', left + contractW + numW + dateW, y, periodW, 10, {
    size: 5,
    align: 'center',
  });
  drawCell(
    doc,
    `с ${fmtDateFull(data.periodFrom)}   по ${fmtDateFull(data.periodTo)}`,
    left + contractW + numW + dateW,
    y + 11,
    periodW,
    14,
    { size: 6.5, align: 'center' },
  );
  y += metaH + 6;

  // ─── Заголовок акта ───
  doc.font('Bold').fontSize(11).text('АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)', left, y, {
    width: pageW,
    align: 'center',
  });
  y += 16;

  // ─── Таблица ───
  const cols: Col[] = [];
  const widths = [22, 210, 70, 36, 36, 58, 58, 58, 58];
  const sumW = widths.reduce((a, b) => a + b, 0);
  const scale = pageW / sumW;
  let cx = left;
  for (const w of widths) {
    const ww = w * scale;
    cols.push({ x: cx, w: ww });
    cx += ww;
  }

  const col9Header = isGolpas ? 'сумма без НДС,\nв KZT' : 'сумма с НДС,\nв KZT';
  const headerH = 46;
  const headers = [
    'Номер\nпо\nпорядку',
    'Наименование работ (услуг)',
    'Сведения о наличии отчета о маркетинговых исследованиях, консультационных и прочих услуг (дата, номер, количество страниц)',
    'Единица\nизмерения',
    'Выполнено работ (оказано услуг)\nколичество',
    'цена за\nединицу',
    'стоимость',
    'сумма НДС,\nв KZT',
    col9Header,
  ];

  const drawTableHeader = () => {
    for (let i = 0; i < cols.length; i++) {
      strokeRect(doc, cols[i]!.x, y, cols[i]!.w, headerH);
      drawCell(doc, headers[i]!, cols[i]!.x, y, cols[i]!.w, headerH - 10, {
        size: i === 2 ? 4.5 : 5.5,
        align: 'center',
        valign: 'top',
        pad: 1.5,
      });
      drawCell(doc, String(i + 1), cols[i]!.x, y + headerH - 11, cols[i]!.w, 10, {
        font: 'Bold',
        size: 6,
        align: 'center',
      });
    }
    y += headerH;
  };

  drawTableHeader();

  const rowMinH = 28;
  let totalCost = 0;
  let totalVat = 0;
  let totalCol9 = 0;
  const VAT_RATE = 0.12;

  const ensureSpace = (need: number) => {
    if (y + need > doc.page.height - doc.page.margins.bottom - 90) {
      doc.addPage();
      y = doc.page.margins.top;
      drawTableHeader();
    }
  };

  for (let idx = 0; idx < data.lines.length; idx++) {
    const line = data.lines[idx]!;
    const qty = line.quantity;
    let price: number;
    let cost: number;
    let vatCell: string;
    let col9: number;
    let vatNum = 0;

    if (isGolpas) {
      // Образец Golpas: цена/стоимость/сумма без НДС; в кол.8 текст «без НДС»
      price = line.unitPrice;
      cost = qty * line.unitPrice;
      vatCell = 'без НДС';
      col9 = cost;
    } else if (isCaspian || data.priceIncludesVat) {
      // Образец Caspian (Hardee's/Costa/KFC): цена уже с НДС; в кол.8 «c НДС»
      price = line.unitPrice;
      const sumWithVat = qty * line.unitPrice;
      cost = sumWithVat;
      vatNum = 0;
      vatCell = 'c НДС';
      col9 = sumWithVat;
    } else {
      price = line.unitPrice;
      cost = qty * line.unitPrice;
      vatNum = cost * VAT_RATE;
      vatCell = fmtMoney(vatNum);
      col9 = cost + vatNum;
    }

    // Как в XLS-образцах: одна фраза с названием точки
    const nameText =
      data.rawLineNames || isGolpas
        ? line.name
        : `Ежемесячное плановое техническое обслуживание  ${line.name}`;

    doc.font('Regular').fontSize(6.5);
    const nameH = doc.heightOfString(nameText, { width: cols[1]!.w - 4 });
    const rowH = Math.max(rowMinH, nameH + 6);

    ensureSpace(rowH);

    const values = [
      String(idx + 1),
      nameText,
      '',
      'усл.',
      String(qty),
      fmtMoney(price),
      fmtMoney(cost),
      vatCell,
      fmtMoney(col9),
    ];
    const aligns: Array<'left' | 'center' | 'right'> = [
      'center',
      'left',
      'center',
      'center',
      'center',
      'right',
      'right',
      'center',
      'right',
    ];

    for (let i = 0; i < cols.length; i++) {
      strokeRect(doc, cols[i]!.x, y, cols[i]!.w, rowH);
      drawCell(doc, values[i]!, cols[i]!.x, y, cols[i]!.w, rowH, {
        size: 6.5,
        align: aligns[i],
        valign: 'middle',
        pad: 2,
      });
    }

    totalCost += cost;
    totalVat += vatNum;
    totalCol9 += col9;
    y += rowH;
  }

  // Итого
  ensureSpace(22);
  const totalH = 20;
  strokeRect(doc, left, y, cols[0]!.w + cols[1]!.w + cols[2]!.w + cols[3]!.w + cols[4]!.w, totalH);
  drawCell(
    doc,
    'Итого',
    left,
    y,
    cols[0]!.w + cols[1]!.w + cols[2]!.w + cols[3]!.w + cols[4]!.w,
    totalH,
    { font: 'Bold', size: 7, align: 'right', valign: 'middle', pad: 4 },
  );
  strokeRect(doc, cols[5]!.x, y, cols[5]!.w, totalH);
  strokeRect(doc, cols[6]!.x, y, cols[6]!.w, totalH);
  drawCell(doc, fmtMoney(totalCost), cols[6]!.x, y, cols[6]!.w, totalH, {
    font: 'Bold',
    size: 7,
    align: 'right',
    valign: 'middle',
  });
  strokeRect(doc, cols[7]!.x, y, cols[7]!.w, totalH);
  // Caspian: в строках «c НДС», в итоге колонку НДС не заполняем — как в образце
  if (!isGolpas && !isCaspian) {
    drawCell(doc, fmtMoney(totalVat), cols[7]!.x, y, cols[7]!.w, totalH, {
      font: 'Bold',
      size: 7,
      align: 'right',
      valign: 'middle',
    });
  }
  strokeRect(doc, cols[8]!.x, y, cols[8]!.w, totalH);
  drawCell(doc, fmtMoney(totalCol9), cols[8]!.x, y, cols[8]!.w, totalH, {
    font: 'Bold',
    size: 7,
    align: 'right',
    valign: 'middle',
  });
  y += totalH + 8;

  // Запасы
  ensureSpace(70);
  const stockH = 24;
  strokeRect(doc, left, y, pageW, stockH);
  drawCell(
    doc,
    'Сведения об использовании запасов, полученных от заказчика',
    left,
    y,
    pageW,
    12,
    { size: 6, align: 'center' },
  );
  drawCell(doc, 'наименование, количество, стоимость', left, y + 11, pageW, 10, {
    size: 5,
    align: 'center',
  });
  y += stockH;

  strokeRect(doc, left, y, pageW * 0.5, 18);
  strokeRect(doc, left + pageW * 0.5, y, pageW * 0.25, 18);
  strokeRect(doc, left + pageW * 0.75, y, pageW * 0.25, 18);
  y += 22;

  // Подписи
  ensureSpace(80);
  const signH = 36;
  const half = pageW / 2;

  strokeRect(doc, left, y, half, signH);
  drawCell(doc, 'Сдал (Исполнитель)', left, y, half, 12, { font: 'Bold', size: 7, align: 'center' });
  drawCell(doc, '____________________ / ____________________ /', left, y + 14, half, 12, {
    size: 7,
    align: 'center',
  });
  drawCell(doc, 'должность          подпись          расшифровка подписи', left, y + 26, half, 8, {
    size: 5,
    align: 'center',
  });

  strokeRect(doc, left + half, y, half, signH);
  drawCell(doc, 'Принял (Заказчик)', left + half, y, half, 12, {
    font: 'Bold',
    size: 7,
    align: 'center',
  });
  drawCell(
    doc,
    '____________________ / ____________________ /',
    left + half,
    y + 14,
    half,
    12,
    { size: 7, align: 'center' },
  );
  drawCell(
    doc,
    'должность          подпись          расшифровка подписи',
    left + half,
    y + 26,
    half,
    8,
    { size: 5, align: 'center' },
  );
  y += signH;

  strokeRect(doc, left, y, half, 18);
  drawCell(doc, 'М.П.', left, y, half, 18, { size: 7, align: 'center', valign: 'middle' });
  strokeRect(doc, left + half, y, half, 18);
  drawCell(doc, 'М.П.', left + half, y, half, 18, {
    size: 7,
    align: 'center',
    valign: 'middle',
  });
  y += 22;

  strokeRect(doc, left, y, pageW, 16);
  drawCell(doc, 'Приложение: Перечень документации', left, y, pageW, 16, {
    size: 6,
    valign: 'middle',
    pad: 4,
  });

  doc.end();
  return done;
}
