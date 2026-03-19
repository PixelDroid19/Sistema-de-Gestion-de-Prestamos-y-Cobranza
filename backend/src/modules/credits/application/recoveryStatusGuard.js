const { ValidationError } = require('../../../utils/errorHandler');

const RECOVERY_BALANCE_TOLERANCE = 0.01;

const createRecoveryStatusGuard = ({ loanViewService }) => {
  const assertCanTransition = ({ loan, nextRecoveryStatus }) => {
    const snapshot = loanViewService.getSnapshot(loan);
    const outstandingBalance = Number(snapshot.outstandingBalance || 0);

    if (loan.status === 'closed') {
      throw new ValidationError('Cannot modify recovery status for a closed loan');
    }

    if (loan.status !== 'defaulted') {
      throw new ValidationError('Recovery status can only be updated for defaulted loans');
    }

    if (loan.recoveryStatus === 'recovered') {
      throw new ValidationError('Cannot modify recovery status for an already recovered loan');
    }

    if (nextRecoveryStatus === 'recovered' && outstandingBalance > RECOVERY_BALANCE_TOLERANCE) {
      throw new ValidationError('Cannot mark a loan as recovered while an outstanding balance remains');
    }

    return loan;
  };

  return {
    assertCanTransition,
  };
};

module.exports = {
  createRecoveryStatusGuard,
  RECOVERY_BALANCE_TOLERANCE,
};
