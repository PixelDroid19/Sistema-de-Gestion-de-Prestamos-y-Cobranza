const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveCapitalScheduleDates } = require('@/modules/credits/domain/calculation/capitalScheduleDates');

for (const { name, dates, termMonths, expected } of [
  { name: 'conserva calendario histórico del día 28', dates: ['2026-02-28', '2026-03-28', '2026-04-28'], termMonths: 3, expected: ['2026-03-28', '2026-04-28', '2026-05-28'] },
  { name: 'conserva fechas pactadas al reducir plazo', dates: ['2026-02-28', '2026-03-31', '2026-04-30'], termMonths: 1, expected: ['2026-03-31'] },
  { name: 'extiende desde febrero sin perder el día 31', dates: ['2026-01-31', '2026-02-28'], termMonths: 3, expected: ['2026-02-28', '2026-03-31', '2026-04-30'] },
  { name: 'conserva una fecha excepcional ya pactada', dates: ['2026-02-28', '2026-03-31', '2026-04-29'], termMonths: 2, expected: ['2026-03-31', '2026-04-29'] },
]) {
  test(`fechas de abono: ${name}`, () => {
    const schedule = dates.map((dueDate, index) => ({ dueDate, status: index ? 'pending' : 'paid' }));
    const actual = resolveCapitalScheduleDates({ schedule, pendingRows: schedule.slice(1), termMonths });
    assert.deepEqual(actual.map((date) => date.slice(0, 10)), expected);
  });
}
