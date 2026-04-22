const { compareWithinTolerance, roundCurrency } = require('./precision');

const SUMMARY_FIELDS = ['installmentAmount', 'totalPayable', 'outstandingBalance'];
const SCHEDULE_FIELDS = ['scheduledPayment', 'principalComponent', 'interestComponent', 'remainingBalance', 'remainingPrincipal', 'remainingInterest'];

const buildMismatch = ({ scope, field, expected, actual }) => ({
  scope,
  field,
  expected: roundCurrency(expected),
  actual: roundCurrency(actual),
});

const compareSimulationResults = ({ legacyResult, dagResult, tolerance = 0.01 } = {}) => {
  const mismatches = [];

  // Compare top-level lateFeeMode (exact match, not numeric tolerance)
  if (legacyResult?.lateFeeMode !== dagResult?.lateFeeMode) {
    mismatches.push({
      scope: 'top-level',
      field: 'lateFeeMode',
      expected: legacyResult?.lateFeeMode,
      actual: dagResult?.lateFeeMode,
    });
  }

  SUMMARY_FIELDS.forEach((field) => {
    if (!compareWithinTolerance(legacyResult?.summary?.[field], dagResult?.summary?.[field], tolerance)) {
      mismatches.push(buildMismatch({
        scope: 'summary',
        field,
        expected: legacyResult?.summary?.[field],
        actual: dagResult?.summary?.[field],
      }));
    }
  });

  const legacySchedule = Array.isArray(legacyResult?.schedule) ? legacyResult.schedule : [];
  const dagSchedule = Array.isArray(dagResult?.schedule) ? dagResult.schedule : [];

  if (legacySchedule.length !== dagSchedule.length) {
    mismatches.push({
      scope: 'schedule',
      field: 'length',
      expected: legacySchedule.length,
      actual: dagSchedule.length,
    });
  }

  legacySchedule.forEach((legacyRow, index) => {
    const dagRow = dagSchedule[index] || {};

    if (legacyRow?.dueDate !== dagRow?.dueDate) {
      mismatches.push({
        scope: `schedule[${index + 1}]`,
        field: 'dueDate',
        expected: legacyRow?.dueDate,
        actual: dagRow?.dueDate,
      });
    }

    SCHEDULE_FIELDS.forEach((field) => {
      if (!compareWithinTolerance(legacyRow?.[field], dagRow?.[field], tolerance)) {
        mismatches.push(buildMismatch({
          scope: `schedule[${index + 1}]`,
          field,
          expected: legacyRow?.[field],
          actual: dagRow?.[field],
        }));
      }
    });
  });

  return {
    passed: mismatches.length === 0,
    tolerance,
    mismatches,
  };
};

module.exports = {
  compareSimulationResults,
};
