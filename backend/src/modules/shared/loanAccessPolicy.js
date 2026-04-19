const { AuthorizationError, NotFoundError } = require('@/utils/errorHandler');
const { normalizeApplicationRole } = require('./roles');

const normalizeId = (value) => Number(value);
const resolveActorRole = (actor) => normalizeApplicationRole(actor?.role);

/**
 * Determine whether an actor can read a loan under the shared visibility rules.
 * @param {{ actor: object, loan: object }} input
 * @returns {boolean}
 */
const isLoanVisibleToActor = ({ actor, loan }) => {
  if (!actor || !loan) {
    return false;
  }

  const actorRole = resolveActorRole(actor);

  if (actorRole === 'admin') {
    return true;
  }

  if (actorRole === 'customer') {
    return normalizeId(actor.id) === normalizeId(loan.customerId);
  }

  if (actorRole === 'socio') {
    return normalizeId(actor.associateId) === normalizeId(loan.associateId);
  }

  return false;
};

const canActorViewAttachment = ({ actor, loan, attachment }) => {
  if (!actor || !loan || !attachment) {
    return false;
  }

  if (resolveActorRole(actor) === 'customer') {
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

  if (resolveActorRole(actor) === 'admin') {
    return true;
  }

  return false;
};

const buildAccessDeniedMessage = (actor) => {
  const actorRole = resolveActorRole(actor);

  if (actorRole === 'customer') {
    return 'You can only access your own loans';
  }

  if (actorRole === 'socio') {
    return 'You can only access loans linked to your associate account';
  }

  return 'You do not have access to this loan';
};

const buildMutationDeniedMessage = () => 'You do not have permission to update this loan';

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
