const { DataTypes } = require('sequelize');

/**
 * Money and rate columns are stored as exact DECIMAL/NUMERIC so SQL aggregations
 * (SUM/AVG in reports) never drift the way binary FLOAT does. The Postgres driver
 * returns NUMERIC as a string to preserve precision; these getters coerce reads
 * back to a JS number so the existing numeric API contract and arithmetic across
 * the codebase (and the frontend) keep working unchanged. Values stay well within
 * Number's 2-decimal safe range, so the read coercion is lossless.
 */
const numericGetter = (field) => function getNumericValue() {
  const raw = this.getDataValue(field);
  return raw === null || raw === undefined ? raw : Number(raw);
};

/**
 * Currency column: DECIMAL(15,2) — up to 9,999,999,999,999.99.
 * @param {string} field - attribute name (needed by the read getter)
 * @param {object} [overrides] - extra Sequelize attribute options (allowNull, defaultValue, validate, ...)
 */
const moneyColumn = (field, overrides = {}) => ({
  type: DataTypes.DECIMAL(15, 2),
  get: numericGetter(field),
  ...overrides,
});

/**
 * Percentage/rate column: DECIMAL(7,4) — up to 999.9999 (covers the 0-100 range with 4 decimals).
 * @param {string} field - attribute name (needed by the read getter)
 * @param {object} [overrides] - extra Sequelize attribute options
 */
const rateColumn = (field, overrides = {}) => ({
  type: DataTypes.DECIMAL(7, 4),
  get: numericGetter(field),
  ...overrides,
});

module.exports = { moneyColumn, rateColumn, numericGetter };
