/**
 * Re-exports from the centralized money module.
 * All currency precision logic lives in @/modules/shared/money.
 * @see @/modules/shared/money
 */
const { roundCurrency, normalizeTolerance, compareWithinTolerance } = require('@/modules/shared/money');

module.exports = {
  roundCurrency,
  normalizeTolerance,
  compareWithinTolerance,
};
