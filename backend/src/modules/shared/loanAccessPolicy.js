const { AuthorizationError, NotFoundError } = require('../../utils/errorHandler');

const normalizeId = (value) => Number(value);

/**
 * Determine whether an actor can read a loan under the shared visibility rules.
 * @param {{ actor: object, loan: object }} input
 * @returns {boolean}
 */
const isLoanVisibleToActor = ({ actor, loan }) => {
  if (!actor || !loan) {
    return false;
  }

  if (actor.role === 'admin') {
    return true;
  }

  if (actor.role === 'customer') {
    return normalizeId(actor.id) === normalizeId(loan.customerId);
  }

  if (actor.role === 'agent') {
    return normalizeId(actor.id) === normalizeId(loan.agentId);
  }

  if (actor.role === 'socio') {
    return normalizeId(actor.associateId) === normalizeId(loan.associateId);
  }

  return false;
};

const canActorViewAttachment = ({ actor, loan, attachment }) => {
  if (!actor || !loan || !attachment) {
    return false;
  }

  if (actor.role === 'customer') {
    return isLoanVisibleToActor({ actor, loan }) && Boolean(attachment.customerVisible);
  }

  return isLoanVisibleToActor({ actor, loan });
};

/**
 * Determine whether an actor can mutate a loan under the shared write rules.
 * @param {{ actor: object, loan: object }} input
 * @returns {boolean}
 */
const isLoanMutableByActor = ({ actor, loan }) => {
  if (!actor || !loan) {
    return false;
  }

  if (actor.role === 'admin') {
    return true;
  }

  if (actor.role === 'agent') {
    return normalizeId(actor.id) === normalizeId(loan.agentId);
  }

  return false;
};

const buildAccessDeniedMessage = (actor) => {
  if (actor?.role === 'customer') {
    return 'You can only access your own loans';
  }

  if (actor?.role === 'agent') {
    return 'You can only access loans assigned to you';
  }

  return 'You do not have access to this loan';
};

const buildMutationDeniedMessage = (actor) => {
  if (actor?.role === 'agent') {
    return 'You can only update loans assigned to you';
  }

  return 'You do not have permission to update this loan';
};

/**
 * Create the shared loan access policy used by credit, payout, and reporting seams.
 * @param {{ loanRepository: { findById: Function } }} dependencies
 * @returns {{ assertLoanAccess: Function, findAuthorizedLoan: Function, filterVisibleLoans: Function, assertLoanMutationAccess: Function, findAuthorizedMutationLoan: Function }}
 */
const createLoanAccessPolicy = ({ loanRepository }) => {
  const assertLoanAccess = ({ actor, loan }) => {
    if (!isLoanVisibleToActor({ actor, loan })) {
      throw new AuthorizationError(buildAccessDeniedMessage(actor));
    }

    return loan;
  };

  const findAuthorizedLoan = async ({ actor, loanId }) => {
    const loan = await loanRepository.findById(loanId);

    if (!loan) {
      throw new NotFoundError('Loan');
    }

    return assertLoanAccess({ actor, loan });
  };

  const filterVisibleLoans = ({ actor, loans }) => loans.filter((loan) => isLoanVisibleToActor({ actor, loan }));

  const assertLoanMutationAccess = ({ actor, loan }) => {
    if (!isLoanMutableByActor({ actor, loan })) {
      throw new AuthorizationError(buildMutationDeniedMessage(actor));
    }

    return loan;
  };

  const findAuthorizedMutationLoan = async ({ actor, loanId }) => {
    const loan = await loanRepository.findById(loanId);

    if (!loan) {
      throw new NotFoundError('Loan');
    }

    return assertLoanMutationAccess({ actor, loan });
  };

  return {
    assertLoanAccess,
    findAuthorizedLoan,
    filterVisibleLoans,
    assertLoanMutationAccess,
    findAuthorizedMutationLoan,
    canActorViewAttachment,
  };
};

module.exports = {
  createLoanAccessPolicy,
  isLoanVisibleToActor,
  isLoanMutableByActor,
  canActorViewAttachment,
};
