const ExcelJS = require('exceljs');
const {
  DATE_TIME_FORMAT,
  isDateExcelFormat,
  isNumericExcelFormat,
  parseExcelNumber,
  formatExcelDisplayValue,
} = require('@/modules/reports/application/excelExportFormats');

const MAX_SHEET_NAME_LENGTH = 31;

const STYLE_COLORS = {
  blue: '4472C4',
  green: '70AD47',
  yellow: 'FFC000',
  red: 'E74C3C',
  purple: '9B59B6',
  teal: '16A085',
  headerBlue: '5B9BD5',
  lightBlue: 'D9E1F2',
  lightGray: 'E7E6E6',
  border: 'D9E2EC',
};

const normalizeSheetName = (name, index) => {
  const fallback = `Hoja ${index + 1}`;
  return (String(name || fallback).replace(/[\\/?*[\]:]/g, ' ').trim()
    .slice(0, MAX_SHEET_NAME_LENGTH).replace(/^'+|'+$/g, '') || fallback);
};

const collectColumnKeys = (rows = []) => {
  const keys = [];
  const seen = new Set();

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    });
  });

  return keys;
};

const stringifyForCell = (value) => {
  const seen = new WeakSet();

  return JSON.stringify(value, (_key, nestedValue) => {
    if (typeof nestedValue === 'bigint') {
      return nestedValue.toString();
    }

    if (nestedValue instanceof Date) {
      return nestedValue.toISOString();
    }

    if (nestedValue && typeof nestedValue === 'object') {
      if (seen.has(nestedValue)) {
        return '[Circular]';
      }
      seen.add(nestedValue);
    }

    return nestedValue;
  });
};

const normalizeCellValue = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (['string', 'number', 'boolean'].includes(typeof value)) {
    return value;
  }

  return stringifyForCell(value) || '';
};

const coerceDateValue = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'N/A') {
      return '';
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? value : date;
  }

  return value;
};

const normalizeCellValueForColumn = (value, column = {}, rowFormats = {}) => {
  const effectiveNumFmt = rowFormats?.numFmt || column.numFmt;
  let normalizedValue = normalizeCellValue(value);

  if (isDateExcelFormat(effectiveNumFmt)) {
    return coerceDateValue(normalizedValue);
  }

  if (!isNumericExcelFormat(effectiveNumFmt)) {
    return normalizedValue;
  }

  const isBlankPlaceholder = normalizedValue == null
    || (typeof normalizedValue === 'string'
      && (!normalizedValue.trim() || /^n\/?a$/i.test(normalizedValue.trim())));
  if (isBlankPlaceholder) {
    return '';
  }

  const parsedValue = parseExcelNumber(normalizedValue, {
    isPercentFormat: String(effectiveNumFmt || '').includes('%'),
  });

  return typeof parsedValue === 'number' ? parsedValue : normalizedValue;
};

const resolveCellNumFmt = ({ value, column = {}, rowFormat = {} }) => {
  const explicitNumFmt = rowFormat?.numFmt || column.numFmt;
  if (explicitNumFmt) {
    return explicitNumFmt;
  }

  return value instanceof Date ? DATE_TIME_FORMAT : null;
};

const normalizeWorkbookCellValue = ({ value, column = {}, rowFormat = {} }) => {
  const normalizedValue = normalizeCellValueForColumn(value, column, rowFormat);
  const numFmt = resolveCellNumFmt({ value: normalizedValue, column, rowFormat });
  // Keep amounts and rates numeric so Excel can sum, sort and filter them.
  if (typeof normalizedValue === 'number') return normalizedValue;
  const displayValue = formatExcelDisplayValue(value, numFmt);
  if (normalizedValue instanceof Date && isDateExcelFormat(numFmt)) {
    // Excel stores a wall-clock date without a timezone. Reuse the operational
    // display convention before writing that date as a sortable numeric serial.
    const parts = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{1,2}):(\d{2}) ([ap])\. m\.)?$/.exec(displayValue.value);
    if (parts) {
      const hour = parts[4] ? Number(parts[4]) % 12 + (parts[6] === 'p' ? 12 : 0) : 0;
      return new Date(Date.UTC(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]), hour, Number(parts[5] || 0)));
    }
  }

  return displayValue.shouldDisplay ? displayValue.value : normalizedValue;
};

