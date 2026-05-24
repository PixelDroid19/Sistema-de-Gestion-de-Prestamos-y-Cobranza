const { AuthorizationError, NotFoundError } = require('@/utils/errorHandler');
const { normalizeApplicationRole } = require('./roles');

const resolveActorRole = (actor) => normalizeApplicationRole(actor?.role);
const isBackofficeRole = (role) => role === 'admin' || role === 'employee';

/**
 * Determine whether an actor can read a loan under the administrative visibility rules.
 * Customers and socios are domain records, not authenticated backoffice roles.
 * @param {{ actor: object, loan: object }} input
 * @returns {boolean}
 */
const isLoanVisibleToActor = ({ actor, loan }) => {
  if (!actor || !loan) {
    return false;
  }

  const actorRole = resolveActorRole(actor);

  return isBackofficeRole(actorRole);
};

/**
 * Determine whether an actor can read a loan attachment.
 * @param {{ actor: object, loan: object, attachment: object }} input
 * @returns {boolean}
 */
const canActorViewAttachment = ({ actor, loan, attachment }) => {
  if (!actor || !loan || !attachment) {
    return false;
  }

  return isLoanVisibleToActor({ actor, loan });
};

/**
 * Determine whether an actor can mutate a loan under the administrative write rules.
 * @param {{ actor: object, loan: object }} input
 * @returns {boolean}
 */
const isLoanMutableByActor = ({ actor, loan }) => {
  if (!actor || !loan) {
    return false;
  }

  return isBackofficeRole(resolveActorRole(actor));
};

const buildAccessDeniedMessage = () => 'Only authorized backoffice users can access loans';

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
