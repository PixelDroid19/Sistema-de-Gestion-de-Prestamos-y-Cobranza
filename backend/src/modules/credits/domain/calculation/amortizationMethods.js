const { roundCurrency } = require('./precision');
const {
  assertSupportedCalculationMethod,
  normalizeCalculationMethod,
} = require('./calculationMethods');

const parseUtcDateOnly = (value) => {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(String(value || '').trim());
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
};

const addMonths = (date, months) => {
  const source = parseUtcDateOnly(date) || new Date(date);
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth() + Number(months);
  const day = source.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfTargetMonth)));
};

const resolveFirstPaymentDate = (startDate) => {
  if (startDate === undefined || startDate === null || startDate === '') {
    return addMonths(new Date(), 1);
  }

  const parsedDate = parseUtcDateOnly(startDate) || new Date(startDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return addMonths(new Date(), 1);
  }

  return parsedDate;
};

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

  const installment = (principal * monthlyRate * Math.pow(1 + monthlyRate, term))
    / (Math.pow(1 + monthlyRate, term) - 1);

  return roundCurrency(installment);
};

const buildLevelTotalSchedule = ({ amount, totalInterest, termMonths, startDate }) => {
  const principal = roundCurrency(amount);
  const interestTotal = roundCurrency(Math.max(0, Number(totalInterest) || 0));
  const term = Number(termMonths);
  const schedule = [];
  const firstPaymentDate = resolveFirstPaymentDate(startDate);
  const basePrincipal = term > 0 ? roundCurrency(principal / term) : 0;
  const baseInterest = term > 0 ? roundCurrency(interestTotal / term) : 0;
  let balance = principal;
  let allocatedInterest = 0;

  for (let month = 1; month <= term; month += 1) {
    const openingBalance = balance;
    const principalComponent = month === term
      ? roundCurrency(openingBalance)
      : roundCurrency(Math.min(openingBalance, basePrincipal));
    const interestComponent = month === term
      ? roundCurrency(Math.max(0, interestTotal - allocatedInterest))
      : baseInterest;
    const scheduledPayment = roundCurrency(principalComponent + interestComponent);
    allocatedInterest = roundCurrency(allocatedInterest + interestComponent);
    balance = roundCurrency(Math.max(0, openingBalance - principalComponent));

    schedule.push({
      installmentNumber: month,
      dueDate: addMonths(firstPaymentDate, month - 1).toISOString(),
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

const buildAmortizationSchedule = ({ amount, interestRate, termMonths, startDate, lateFeeMode: _lateFeeMode, installmentAmount, calculationMethod }) => {
  const method = assertSupportedCalculationMethod(calculationMethod);
  const principal = Number(amount);
  const term = Number(termMonths);
  const annualRate = Number(interestRate) / 100;
  const monthlyRate = annualRate / 12;
  const customInstallmentAmount = Number(installmentAmount);
  const hasCustomInstallmentAmount = Number.isFinite(customInstallmentAmount) && customInstallmentAmount > 0;

  if (!term || term <= 0) {
    return [];
  }

  const buildFixedInstallmentSchedule = (resolvedInstallmentAmount) => {
    const schedule = [];
    const firstPaymentDate = resolveFirstPaymentDate(startDate);
    let balance = roundCurrency(amount);

    for (let month = 1; month <= term; month += 1) {
      const openingBalance = balance;
      const interestComponent = monthlyRate === 0
        ? 0
        : roundCurrency(openingBalance * monthlyRate);
      const principalComponent = month === term
        ? roundCurrency(openingBalance)
        : roundCurrency(Math.max(0, Math.min(openingBalance, resolvedInstallmentAmount - interestComponent)));
      const scheduledPayment = roundCurrency(principalComponent + interestComponent);
      balance = roundCurrency(Math.max(0, openingBalance - principalComponent));

      schedule.push({
        installmentNumber: month,
        dueDate: addMonths(firstPaymentDate, month - 1).toISOString(),
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

  if (hasCustomInstallmentAmount) {
    return buildFixedInstallmentSchedule(roundCurrency(customInstallmentAmount));
  }

  if (method === 'SIMPLE') {
    const totalInterest = roundCurrency(principal * annualRate * (term / 12));
    return buildLevelTotalSchedule({ amount, totalInterest, termMonths, startDate });
  }

  if (method === 'COMPOUND') {
    const totalInterest = roundCurrency(principal * (Math.pow(1 + monthlyRate, term) - 1));
    return buildLevelTotalSchedule({ amount, totalInterest, termMonths, startDate });
  }

  return buildFixedInstallmentSchedule(calculateInstallmentAmount({ amount, interestRate, termMonths }));
};

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
  addMonths,
  resolveFirstPaymentDate,
  calculateInstallmentAmount,
  buildAmortizationSchedule,
  summarizeSchedule,
  cloneSchedule,
  normalizeCalculationMethod,
  assertSupportedCalculationMethod,
};
