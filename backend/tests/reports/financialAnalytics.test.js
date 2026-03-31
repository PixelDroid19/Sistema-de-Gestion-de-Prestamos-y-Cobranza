const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateTrend,
  calculateMovingAverage,
  calculateForecast,
  calculateChangePercent,
} = require('../../src/modules/reports/application/useCases/statistics');

test('calculateTrend returns "stable" for empty or single value arrays', () => {
  assert.equal(calculateTrend([]), 'stable');
  assert.equal(calculateTrend([5]), 'stable');
  assert.equal(calculateTrend(null), 'stable');
  assert.equal(calculateTrend(undefined), 'stable');
});

test('calculateTrend returns "up" for increasing values', () => {
  assert.equal(calculateTrend([1, 2, 3, 4, 5]), 'up');
  assert.equal(calculateTrend([10, 20, 30]), 'up');
});

test('calculateTrend returns "down" for decreasing values', () => {
  assert.equal(calculateTrend([5, 4, 3, 2, 1]), 'down');
  assert.equal(calculateTrend([30, 20, 10]), 'down');
});

test('calculateTrend returns "stable" for flat values', () => {
  assert.equal(calculateTrend([5, 5, 5, 5]), 'stable');
  assert.equal(calculateTrend([10, 10, 10]), 'stable');
});

test('calculateTrend handles mixed numbers with NaN filtering', () => {
  assert.equal(calculateTrend([1, NaN, 3, 4]), 'up');
  assert.equal(calculateTrend([4, 3, NaN, 2]), 'down');
});

test('calculateMovingAverage returns empty array for invalid input', () => {
  assert.deepEqual(calculateMovingAverage([]), []);
  assert.deepEqual(calculateMovingAverage([1, 2, 3], 0), []);
  assert.deepEqual(calculateMovingAverage([1, 2, 3], -1), []);
});

test('calculateMovingAverage calculates correct 3-period moving average', () => {
  const result = calculateMovingAverage([10, 20, 30, 40, 50], 3);
  assert.equal(result.length, 5);
  // First value: 10/1 = 10
  assert.equal(result[0], 10);
  // Second value: (10+20)/2 = 15
  assert.equal(result[1], 15);
  // Third value: (10+20+30)/3 = 20
  assert.equal(result[2], 20);
  // Fourth value: (20+30+40)/3 = 30
  assert.equal(result[3], 30);
  // Fifth value: (30+40+50)/3 = 40
  assert.equal(result[4], 40);
});

test('calculateMovingAverage uses smaller window at start of array', () => {
  const result = calculateMovingAverage([10, 20, 30], 5);
  assert.equal(result[0], 10);
  assert.equal(result[1], 15);
  assert.equal(result[2], 20);
});

test('calculateMovingAverage handles NaN values', () => {
  const result = calculateMovingAverage([10, NaN, 30], 3);
  assert.equal(result[0], 10);
  assert.equal(result[1], 10);
  assert.equal(result[2], 20);
});

test('calculateForecast returns zero values for insufficient data', () => {
  const result = calculateForecast([]);
  assert.equal(result.forecast, 0);
  assert.equal(result.slope, 0);
  assert.equal(result.intercept, 0);

  const singleResult = calculateForecast([5]);
  assert.equal(singleResult.forecast, 5);
});

test('calculateForecast calculates linear regression correctly', () => {
  // y = 2x + 1: (0,1), (1,3), (2,5), (3,7)
  const result = calculateForecast([1, 3, 5, 7]);
  assert.equal(result.slope, 2);
  assert.equal(result.intercept, 1);
  // Forecast at index 4: y = 2*4 + 1 = 9
  assert.equal(result.forecast, 9);
});

test('calculateForecast works with real-world-like data', () => {
  // Monthly earnings: 1000, 1200, 1100, 1400, 1300, 1500
  const result = calculateForecast([1000, 1200, 1100, 1400, 1300, 1500]);
  assert.ok(typeof result.forecast === 'number');
  assert.ok(typeof result.slope === 'number');
  assert.ok(typeof result.intercept === 'number');
});

test('calculateChangePercent returns 0 for non-numeric inputs', () => {
  assert.equal(calculateChangePercent('abc', 100), 0);
  assert.equal(calculateChangePercent(100, 'xyz'), 0);
  assert.equal(calculateChangePercent(NaN, 100), 0);
  assert.equal(calculateChangePercent(100, NaN), 0);
});

test('calculateChangePercent returns 100 when previous is 0 and current is not', () => {
  assert.equal(calculateChangePercent(50, 0), 100);
  assert.equal(calculateChangePercent(100, 0), 100);
});

test('calculateChangePercent returns 0 when both are 0', () => {
  assert.equal(calculateChangePercent(0, 0), 0);
});

test('calculateChangePercent calculates correct percentage changes', () => {
  assert.equal(calculateChangePercent(110, 100), 10);
  assert.equal(calculateChangePercent(90, 100), -10);
  assert.equal(calculateChangePercent(200, 100), 100);
  assert.equal(calculateChangePercent(50, 100), -50);
});

test('calculateChangePercent handles decimal precision', () => {
  const result = calculateChangePercent(33.33, 100);
  assert.ok(Math.abs(result - (-66.67)) < 0.01);
});
