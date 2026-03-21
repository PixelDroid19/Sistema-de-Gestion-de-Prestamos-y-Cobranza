const roundCurrency = (value) => Number.parseFloat((Number(value) || 0).toFixed(2));

const normalizeTolerance = (value, fallback = 0.01) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const compareWithinTolerance = (left, right, tolerance = 0.01) => {
  const normalizedTolerance = normalizeTolerance(tolerance);
  return Math.abs(Number(left || 0) - Number(right || 0)) <= normalizedTolerance + Number.EPSILON;
};

module.exports = {
  roundCurrency,
  normalizeTolerance,
  compareWithinTolerance,
};
