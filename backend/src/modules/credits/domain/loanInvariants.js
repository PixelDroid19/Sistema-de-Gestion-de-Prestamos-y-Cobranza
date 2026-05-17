/**
 * Domain invariants for the Loan entity.
 *
 * These functions express business rules that constrain valid loan states.
 * They are called from the Sequelize model validators, keeping the model thin
 * while allowing the rules to be unit-tested independently of the ORM.
 *
 * @module credits/domain/loanInvariants
 */

const CLOSED_STATUSES = new Set(['closed', 'cancelled', 'paid']);
const CLOSURE_REASONS = new Set(['payoff', 'schedule_completion', 'annulled', 'cancelled']);

/**
 * Ensure endDate is not before startDate when both are present.
 * @param {{ startDate: Date|string|null, endDate: Date|string|null }} loan
 * @throws {Error} When endDate precedes startDate.
 */
const assertEndDateNotBeforeStartDate = ({ startDate, endDate }) => {
  if (startDate && endDate) {
    if (new Date(endDate) < new Date(startDate)) {
      throw new Error('endDate must be on or after startDate');
    }
  }
};

/**
 * Prevent semantically conflicting status/closureReason combinations.
 * @param {{ status: string, closureReason: string|null, closedAt: Date|null }} loan
 * @throws {Error} When the closure state is inconsistent.
 */
const assertConsistentClosureState = ({ status, closureReason, closedAt }) => {
  if (CLOSURE_REASONS.has(closureReason) && !CLOSED_STATUSES.has(status)) {
    throw new Error(
      `Loan with closureReason '${closureReason}' must have a closed status (closed, cancelled, or paid)`,
    );
  }

  if (CLOSED_STATUSES.has(status) && !closedAt) {
    throw new Error(`Loan with status '${status}' must have a closedAt date`);
  }
};

module.exports = {
  CLOSED_STATUSES,
  CLOSURE_REASONS,
  assertEndDateNotBeforeStartDate,
  assertConsistentClosureState,
};
