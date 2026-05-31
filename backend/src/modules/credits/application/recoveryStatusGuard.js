const { ValidationError } = require('@/utils/errorHandler');

const RECOVERY_BALANCE_TOLERANCE = 0.01;
const CLOSED_LOAN_RECOVERY_MESSAGE = 'No se puede modificar la recuperación de un crédito cerrado.';
const DEFAULTED_LOAN_RECOVERY_MESSAGE = 'Solo se puede actualizar la recuperación de créditos en incumplimiento.';
const RECOVERED_LOAN_RECOVERY_MESSAGE = 'No se puede modificar la recuperación de un crédito ya recuperado.';
const OUTSTANDING_BALANCE_RECOVERY_MESSAGE = 'No se puede marcar el crédito como recuperado mientras tenga saldo pendiente.';

/**
 * Create the guard that validates recovery-status transitions against canonical loan balances.
 * @param {{ loanViewService: { getSnapshot: Function } }} dependencies
 * @returns {{ assertCanTransition: Function }}
 */
const createRecoveryStatusGuard = ({ loanViewService }) => {
  const assertCanTransition = ({ loan, nextRecoveryStatus }) => {
    const snapshot = loanViewService.getSnapshot(loan);
    const outstandingBalance = Number(snapshot.outstandingBalance || 0);

    if (loan.status === 'closed') {
      throw new ValidationError(CLOSED_LOAN_RECOVERY_MESSAGE);
    }

    if (loan.status !== 'defaulted') {
      throw new ValidationError(DEFAULTED_LOAN_RECOVERY_MESSAGE);
    }

    if (loan.recoveryStatus === 'recovered') {
      throw new ValidationError(RECOVERED_LOAN_RECOVERY_MESSAGE);
    }

    if (nextRecoveryStatus === 'recovered' && outstandingBalance > RECOVERY_BALANCE_TOLERANCE) {
      throw new ValidationError(OUTSTANDING_BALANCE_RECOVERY_MESSAGE);
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