const resolveColumns = ({ rows = [], columns = [] }) => {
  if (Array.isArray(columns) && columns.length > 0) {
    return columns.map((column) => ({
      header: column.header || column.key,
      key: column.key,
      width: column.width,
      numFmt: column.numFmt,
      alignment: column.alignment,
    }));
  }

  return collectColumnKeys(rows).map((key) => ({
    header: key,
    key,
    width: Math.max(12, Math.min(32, String(key).length + 4)),
  }));
};

const styleHeaderRow = (row, fillColor = STYLE_COLORS.headerBlue) => {
  row.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'D9E2EC' } },
      left: { style: 'thin', color: { argb: 'D9E2EC' } },
      bottom: { style: 'thin', color: { argb: 'D9E2EC' } },
      right: { style: 'thin', color: { argb: 'D9E2EC' } },
    };
  });
};

const applyCellBorder = (cell) => {
  cell.border = {
    top: { style: 'thin', color: { argb: STYLE_COLORS.border } },
    left: { style: 'thin', color: { argb: STYLE_COLORS.border } },
    bottom: { style: 'thin', color: { argb: STYLE_COLORS.border } },
    right: { style: 'thin', color: { argb: STYLE_COLORS.border } },
  };
};

const applyCellNumFmt = (cell, numFmt) => {
  if (!numFmt) {
    return;
  }

  cell.numFmt = numFmt;
  cell.style = { ...(cell.style || {}), numFmt };
};

const applyCellPresentation = ({ cell, column = {}, row = {}, key }) => {
  const rowFormat = row.__formats?.[key];
  const numFmt = rowFormat?.numFmt || column.numFmt;

  if (numFmt) {
    applyCellNumFmt(cell, numFmt);
  } else if (cell.value instanceof Date) {
    applyCellNumFmt(cell, DATE_TIME_FORMAT);
  }

  if (rowFormat?.alignment || column.alignment) {
    cell.alignment = {
      ...(cell.alignment || {}),
      ...(column.alignment || {}),
      ...(rowFormat?.alignment || {}),
    };
  }

  if (rowFormat?.font) {
    cell.font = { ...(cell.font || {}), ...rowFormat.font };
  }

  applyCellBorder(cell);
};

const addWorksheetTitle = ({
  worksheet,
  title,
  startRow = 1,
  columnCount = 2,
  fillColor = STYLE_COLORS.blue,
  fontSize = 16,
}) => {
  if (!title) {
    return startRow;
  }

  worksheet.mergeCells(startRow, 1, startRow, Math.max(columnCount, 1));
  const titleCell = worksheet.getRow(startRow).getCell(1);
  titleCell.value = title;
  titleCell.font = { size: fontSize, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: fillColor },
  };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  worksheet.getRow(startRow).height = fontSize >= 16 ? 30 : 25;
  return startRow + 1;
};

