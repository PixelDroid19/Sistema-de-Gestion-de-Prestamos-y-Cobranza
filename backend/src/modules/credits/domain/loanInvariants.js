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
const END_DATE_ORDER_MESSAGE = 'La fecha final del crédito debe ser igual o posterior a la fecha de inicio';
const CLOSURE_REASON_STATUS_MESSAGE = 'El motivo de cierre requiere que el crédito esté cerrado, cancelado o pagado';
const CLOSED_STATUS_DATE_MESSAGE = 'Los créditos cerrados, cancelados o pagados deben tener fecha de cierre';

/**
 * Ensure endDate is not before startDate when both are present.
 * @param {{ startDate: Date|string|null, endDate: Date|string|null }} loan
 * @throws {Error} When endDate precedes startDate.
 */
const assertEndDateNotBeforeStartDate = ({ startDate, endDate }) => {
  if (startDate && endDate) {
    if (new Date(endDate) < new Date(startDate)) {
      throw new Error(END_DATE_ORDER_MESSAGE);
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
    throw new Error(CLOSURE_REASON_STATUS_MESSAGE);
  }

  if (CLOSED_STATUSES.has(status) && !closedAt) {
    throw new Error(CLOSED_STATUS_DATE_MESSAGE);
  }
};

module.exports = {
  CLOSED_STATUSES,
  CLOSED_STATUS_DATE_MESSAGE,
  CLOSURE_REASONS,
  CLOSURE_REASON_STATUS_MESSAGE,
  END_DATE_ORDER_MESSAGE,
  assertEndDateNotBeforeStartDate,
  assertConsistentClosureState,
};
