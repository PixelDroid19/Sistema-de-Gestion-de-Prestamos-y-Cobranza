const { roundCurrency } = require('./dag/precision');
const {
  assertSupportedCalculationMethod,
  normalizeCalculationMethod,
} = require('./dag/calculationMethods');

const addMonths = (date, months) => {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
};

const resolveScheduleStartDate = (startDate) => {
  if (startDate === undefined || startDate === null || startDate === '') {
    return new Date();
  }

  const parsedDate = new Date(startDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return new Date();
  }

  return parsedDate;
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

const buildLevelTotalSchedule = ({ amount, totalInterest, termMonths, startDate }) => {
  const principal = roundCurrency(amount);
  const interestTotal = roundCurrency(Math.max(0, Number(totalInterest) || 0));
  const term = Number(termMonths);
  const schedule = [];
  const scheduleStartDate = resolveScheduleStartDate(startDate);
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
      dueDate: addMonths(scheduleStartDate, month).toISOString(),
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
 * Create canonical amortization rows for a loan.
 * @param {{ amount: number, interestRate: number, termMonths: number, startDate?: Date|string }} input
 * @returns {Array<object>}
 */
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
    const scheduleStartDate = resolveScheduleStartDate(startDate);
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
        dueDate: addMonths(scheduleStartDate, month).toISOString(),
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

/**
 * Calculate late fee based on the specified mode.
 *
 * Modes:
 * - SIMPLE: Daily percentage on overdue amount
 *   Formula: overdueAmount * (annualRate / 100) * (daysOverdue / 365)
 * - FLAT: Fixed amount per day
 *   Formula: flatFeePerDay * daysOverdue
 * - TIERED: Escalated rates over time
 *   Tier 1 (days 1-30): base rate
 *   Tier 2 (days 31-60): 1.5x base rate
 *   Tier 3 (days 61+): 2x base rate
 *
 * @param {{
 *   overdueAmount: number,
 *   daysOverdue: number,
 *   feeMode: 'SIMPLE' | 'FLAT' | 'TIERED',
 *   annualRate?: number,
 *   flatFeePerDay?: number,
 *   baseRate?: number
 * }} input
 * @returns {number}
 */
const calculateLateFee = ({
  overdueAmount,
  daysOverdue,
  feeMode,
  annualRate = 0,
  flatFeePerDay = 0,
  baseRate = 0,
}) => {
  const principal = Number(overdueAmount) || 0;
  const days = Number(daysOverdue) || 0;

  if (principal <= 0 || days <= 0) {
    return roundCurrency(0);
  }

  switch (String(feeMode).toUpperCase()) {
    case 'SIMPLE': {
      // Daily percentage on overdue amount
      // Formula: overdueAmount * (annualRate / 100) * (daysOverdue / 365)
      const annualDecimalRate = Number(annualRate) / 100;
      const dailyRate = annualDecimalRate / 365;
      const fee = principal * dailyRate * days;
      return roundCurrency(fee);
    }

    case 'COMPOUND': {
      // Compound daily rate: principal * (1 + dailyRate)^daysOverdue - principal
      const annualDecimalRate = Number(annualRate) / 100;
      const dailyRate = annualDecimalRate / 365;
      const fee = principal * (Math.pow(1 + dailyRate, days) - 1);
      return roundCurrency(fee);
    }

    case 'FLAT': {
      // Fixed amount per day
      // Formula: flatFeePerDay * daysOverdue
      const dailyFee = Number(flatFeePerDay) || 0;
      const fee = dailyFee * days;
      return roundCurrency(fee);
    }

    case 'TIERED': {
      // Escalated rates over time — fees accumulate per tier bracket.
      // Tier 1 (days 1-30):  1x   base rate
      // Tier 2 (days 31-60): 1.5x base rate
      // Tier 3 (days 61+):   2x   base rate
      const baseDailyRate = (Number(baseRate) || 0) / 100 / 365;

      let fee = 0;

      // Tier 1: first 30 days at 1x base rate
      const tier1Days = Math.min(days, 30);
      fee += principal * baseDailyRate * tier1Days;

      // Tier 2: days 31-60 at 1.5x base rate
      if (days > 30) {
        const tier2Days = Math.min(days - 30, 30);
        fee += principal * (baseDailyRate * 1.5) * tier2Days;
      }

      // Tier 3: days 61+ at 2x base rate
      if (days > 60) {
        const tier3Days = days - 60;
        fee += principal * (baseDailyRate * 2) * tier3Days;
      }

      return roundCurrency(fee);
    }

    default:
      return roundCurrency(0);
  }
};

module.exports = {
  roundCurrency,
  calculateInstallmentAmount,
  buildAmortizationSchedule,
  summarizeSchedule,
  cloneSchedule,
  calculateLateFee,
  normalizeCalculationMethod,
  assertSupportedCalculationMethod,
};
