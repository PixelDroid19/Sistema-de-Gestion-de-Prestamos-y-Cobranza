/**
 * Statistical calculation helpers for financial analytics.
 * These functions are co-located with the use cases that use them.
 */

/**
 * Calculate trend direction based on values.
 * @param {number[]} values - Array of numeric values
 * @returns {'up' | 'down' | 'stable'}
 */
const calculateTrend = (values) => {
  if (!Array.isArray(values) || values.length < 2) {
    return 'stable';
  }

  const validValues = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (validValues.length < 2) {
    return 'stable';
  }

  // Simple linear regression slope
  const n = validValues.length;
  const indices = validValues.map((_, i) => i);

  const sumX = indices.reduce((sum, x) => sum + x, 0);
  const sumY = validValues.reduce((sum, y) => sum + y, 0);
  const sumXY = indices.reduce((sum, x, i) => sum + x * validValues[i], 0);
  const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  if (Math.abs(slope) < 0.0001) {
    return 'stable';
  }

  return slope > 0 ? 'up' : 'down';
};

/**
 * Calculate simple moving average for a window.
 * @param {number[]} values - Array of numeric values
 * @param {number} window - Window size (default 3)
 * @returns {number[]}
 */
const calculateMovingAverage = (values, window = 3) => {
  if (!Array.isArray(values) || values.length === 0 || window < 1) {
    return [];
  }

  // Filter out NaN values for calculation
  const validValues = values.map((v) => (typeof v === 'number' && !Number.isNaN(v) ? v : null));
  const result = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = validValues.slice(start, i + 1).filter((v) => v !== null);
    if (slice.length === 0) {
      result.push(0);
    } else {
      const avg = slice.reduce((sum, v) => sum + v, 0) / slice.length;
      result.push(Math.round(avg * 100) / 100);
    }
  }

  return result;
};

/**
 * Calculate linear regression forecast for next period.
 * @param {number[]} values - Array of numeric values (ordered chronologically)
 * @returns {{forecast: number, slope: number, intercept: number}}
 */
const calculateForecast = (values) => {
  if (!Array.isArray(values) || values.length === 0) {
    return { forecast: 0, slope: 0, intercept: 0 };
  }

  const validValues = values
    .map((v) => (typeof v === 'number' && !Number.isNaN(v) ? v : null))
    .filter((v) => v !== null);

  if (validValues.length === 0) {
    return { forecast: 0, slope: 0, intercept: 0 };
  }

  if (validValues.length === 1) {
    const singleValue = validValues[0];
    return { forecast: singleValue, slope: 0, intercept: singleValue };
  }

  const n = validValues.length;
  const indices = validValues.map((_, i) => i);

  const sumX = indices.reduce((sum, x) => sum + x, 0);
  const sumY = validValues.reduce((sum, y) => sum + y, 0);
  const sumXY = indices.reduce((sum, x, i) => sum + x * validValues[i], 0);
  const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Forecast next period (index = n)
  const forecast = slope * n + intercept;

  return {
    forecast: Math.round(forecast * 100) / 100,
    slope: Math.round(slope * 100) / 100,
    intercept: Math.round(intercept * 100) / 100,
  };
};

/**
 * Calculate percentage change between two values.
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {number}
 */
const calculateChangePercent = (current, previous) => {
  if (typeof current !== 'number' || typeof previous !== 'number' || Number.isNaN(current) || Number.isNaN(previous)) {
    return 0;
  }
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Math.round(change * 100) / 100;
};

module.exports = {
  calculateTrend,
  calculateMovingAverage,
  calculateForecast,
  calculateChangePercent,
};
