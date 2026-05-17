/**
 * Domain invariants for the Payment entity.
 *
 * Business rules for valid payment allocation states, expressed as pure
 * functions. Called from the Sequelize model validator but independently testable.
 *
 * @module credits/domain/paymentInvariants
 */

const { compareWithinTolerance } = require('@/modules/shared/money');

/** Maximum allocation rounding tolerance in currency units. */
const ALLOCATION_TOLERANCE = 0.02;

/**
 * Verify that payment allocation fields sum to the total payment amount.
 * @param {{ amount: number, principalApplied: number, interestApplied: number, penaltyApplied: number, overpaymentAmount: number }} payment
 * @throws {Error} When allocation does not match amount within tolerance.
 */
const assertAllocationIntegrity = ({ amount, principalApplied, interestApplied, penaltyApplied, overpaymentAmount }) => {
  if (amount == null || amount <= 0) return;

  const allocatedTotal = Number(principalApplied || 0)
    + Number(interestApplied || 0)
    + Number(penaltyApplied || 0)
    + Number(overpaymentAmount || 0);

  if (!compareWithinTolerance(allocatedTotal, amount, ALLOCATION_TOLERANCE)) {
    throw new Error(
      `Allocation breakdown (${allocatedTotal.toFixed(2)}) does not match payment amount (${Number(amount).toFixed(2)}). `
      + `principalApplied=${principalApplied}, interestApplied=${interestApplied}, penaltyApplied=${penaltyApplied}, overpaymentAmount=${overpaymentAmount}`,
    );
  }
};

module.exports = {
  ALLOCATION_TOLERANCE,
  assertAllocationIntegrity,
};
