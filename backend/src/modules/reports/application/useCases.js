const { AuthorizationError } = require('../../../utils/errorHandler');

const ensureAdmin = (actor) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can access reports');
  }
};

const RECOVERY_BALANCE_TOLERANCE = 0.01;

const getRecoveryBucket = ({ loan, snapshot }) => {
  const outstandingBalance = parseFloat(snapshot.outstandingBalance || 0);

  if (loan.status === 'closed' || outstandingBalance <= RECOVERY_BALANCE_TOLERANCE) {
    return 'recovered';
  }

  if (outstandingBalance > RECOVERY_BALANCE_TOLERANCE) {
    return 'outstanding';
  }

  return 'ignored';
};

/**
 * Build the enriched report record for a single loan using canonical payment state.
 * @param {{ loan: object, paymentRepository: object, loanViewService: object }} dependencies
 * @returns {Promise<object>}
 */
const buildLoanReportRecord = async ({ loan, paymentRepository, loanViewService }) => {
  const payments = await paymentRepository.listByLoan(loan.id);
  const snapshot = loanViewService.getSnapshot(loan);
  const serializedLoan = typeof loan.toJSON === 'function' ? loan.toJSON() : loan;

  return {
    ...serializedLoan,
    totalPaid: snapshot.totalPaid.toFixed(2),
    totalDue: snapshot.totalPayable.toFixed(2),
    outstandingAmount: snapshot.outstandingBalance.toFixed(2),
    emi: snapshot.installmentAmount.toFixed(2),
    paymentCount: payments.length,
    lastPaymentDate: loan.lastPaymentDate || (payments.length > 0 ? payments[payments.length - 1].paymentDate : null),
    nextInstallment: snapshot.nextInstallment,
    recoveryBucket: getRecoveryBucket({ loan: serializedLoan, snapshot }),
  };
};

/**
 * Build report-ready loan records with payment and canonical balance details.
 * @param {{ loans: Array<object>, paymentRepository: object, loanViewService: object }} dependencies
 * @returns {Promise<Array<object>>}
 */
const buildLoansWithDetails = async ({ loans, paymentRepository, loanViewService }) => Promise.all(
  loans.map((loan) => buildLoanReportRecord({ loan, paymentRepository, loanViewService })),
);

/**
 * Create the report use case that returns fully recovered loans and summary totals.
 * @param {{ reportRepository: object, paymentRepository: object, loanViewService: object }} dependencies
 * @returns {Function}
 */
const createGetRecoveredLoans = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor }) => {
  ensureAdmin(actor);
  const recoveredLoans = await reportRepository.listRecoveredLoans();
  const loansWithDetails = await buildLoansWithDetails({ loans: recoveredLoans, paymentRepository, loanViewService });
  const totalRecoveredAmount = loansWithDetails.reduce((sum, loan) => sum + parseFloat(loan.totalPaid), 0);
  const totalLoansCount = loansWithDetails.length;

  return {
    success: true,
    count: totalLoansCount,
    summary: {
      totalRecoveredAmount: totalRecoveredAmount.toFixed(2),
      totalLoansCount,
      averageRecoveryAmount: totalLoansCount > 0 ? (totalRecoveredAmount / totalLoansCount).toFixed(2) : '0.00',
    },
    data: { loans: loansWithDetails },
  };
};

/**
 * Create the report use case that returns only loans with outstanding balances.
 * @param {{ reportRepository: object, paymentRepository: object, loanViewService: object }} dependencies
 * @returns {Function}
 */
const createGetOutstandingLoans = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor }) => {
  ensureAdmin(actor);
  const outstandingLoans = await reportRepository.listOutstandingLoans();
  const loansWithDetails = await buildLoansWithDetails({ loans: outstandingLoans, paymentRepository, loanViewService });
  const outstandingLoansFiltered = loansWithDetails.filter((loan) => loan.recoveryBucket === 'outstanding');
  const totalOutstandingAmount = outstandingLoansFiltered.reduce((sum, loan) => sum + parseFloat(loan.outstandingAmount), 0);
  const totalLoansCount = outstandingLoansFiltered.length;
  const pendingCount = outstandingLoansFiltered.filter((loan) => loan.recoveryStatus === 'pending').length;
  const inProgressCount = outstandingLoansFiltered.filter((loan) => loan.recoveryStatus === 'in_progress').length;

  return {
    success: true,
    count: totalLoansCount,
    summary: {
      totalOutstandingAmount: totalOutstandingAmount.toFixed(2),
      totalLoansCount,
      pendingCount,
      inProgressCount,
      averageOutstandingAmount: totalLoansCount > 0 ? (totalOutstandingAmount / totalLoansCount).toFixed(2) : '0.00',
    },
    data: { loans: outstandingLoansFiltered },
  };
};

/**
 * Create the recovery summary use case that splits canonical results into recovered and outstanding buckets.
 * @param {{ reportRepository: object, paymentRepository: object, loanViewService: object }} dependencies
 * @returns {Function}
 */
const createGetRecoveryReport = ({ reportRepository, paymentRepository, loanViewService }) => async ({ actor }) => {
  ensureAdmin(actor);
  const allLoans = await reportRepository.listRecoveryLoans();
  const loansWithDetails = await buildLoansWithDetails({ loans: allLoans, paymentRepository, loanViewService });
  const recoveredLoans = loansWithDetails.filter((loan) => loan.recoveryBucket === 'recovered');
  const outstandingLoans = loansWithDetails.filter((loan) => loan.recoveryBucket === 'outstanding');
  const totalRecoveredAmount = recoveredLoans.reduce((sum, loan) => sum + parseFloat(loan.totalPaid), 0);
  const totalOutstandingAmount = outstandingLoans.reduce((sum, loan) => sum + parseFloat(loan.outstandingAmount), 0);
  const totalLoansAmount = loansWithDetails.reduce((sum, loan) => sum + parseFloat(loan.totalDue), 0);
  const recoveryRate = totalLoansAmount > 0 ? ((totalRecoveredAmount / totalLoansAmount) * 100).toFixed(2) : '0.00';

  return {
    success: true,
    summary: {
      totalLoans: loansWithDetails.length,
      recoveredLoans: recoveredLoans.length,
      outstandingLoans: outstandingLoans.length,
      totalRecoveredAmount: totalRecoveredAmount.toFixed(2),
      totalOutstandingAmount: totalOutstandingAmount.toFixed(2),
      totalLoansAmount: totalLoansAmount.toFixed(2),
      recoveryRate: `${recoveryRate}%`,
    },
    data: {
      recoveredLoans,
      outstandingLoans,
    },
  };
};

module.exports = {
  createGetRecoveredLoans,
  createGetOutstandingLoans,
  createGetRecoveryReport,
};
