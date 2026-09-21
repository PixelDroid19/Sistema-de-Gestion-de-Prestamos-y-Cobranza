const { validateInterestRate } = require('@/modules/shared/validators');

// Match Loan.interestRate's DECIMAL(7,4) scale before calculating or snapshotting:
// PostgreSQL rounding must never change the rate used by later payment operations.
const validateAgreedInterestRate = (value) => validateInterestRate(value)
  && (String(value).trim().split('.')[1]?.length || 0) <= 4;

const AGREED_RATE_VALIDATION_MESSAGE = 'La tasa pactada anual debe estar entre 0 y 100, con máximo 4 decimales';

module.exports = { validateAgreedInterestRate, AGREED_RATE_VALIDATION_MESSAGE };
