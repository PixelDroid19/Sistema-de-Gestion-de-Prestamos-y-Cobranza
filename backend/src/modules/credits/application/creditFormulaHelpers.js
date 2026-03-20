const roundCurrency = (value) => Number.parseFloat((Number(value) || 0).toFixed(2));

const addMonths = (date, months) => {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
};

/**
 * Calculate the fixed installment amount for a reducing-balance loan.
 * @param {{ amount: number, interestRate: number, termMonths: number }} input
 * @returns {number}
 */
const calculateInstallmentAmount = ({ amount, interestRate, termMonths }) => {
  const principal = Number(amount);
  const term = Number(termMonths);
  const monthlyRate = Number(interestRate) / 100 / 12;

  if (!term || term <= 0) {
    return 0;
  }

  if (monthlyRate === 0) {
    return roundCurrency(principal / term);
  }

  const installment = (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) /
    (Math.pow(1 + monthlyRate, term) - 1);

  return roundCurrency(installment);
};

/**
 * Create canonical amortization rows for a loan.
 * @param {{ amount: number, interestRate: number, termMonths: number, startDate?: Date|string }} input
 * @returns {Array<object>}
 */
const buildAmortizationSchedule = ({ amount, interestRate, termMonths, startDate = new Date() }) => {
  const installmentAmount = calculateInstallmentAmount({ amount, interestRate, termMonths });
  const schedule = [];
  const monthlyRate = Number(interestRate) / 100 / 12;
  let balance = roundCurrency(amount);

  for (let month = 1; month <= Number(termMonths); month += 1) {
    const openingBalance = balance;
    const interestComponent = monthlyRate === 0
      ? 0
      : roundCurrency(openingBalance * monthlyRate);
    const principalComponent = month === Number(termMonths)
      ? roundCurrency(openingBalance)
      : roundCurrency(Math.min(openingBalance, installmentAmount - interestComponent));
    const scheduledPayment = roundCurrency(principalComponent + interestComponent);
    balance = roundCurrency(Math.max(0, openingBalance - principalComponent));

    schedule.push({
      installmentNumber: month,
      dueDate: addMonths(new Date(startDate), month).toISOString(),
      openingBalance,
      scheduledPayment,
      principalComponent,
      interestComponent,
      paidPrincipal: 0,
      paidInterest: 0,
      paidTotal: 0,
      remainingPrincipal: principalComponent,
      remainingInterest: interestComponent,
      remainingBalance: balance,
      status: 'pending',
    });
  }

  return schedule;
};

/**
 * Summarize the canonical schedule into persisted totals.
 * @param {Array<object>} schedule
 * @returns {object}
 */
const summarizeSchedule = (schedule = []) => {
  const totals = schedule.reduce((summary, row) => {
    summary.totalPrincipal += Number(row.principalComponent || 0);
    summary.totalInterest += Number(row.interestComponent || 0);
    summary.totalPayable += Number(row.scheduledPayment || 0);
    summary.totalPaidPrincipal += Number(row.paidPrincipal || 0);
    summary.totalPaidInterest += Number(row.paidInterest || 0);
    summary.totalPaid += Number(row.paidTotal || 0);
    summary.outstandingPrincipal += Number(row.remainingPrincipal || 0);
    summary.outstandingInterest += Number(row.remainingInterest || 0);
    return summary;
  }, {
    totalPrincipal: 0,
    totalInterest: 0,
    totalPayable: 0,
    totalPaidPrincipal: 0,
    totalPaidInterest: 0,
    totalPaid: 0,
    outstandingPrincipal: 0,
    outstandingInterest: 0,
  });

  const nextInstallment = schedule.find((row) => (row.remainingPrincipal || 0) + (row.remainingInterest || 0) > 0) || null;

  return {
    installmentAmount: roundCurrency(schedule[0]?.scheduledPayment || 0),
    totalPrincipal: roundCurrency(totals.totalPrincipal),
    totalInterest: roundCurrency(totals.totalInterest),
    totalPayable: roundCurrency(totals.totalPayable),
    totalPaidPrincipal: roundCurrency(totals.totalPaidPrincipal),
    totalPaidInterest: roundCurrency(totals.totalPaidInterest),
    totalPaid: roundCurrency(totals.totalPaid),
    outstandingPrincipal: roundCurrency(totals.outstandingPrincipal),
    outstandingInterest: roundCurrency(totals.outstandingInterest),
    outstandingBalance: roundCurrency(totals.outstandingPrincipal + totals.outstandingInterest),
    outstandingInstallments: schedule.filter((row) => row.status !== 'paid').length,
    nextInstallment: nextInstallment ? {
      installmentNumber: nextInstallment.installmentNumber,
      dueDate: nextInstallment.dueDate,
      scheduledPayment: roundCurrency(nextInstallment.scheduledPayment),
      remainingPrincipal: roundCurrency(nextInstallment.remainingPrincipal),
      remainingInterest: roundCurrency(nextInstallment.remainingInterest),
    } : null,
  };
};

const cloneSchedule = (schedule = []) => JSON.parse(JSON.stringify(schedule));

module.exports = {
  roundCurrency,
  calculateInstallmentAmount,
  buildAmortizationSchedule,
  summarizeSchedule,
  cloneSchedule,
};
