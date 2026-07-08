require('dotenv').config({ quiet: true });
require('module-alias/register');

const { sequelize, Loan, Payment } = require('@/models');
const {
  buildAmortizationSchedule,
  calculateInstallmentAmount,
  cloneSchedule,
  addMonths,
  getEquivalentMonthlyRate,
  roundCurrency,
  summarizeSchedule,
} = require('@/modules/credits/application/creditFormulaHelpers');

const CONFIRMATION_VALUE = 'REPAIR_CAPITAL_PAYMENT_SCHEDULES';

const parsePositiveInteger = (value, name) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const parseArgs = (argv = []) => {
  const args = new Set(argv);
  const unknownArgs = [...args].filter((arg) => arg !== '--apply' && !arg.startsWith('--loan-id='));
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown arguments: ${unknownArgs.join(', ')}`);
  }

  const rawLoanId = [...args]
    .find((arg) => arg.startsWith('--loan-id='))
    ?.split('=')[1];

  return {
    apply: args.has('--apply'),
    targetLoanId: rawLoanId ? parsePositiveInteger(rawLoanId, '--loan-id') : null,
  };
};

const assertApplyConfirmed = ({ apply, env = process.env }) => {
  if (!apply) return;
  if (env.REPAIR_CAPITAL_PAYMENT_SCHEDULES_CONFIRM !== CONFIRMATION_VALUE) {
    throw new Error(
      `Refusing to apply schedule repairs. Set REPAIR_CAPITAL_PAYMENT_SCHEDULES_CONFIRM=${CONFIRMATION_VALUE}`,
    );
  }
};

const isBadCapitalRow = (row) => {
  const paidPrincipal = Number(row?.paidPrincipal || 0);
  const paidInterest = Number(row?.paidInterest || 0);
  const remainingInterest = Number(row?.remainingInterest || 0);
  const status = String(row?.status || '').toLowerCase();

  return status === 'partial'
    && paidPrincipal > 0.01
    && paidInterest <= 0.01
    && remainingInterest > 0.01;
};

const calculateReducedTerm = ({ principal, annualRate, paymentAmount, maxTerm }) => {
  if (principal <= 0.01) return 0;
  const monthlyRate = getEquivalentMonthlyRate(annualRate);
  if (monthlyRate <= 0) return Math.max(1, Math.min(maxTerm, Math.ceil(principal / paymentAmount)));
  if (paymentAmount <= principal * monthlyRate) return maxTerm;

  const term = Math.ceil(-Math.log(1 - ((principal * monthlyRate) / paymentAmount)) / Math.log(1 + monthlyRate));
  return Number.isFinite(term) ? Math.max(1, Math.min(maxTerm, term)) : maxTerm;
};

const resolveStrategy = (payment) => {
  const raw = String(payment?.paymentMetadata?.strategyApplied || payment?.paymentMetadata?.strategy || '').toLowerCase();
  return raw.includes('payment') || raw.includes('quota') ? 'reduce_payment' : 'reduce_term';
};

const buildRepairedSchedule = ({ loan, schedule, firstAffectedIndex, capitalReduction, strategy }) => {
  const preservedRows = schedule.slice(0, firstAffectedIndex);
  const damagedRows = schedule.slice(firstAffectedIndex).filter((row) => row.status !== 'annulled');
  const principalBeforeBadCapital = roundCurrency(damagedRows.reduce((sum, row) => (
    sum + Number(row.remainingPrincipal || 0) + Number(row.paidPrincipal || 0)
  ), 0));
  const principalAfterReduction = roundCurrency(Math.max(0, principalBeforeBadCapital - capitalReduction));

  if (principalAfterReduction <= 0.01) {
    return {
      schedule: preservedRows,
      principalBeforeBadCapital,
      principalAfterReduction: 0,
    };
  }

  const firstDamagedRow = damagedRows[0];
  const remainingTerm = damagedRows.length;
  const firstInstallmentNumber = Number(firstDamagedRow.installmentNumber || firstAffectedIndex + 1);
  const currentInstallmentAmount = roundCurrency(
    firstDamagedRow.scheduledPayment
    || loan.installmentAmount
    || calculateInstallmentAmount({
      amount: principalAfterReduction,
      interestRate: loan.interestRate,
      termMonths: remainingTerm,
    }),
  );
  const rebuiltTerm = strategy === 'reduce_payment'
    ? remainingTerm
    : calculateReducedTerm({
      principal: principalAfterReduction,
      annualRate: loan.interestRate,
      paymentAmount: currentInstallmentAmount,
      maxTerm: remainingTerm,
    });

  const rebuiltRows = buildAmortizationSchedule({
    amount: principalAfterReduction,
    interestRate: loan.interestRate,
    termMonths: rebuiltTerm,
    startDate: addMonths(firstDamagedRow.dueDate, -1),
    calculationMethod: loan.calculationMethod || 'FRENCH',
    ...(strategy === 'reduce_term' ? { installmentAmount: currentInstallmentAmount } : {}),
  }).map((row, index) => ({
    ...row,
    installmentNumber: firstInstallmentNumber + index,
    status: 'pending',
    paidPrincipal: 0,
    paidInterest: 0,
    paidTotal: 0,
  }));

  return {
    schedule: [...preservedRows, ...rebuiltRows],
    principalBeforeBadCapital,
    principalAfterReduction,
  };
};

const buildSnapshotWithCapitalAdjustments = ({ schedule, capitalReduction }) => {
  const snapshot = summarizeSchedule(schedule);
  const totalPaidPrincipal = roundCurrency((snapshot.totalPaidPrincipal || 0) + capitalReduction);
  const totalPaidInterest = roundCurrency(snapshot.totalPaidInterest || 0);
  const totalPaid = roundCurrency(totalPaidPrincipal + totalPaidInterest);

  return {
    ...snapshot,
    capitalAdjustmentsApplied: capitalReduction,
    totalPrincipal: roundCurrency((snapshot.totalPrincipal || 0) + capitalReduction),
    totalPaidPrincipal,
    totalPaidInterest,
    totalPaid,
    totalPayable: roundCurrency(totalPaid + snapshot.outstandingBalance),
  };
};

const repairLoan = async (loan, { apply }) => {
  const schedule = cloneSchedule(loan.emiSchedule || []);
  const firstAffectedIndex = schedule.findIndex(isBadCapitalRow);
  if (firstAffectedIndex < 0) return null;

  const capitalPayments = await Payment.findAll({
    where: {
      loanId: loan.id,
      paymentType: 'capital',
      status: 'completed',
    },
    order: [['paymentDate', 'ASC'], ['id', 'ASC']],
  });
  const badPrincipalApplied = schedule.slice(firstAffectedIndex).reduce((sum, row) => (
    isBadCapitalRow(row) ? sum + Number(row.paidPrincipal || 0) : sum
  ), 0);
  const capitalReduction = roundCurrency(capitalPayments.reduce((sum, payment) => (
    sum + Number(payment.principalApplied || payment.amount || 0)
  ), 0) || badPrincipalApplied);
  const strategy = resolveStrategy(capitalPayments[capitalPayments.length - 1]);
  const repaired = buildRepairedSchedule({
    loan,
    schedule,
    firstAffectedIndex,
    capitalReduction,
    strategy,
  });
  const snapshot = buildSnapshotWithCapitalAdjustments({
    schedule: repaired.schedule,
    capitalReduction,
  });
  const report = {
    loanId: loan.id,
    firstAffectedInstallment: schedule[firstAffectedIndex]?.installmentNumber,
    strategy,
    capitalReduction,
    before: {
      principalOutstanding: loan.principalOutstanding,
      interestOutstanding: loan.interestOutstanding,
      outstandingBalance: loan.financialSnapshot?.outstandingBalance,
      installments: schedule.length,
    },
    after: {
      principalOutstanding: snapshot.outstandingPrincipal,
      interestOutstanding: snapshot.outstandingInterest,
      outstandingBalance: snapshot.outstandingBalance,
      installments: repaired.schedule.length,
    },
  };

  if (apply) {
    loan.emiSchedule = repaired.schedule;
    loan.installmentAmount = snapshot.installmentAmount;
    loan.totalPayable = snapshot.totalPayable;
    loan.totalPaid = snapshot.totalPaid;
    loan.principalOutstanding = snapshot.outstandingPrincipal;
    loan.interestOutstanding = snapshot.outstandingInterest;
    loan.financialSnapshot = snapshot;
    if (snapshot.outstandingBalance <= 0.01) {
      loan.status = 'closed';
      loan.recoveryStatus = 'recovered';
      loan.closedAt = new Date();
      loan.closureReason = 'capital_reduction_repair';
    }
    await loan.save();
  }

  return report;
};

const main = async ({ argv = process.argv.slice(2) } = {}) => {
  const { apply, targetLoanId } = parseArgs(argv);
  assertApplyConfirmed({ apply });

  await sequelize.authenticate();
  const where = targetLoanId ? { id: targetLoanId } : {};
  const loans = await Loan.findAll({ where, order: [['id', 'ASC']] });
  const reports = [];

  for (const loan of loans) {
    const report = await repairLoan(loan, { apply });
    if (report) reports.push(report);
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    checkedLoans: loans.length,
    affectedLoans: reports.length,
    reports,
  }, null, 2));
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Failed to repair capital payment schedules:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = {
  CONFIRMATION_VALUE,
  assertApplyConfirmed,
  buildRepairedSchedule,
  buildSnapshotWithCapitalAdjustments,
  isBadCapitalRow,
  parseArgs,
  repairLoan,
  resolveStrategy,
};
