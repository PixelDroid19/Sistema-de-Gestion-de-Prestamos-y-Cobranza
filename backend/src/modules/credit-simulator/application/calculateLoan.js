const { CalculationEngine } = require('../../../core/domain/calculation/CalculationEngine');
const { scopeToPlainObject } = require('../../../core/domain/calculation/scopeBuilder');

/**
 * Calculate loan using the DAG calculation engine.
 * Supports both French (compound) and simple interest methods.
 * @param {{ principal: number, term: number, interestRate: number, paymentMethod: string }} input
 * @returns {{ monthlyPayment: number, totalInterest: number, totalPayment: number, schedule: Array }}
 */
const calculateLoan = (input) => {
  const { principal, term, interestRate, paymentMethod } = input;

  // Validate inputs
  if (!principal || principal <= 0) {
    throw new Error('Principal must be a positive number');
  }
  if (!term || term <= 0) {
    throw new Error('Term must be a positive number');
  }
  if (interestRate === undefined || interestRate < 0) {
    throw new Error('Interest rate must be non-negative');
  }

  const monthlyRate = interestRate / 100 / 12;
  let monthlyPayment;
  let totalPayment;

  if (paymentMethod === 'french' || paymentMethod === 'frances') {
    // French (compound) method: equal payments
    if (monthlyRate === 0) {
      monthlyPayment = principal / term;
      totalPayment = principal;
    } else {
      // PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
      const factor = Math.pow(1 + monthlyRate, term);
      monthlyPayment = principal * (monthlyRate * factor) / (factor - 1);
      totalPayment = monthlyPayment * term;
    }
  } else {
    // Simple/Direct method: interest calculated on original principal
    const totalInterest = principal * monthlyRate * term;
    monthlyPayment = (principal + totalInterest) / term;
    totalPayment = principal + totalInterest;
  }

  const totalInterest = totalPayment - principal;

  // Build amortization schedule
  const schedule = buildAmortizationSchedule({
    principal,
    term,
    interestRate,
    monthlyRate,
    monthlyPayment,
    paymentMethod,
  });

  return {
    monthlyPayment: roundCurrency(monthlyPayment),
    totalInterest: roundCurrency(totalInterest),
    totalPayment: roundCurrency(totalPayment),
    principal: roundCurrency(principal),
    term,
    interestRate,
    paymentMethod,
    schedule,
  };
};

/**
 * Build amortization schedule
 * @param {object} params
 * @returns {Array} schedule entries
 */
const buildAmortizationSchedule = ({ principal, term, interestRate, monthlyRate, monthlyPayment, paymentMethod }) => {
  const schedule = [];
  let balance = principal;
  let totalPrincipalPaid = 0;
  let totalInterestPaid = 0;

  for (let period = 1; period <= term; period++) {
    let interestPayment;
    let principalPayment;

    if (paymentMethod === 'french' || paymentMethod === 'frances') {
      // French method: interest on remaining balance
      interestPayment = balance * monthlyRate;
      principalPayment = monthlyPayment - interestPayment;
    } else {
      // Simple method: interest on original principal
      interestPayment = principal * monthlyRate;
      principalPayment = principal / term;
    }

    // Handle final period rounding
    if (period === term) {
      principalPayment = balance;
      monthlyPayment = principalPayment + interestPayment;
    }

    balance -= principalPayment;
    if (balance < 0) balance = 0;

    totalPrincipalPaid += principalPayment;
    totalInterestPaid += interestPayment;

    schedule.push({
      period,
      payment: roundCurrency(monthlyPayment),
      principal: roundCurrency(principalPayment),
      interest: roundCurrency(interestPayment),
      balance: roundCurrency(balance),
    });
  }

  return schedule;
};

/**
 * Round to 2 decimal places
 * @param {number} value
 * @returns {number}
 */
const roundCurrency = (value) => {
  return Math.round(value * 100) / 100;
};

/**
 * Create the calculate loan use case
 * @param {object} dependencies
 * @returns {object} use case
 */
const createCalculateLoanUseCase = ({ calculationEngine } = {}) => ({
  execute(input) {
    // Use DAG calculation engine if available and configured for advanced calculations
    if (calculationEngine && input.useDAGEngine) {
      return calculationEngine.calculateAmortization({
        principal: input.principal,
        interestRate: input.interestRate / 100,
        term: input.term,
        paymentAmount: null,
      });
    }

    // Default: use the standard calculation
    return calculateLoan(input);
  },
});

module.exports = {
  calculateLoan,
  buildAmortizationSchedule,
  createCalculateLoanUseCase,
};
