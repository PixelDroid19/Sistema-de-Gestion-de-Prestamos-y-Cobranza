const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { buildWorkbookBuffer } = require('@/modules/reports/application/workbookBuilder');

test('stacked report sections retain widest columns and freeze only the first header', async () => {
  const buffer = await buildWorkbookBuffer([{ name: 'Crédito', sections: [
    { title: 'Detalle del crédito', columns: [{ key: 'label', width: 24 }, { key: 'value', width: 34 }], rows: [{ label: 'Capital pendiente', value: 482791.44 }] },
    { title: 'Calendario', columns: [{ key: 'number', width: 18 }, { key: 'amount', width: 20 }, { key: 'principal', width: 24 }], rows: [{ number: 1, amount: 136152.9, principal: 112013.33 }] },
    { title: 'Pagos', columns: [{ key: 'date', width: 18 }, { key: 'amount', width: 18 }, { key: 'type', width: 16 }], rows: [{ date: '28/02/2026', amount: 200000, type: 'Abono a capital' }] },
  ] }]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.getColumn(1).width, 24);
  assert.equal(sheet.getColumn(2).width, 34);
  assert.equal(sheet.getColumn(3).width, 24);
  assert.equal(sheet.views[0].ySplit, 2);
  assert.equal(sheet.getCell('C1').master.address, 'A1', 'Section titles use the shared sheet width.');
});