const addRowsTable = ({
  worksheet,
  rows = [],
  columns = [],
  startRow = 1,
  headerFill = STYLE_COLORS.headerBlue,
  autoFilter = false,
}) => {
  const resolvedColumns = resolveColumns({ rows, columns });
  const keys = resolvedColumns.map((column) => column.key).filter(Boolean);

  if (keys.length === 0) {
    worksheet.getRow(startRow).getCell(1).value = 'Sin datos';
    return startRow + 1;
  }

  resolvedColumns.forEach((column, index) => {
    const worksheetColumn = worksheet.getColumn(index + 1);
    const requiredWidth = column.width || Math.max(12, Math.min(32, String(column.header || column.key).length + 4));
    // Column widths belong to the sheet, not an individual stacked table.
    worksheetColumn.width = Math.max(worksheetColumn.width || 0, requiredWidth);
  });

  const headerRow = worksheet.getRow(startRow);
  resolvedColumns.forEach((column, index) => {
    headerRow.getCell(index + 1).value = column.header || column.key;
  });
  styleHeaderRow(headerRow, headerFill);
  headerRow.height = Math.max(24, ...resolvedColumns.map((column, index) =>
    14 * Math.ceil(String(column.header || column.key).length / Math.max(8, worksheet.getColumn(index + 1).width - 2)) + 10));

  let currentRow = startRow + 1;
  rows.forEach((row) => {
    const worksheetRow = worksheet.getRow(currentRow);
    keys.forEach((key, index) => {
      const column = resolvedColumns[index];
      const rowFormat = row.__formats?.[key];
      const cell = worksheetRow.getCell(index + 1);
      cell.value = normalizeWorkbookCellValue({ value: row[key], column, rowFormat });
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: typeof cell.value === 'number' ? 'right' : 'left', wrapText: true };
      applyCellPresentation({ cell, column, row, key });
    });
    worksheetRow.height = Math.max(22, ...keys.map((key, index) => {
      const value = row[key];
      const length = value instanceof Date || typeof value === 'number' ? 16 : String(value ?? '').length;
      return 13 * Math.ceil(length / Math.max(8, worksheet.getColumn(index + 1).width - 2)) + 8;
    }));
    currentRow += 1;
  });

  if (autoFilter && keys.length > 0) {
    worksheet.autoFilter = {
      from: { row: startRow, column: 1 },
      to: { row: startRow, column: keys.length },
    };
  }

  if (!worksheet.views?.some((view) => view.state === 'frozen')) {
    worksheet.views = [{ state: 'frozen', ySplit: startRow, showGridLines: false }];
    worksheet.pageSetup.printTitlesRow = `${startRow}:${startRow}`;
  }
  return currentRow;
};

/**
 * Build an XLSX workbook from plain report rows without parsing user-provided spreadsheets.
 *
 * This helper intentionally uses ExcelJS only for server-side workbook generation. The
 * product does not need spreadsheet parsing here, so using a writer-only path keeps
 * report exports away from parser advisories in spreadsheet packages.
 *
 * @param {Array<{ name: string, title?: string, tabColor?: string, rows?: Array<Record<string, unknown>>, columns?: Array<object>, sections?: Array<object> }>} sheets
 * @returns {Promise<Buffer>}
 */
const buildWorkbookBuffer = async (sheets = []) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CrediCobranza';
  workbook.created = new Date();

  sheets.forEach((sheetDefinition, index) => {
    const {
      name,
      title,
      rows = [],
      columns = [],
      sections = [],
      tabColor,
      headerFill,
      autoFilter = true,
    } = sheetDefinition;
    const baseName = normalizeSheetName(name, index);
    let uniqueName = baseName;
    let suffixNumber = 2;
    while (workbook.worksheets.some((sheet) => sheet.name.toLowerCase() === uniqueName.toLowerCase())) {
      const suffix = ` (${suffixNumber++})`;
      uniqueName = `${baseName.slice(0, MAX_SHEET_NAME_LENGTH - suffix.length)}${suffix}`;
    }
    const worksheet = workbook.addWorksheet(uniqueName, {
      properties: tabColor ? { tabColor: { argb: tabColor } } : undefined,
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const columnCount = Math.max(
      columns.length,
      ...sections.map((section) => (section.columns || []).length),
      1,
    );
    let currentRow = addWorksheetTitle({
      worksheet,
      title,
      startRow: 1,
      columnCount,
      fillColor: tabColor || STYLE_COLORS.blue,
    });

    if (Array.isArray(sections) && sections.length > 0) {
      sections.forEach((section) => {
        if (section.title) {
          currentRow = addWorksheetTitle({
            worksheet,
            title: section.title,
            startRow: currentRow,
            columnCount,
            fillColor: section.titleFill || section.tabColor || headerFill || STYLE_COLORS.blue,
            fontSize: 12,
          });
        }
        currentRow = addRowsTable({
          worksheet,
          rows: section.rows || [],
          columns: section.columns || [],
          startRow: currentRow,
          headerFill: section.headerFill || headerFill || STYLE_COLORS.headerBlue,
          autoFilter: section.autoFilter ?? false,
        }) + 1;
      });
      return;
    }

    addRowsTable({
      worksheet,
      rows,
      columns,
      startRow: currentRow,
      headerFill: headerFill || STYLE_COLORS.headerBlue,
      autoFilter,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

module.exports = {
  buildWorkbookBuffer,
  STYLE_COLORS,
};
