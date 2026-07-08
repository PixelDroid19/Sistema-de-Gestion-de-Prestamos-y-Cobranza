const PDFDocument = require('pdfkit');

const COLORS = Object.freeze({
  ink: '#1f2937',
  muted: '#6b7280',
  faint: '#9ca3af',
  line: '#e5e7eb',
  headerFill: '#0f766e',
  headerText: '#ffffff',
  zebra: '#f8fafc',
  brand: '#0f766e',
});

const PAGE = Object.freeze({
  left: 48,
  right: 564,
  width: 516,
  bottom: 760,
});

const drawBrandHeader = (doc, { title, subtitle, generatedAt }) => {
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.brand)
    .text('CrediCobranza', PAGE.left, 44);
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text('Sistema de préstamos y cobranza', PAGE.left, 58);
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(`Generado: ${generatedAt}`, PAGE.left, 44, { width: PAGE.width, align: 'right' });

  doc
    .moveTo(PAGE.left, 76)
    .lineTo(PAGE.right, 76)
    .lineWidth(1)
    .strokeColor(COLORS.line)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(17)
    .fillColor(COLORS.ink)
    .text(title, PAGE.left, 90, { width: PAGE.width });

  let y = doc.y + 4;
  if (subtitle) {
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text(subtitle, PAGE.left, y, { width: PAGE.width });
    y = doc.y + 4;
  }

  return y + 8;
};

const ensureSpace = (doc, y, needed) => {
  if (y + needed <= PAGE.bottom) {
    return y;
  }
  doc.addPage();
  return 54;
};

const drawSummary = (doc, y, summary) => {
  const items = summary.filter((item) => item && item.label);
  if (items.length === 0) {
    return y;
  }

  const columns = 2;
  const cellWidth = PAGE.width / columns;
  const rowHeight = 30;
  const rows = Math.ceil(items.length / columns);
  y = ensureSpace(doc, y, rows * rowHeight + 12);

  items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = PAGE.left + col * cellWidth;
    const cellY = y + row * rowHeight;

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(COLORS.faint)
      .text(String(item.label).toUpperCase(), x, cellY, { width: cellWidth - 12, lineBreak: false });
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLORS.ink)
      .text(String(item.value ?? ''), x, cellY + 10, { width: cellWidth - 12, lineBreak: false });
  });

  const endY = y + rows * rowHeight;
  doc
    .moveTo(PAGE.left, endY + 2)
    .lineTo(PAGE.right, endY + 2)
    .lineWidth(0.5)
    .strokeColor(COLORS.line)
    .stroke();

  return endY + 14;
};

const resolveColumnWidths = (columns) => {
  const declared = columns.reduce((sum, column) => sum + (column.width || 0), 0);
  const flexible = columns.filter((column) => !column.width).length;
  const remaining = Math.max(PAGE.width - declared, 0);
  const flexWidth = flexible > 0 ? remaining / flexible : 0;
  return columns.map((column) => column.width || flexWidth);
};

const measureRowHeight = (doc, columns, widths, row, fontSize) => {
  let height = 16;
  columns.forEach((column, index) => {
    const value = String(row[column.key] ?? '');
    const cellHeight = doc
      .font('Helvetica')
      .fontSize(fontSize)
      .heightOfString(value, { width: widths[index] - 10 });
    height = Math.max(height, cellHeight + 7);
  });
  return height;
};

const drawTable = (doc, y, { columns, rows }, options = {}) => {
  const fontSize = options.fontSize || 8.5;
  const widths = resolveColumnWidths(columns);

  const drawHeader = (headerY) => {
    doc
      .rect(PAGE.left, headerY, PAGE.width, 18)
      .fill(COLORS.headerFill);
    let x = PAGE.left;
    columns.forEach((column, index) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(fontSize)
        .fillColor(COLORS.headerText)
        .text(String(column.header), x + 5, headerY + 5, {
          width: widths[index] - 10,
          align: column.align || 'left',
          lineBreak: false,
        });
      x += widths[index];
    });
    return headerY + 18;
  };

  y = ensureSpace(doc, y, 40);
  y = drawHeader(y);

  rows.forEach((row, rowIndex) => {
    const rowHeight = measureRowHeight(doc, columns, widths, row, fontSize);
    if (y + rowHeight > PAGE.bottom) {
      doc.addPage();
      y = drawHeader(54);
    }

    if (rowIndex % 2 === 1) {
      doc.rect(PAGE.left, y, PAGE.width, rowHeight).fill(COLORS.zebra);
    }

    let x = PAGE.left;
    columns.forEach((column, index) => {
      doc
        .font(column.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fontSize)
        .fillColor(COLORS.ink)
        .text(String(row[column.key] ?? ''), x + 5, y + 4, {
          width: widths[index] - 10,
          align: column.align || 'left',
        });
      x += widths[index];
    });

    y += rowHeight;
    doc
      .moveTo(PAGE.left, y)
      .lineTo(PAGE.right, y)
      .lineWidth(0.4)
      .strokeColor(COLORS.line)
      .stroke();
  });

  if (rows.length === 0) {
    y = ensureSpace(doc, y, 20);
    doc
      .font('Helvetica')
      .fontSize(fontSize)
      .fillColor(COLORS.muted)
      .text('Sin registros para el rango seleccionado.', PAGE.left, y + 4);
    y += 22;
  }

  return y + 12;
};

const drawSection = (doc, y, section) => {
  if (section.heading) {
    y = ensureSpace(doc, y, 30);
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLORS.ink)
      .text(section.heading, PAGE.left, y);
    y = doc.y + 6;
  }

  if (Array.isArray(section.lines) && section.lines.length > 0) {
    section.lines.forEach((line) => {
      y = ensureSpace(doc, y, 14);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(line ? COLORS.ink : COLORS.muted)
        .text(String(line), PAGE.left, y, { width: PAGE.width });
      y = doc.y + 2;
    });
    y += 6;
  }

  if (section.table && Array.isArray(section.table.columns)) {
    y = drawTable(doc, y, section.table, section.tableOptions);
  }

  return y;
};

const drawPageNumbers = (doc) => {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.faint)
      .text(`Página ${index + 1} de ${range.count}`, PAGE.left, 778, {
        width: PAGE.width,
        align: 'right',
        lineBreak: false,
      });
  }
};

/**
 * Builds an operator-facing PDF report with a branded header, a key-value
 * summary block, and zebra-striped tables with automatic pagination.
 *
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   generatedAt?: string,
 *   summary?: Array<{label: string, value: string|number}>,
 *   sections?: Array<{heading?: string, lines?: string[], table?: {columns: Array<{header: string, key: string, width?: number, align?: string, bold?: boolean}>, rows: object[]}}>,
 * }} input
 * @returns {Promise<Buffer>}
 */
const buildReportPdf = ({ title, subtitle, generatedAt, summary = [], sections = [] }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 44, bottom: 30, left: PAGE.left, right: 612 - PAGE.right },
    bufferPages: true,
    compress: false,
    info: { Title: title, Author: 'CrediCobranza' },
  });

  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  const stamp = generatedAt || new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  let y = drawBrandHeader(doc, { title, subtitle, generatedAt: stamp });
  y = drawSummary(doc, y, summary);
  sections.forEach((section) => {
    y = drawSection(doc, y, section);
  });
  drawPageNumbers(doc);

  doc.end();
});

module.exports = {
  buildReportPdf,
};
