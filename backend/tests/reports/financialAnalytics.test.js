const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateTrend,
  calculateMovingAverage,
  calculateForecast,
  calculateChangePercent,
} = require('@/modules/reports/application/useCases/statistics');
const { createGetForecastAnalysis } = require('@/modules/reports/application/useCases/createGetForecastAnalysis');
const { createGetExecutiveDashboard } = require('@/modules/reports/application/useCases/createGetExecutiveDashboard');
const { createGetCreditEarnings } = require('@/modules/reports/application/useCases/createGetCreditEarnings');
const { createGetNextMonthProjection } = require('@/modules/reports/application/useCases/createGetNextMonthProjection');

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

test('createGetForecastAnalysis clamps negative next-month earnings to zero', async () => {
  const getForecastAnalysis = createGetForecastAnalysis({
    reportRepository: {
      async getMonthlyEarnings() {
        return [
          { month: '2026-01', totalEarnings: 110 },
          { month: '2026-02', totalEarnings: 100 },
          { month: '2026-03', totalEarnings: 90 },
          { month: '2026-04', totalEarnings: 80 },
          { month: '2026-05', totalEarnings: 70 },
          { month: '2026-06', totalEarnings: 60 },
          { month: '2026-07', totalEarnings: 50 },
          { month: '2026-08', totalEarnings: 40 },
          { month: '2026-09', totalEarnings: 30 },
          { month: '2026-10', totalEarnings: 20 },
          { month: '2026-11', totalEarnings: 10 },
          { month: '2026-12', totalEarnings: 0 },
        ];
      },
    },
  });

  const result = await getForecastAnalysis({
    actor: { id: 1, role: 'admin' },
    year: 2026,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.forecast.nextMonthEarnings, '0.00');
  assert.equal(result.data.forecast.slope, '-10.00');
});

test('createGetExecutiveDashboard keeps monthly interest and penalties aligned with normalized months', async () => {
  const currentYear = new Date().getFullYear();
  const getExecutiveDashboard = createGetExecutiveDashboard({
    reportRepository: {
      async getPerformanceMetrics(year) {
        return {
          totalEarnings: year === currentYear ? 4000 : 2000,
          totalInterest: year === currentYear ? 400 : 200,
          totalPenalties: year === currentYear ? 40 : 20,
          paymentCount: year === currentYear ? 2 : 1,
          totalLoans: year === currentYear ? 3 : 2,
          totalLoanAmount: year === currentYear ? 50000 : 25000,
        };
      },
      async getMonthlyEarnings() {
        return [
          { month: `${currentYear}-01`, totalEarnings: 1000, totalInterest: 100, totalPenalties: 10 },
          { month: `${currentYear}-03`, totalEarnings: 3000, totalInterest: 300, totalPenalties: 30 },
        ];
      },
    },
    paymentRepository: {},
  });

  const result = await getExecutiveDashboard({
    actor: { id: 1, role: 'admin' },
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data.monthlyEarnings.slice(0, 3), [
    { month: `${currentYear}-01`, earnings: '1000.00', interest: '100.00', penalties: '10.00' },
    { month: `${currentYear}-02`, earnings: '0.00', interest: '0.00', penalties: '0.00' },
    { month: `${currentYear}-03`, earnings: '3000.00', interest: '300.00', penalties: '30.00' },
  ]);
});

test('createGetCreditEarnings uses aggregate metrics without per-loan recovery scans', async () => {
  const getCreditEarnings = createGetCreditEarnings({
    reportRepository: {
      async listOutstandingLoans() {
        return [
          { id: 1, amount: 1000, totalPaid: 1100 },
          { id: 2, amount: 2000, totalPaid: 2200 },
        ];
      },
      async listRecoveryLoans() {
        throw new Error('listRecoveryLoans should not be called by credit earnings');
      },
      async getPerformanceMetrics() {
        return {
          totalInterest: 300,
        };
      },
    },
  });

  const result = await getCreditEarnings({
    actor: { id: 1, role: 'admin' },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.totalCredits, 2);
  assert.equal(result.data.totalLoanAmount, '3000.00');
  assert.equal(result.data.totalInterestEarnings, '300.00');
  assert.equal(result.data.profitMargin, '10.00');
});

test('createGetNextMonthProjection keeps prior-year months in the six-month historical window', async () => {
  const requestedYears = [];
  const getNextMonthProjection = createGetNextMonthProjection({
    clock: () => new Date('2026-02-15T12:00:00.000Z'),
    reportRepository: {
      async getMonthlyEarnings(year) {
        requestedYears.push(year);
        if (year === 2025) {
          return [
            { month: '2025-09', totalEarnings: 100 },
            { month: '2025-10', totalEarnings: 200 },
            { month: '2025-11', totalEarnings: 300 },
            { month: '2025-12', totalEarnings: 400 },
          ];
        }

        if (year === 2026) {
          return [
            { month: '2026-01', totalEarnings: 500 },
            { month: '2026-02', totalEarnings: 600 },
          ];
        }

        return [];
      },
    },
  });

  const result = await getNextMonthProjection({
    actor: { id: 1, role: 'admin' },
  });

  assert.deepEqual(requestedYears, [2025, 2026]);
  assert.equal(result.success, true);
  assert.equal(result.data.projection.month, '2026-03');
  assert.equal(result.data.projection.projectedEarnings, '700.00');
  assert.equal(result.data.projection.confidenceLevel, 'medium');
  assert.equal(result.data.historicalSummary.averageEarnings, '350.00');
  assert.equal(result.data.historicalSummary.lastMonthEarnings, '600.00');
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
