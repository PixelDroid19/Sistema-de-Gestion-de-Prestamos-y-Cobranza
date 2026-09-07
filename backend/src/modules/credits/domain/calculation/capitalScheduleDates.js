const { normalizeDateOnly } = require('@/modules/shared/dateUtils');
const { addMonths } = require('./amortizationMethods');

/** Preserve contracted dates; only new installments need date projection. */
const resolveCapitalScheduleDates = ({ schedule, pendingRows, termMonths }) => {
  const activeDates = schedule.filter((row) => row.status !== 'annulled')
    .map((row) => normalizeDateOnly(row.dueDate, 'dueDate'));
  // February may hide the agreed 29th/30th/31st. Recover it from the existing
  // calendar, not current policies or origination, which could rewrite old terms.
  const anchor = activeDates.reduce((selected, date) => (
    date.getUTCDate() > selected.getUTCDate() ? date : selected
  ));
  const lastPending = normalizeDateOnly(pendingRows.at(-1).dueDate, 'dueDate');
  const anchorToLastMonth = (lastPending.getUTCFullYear() - anchor.getUTCFullYear()) * 12
    + lastPending.getUTCMonth() - anchor.getUTCMonth();
  return Array.from({ length: termMonths }, (_, index) => (
    index < pendingRows.length
      ? normalizeDateOnly(pendingRows[index].dueDate, 'dueDate').toISOString()
      : addMonths(anchor, anchorToLastMonth + index - pendingRows.length + 1).toISOString()
  ));

};

module.exports = { resolveCapitalScheduleDates };
