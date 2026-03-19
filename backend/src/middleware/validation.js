const { ValidationError } = require('../utils/errorHandler');
const { UNSUPPORTED_LATE_FEE_MODES, normalizeLateFeeMode } = require('../services/creditSimulationService');

const buildValidationError = (errors, message = 'Please correct the following errors') => {
  const error = new ValidationError(message);
  error.errors = errors;
  return error;
};

// Generic validation function
const validate = (schema) => {
  return (req, res, next) => {
    try {
      const { error } = schema.validate(req.body, { abortEarly: false });
      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));
        throw new ValidationError('Validation failed', validationErrors);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

// Custom validation functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone);
};

const validateAmount = (amount) => {
  return typeof amount === 'number' && amount > 0;
};

const validateInterestRate = (rate) => {
  return typeof rate === 'number' && rate >= 0 && rate <= 100;
};

const validateTermMonths = (term) => {
  return Number.isInteger(term) && term > 0 && term <= 360; // Max 30 years
};

const validateIntegerId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const rejectUnsupportedLateFeeMode = (lateFeeMode, errors, field = 'lateFeeMode') => {
  const normalizedMode = normalizeLateFeeMode(lateFeeMode);

  if (UNSUPPORTED_LATE_FEE_MODES.has(normalizedMode)) {
    errors.push({
      field,
      message: `Late fee mode must not be one of: ${Array.from(UNSUPPORTED_LATE_FEE_MODES).join(', ')}`,
    });
  }
};

// Validation schemas (using simple validation for now, can be replaced with Joi)
const authValidation = {
  register: (req, res, next) => {
    const { name, email, password, role, phone } = req.body;
    const errors = [];

    if (!name || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
    }

    if (!email) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!validateEmail(email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email format (e.g., user@example.com)' });
    }

    if (!password) {
      errors.push({ field: 'password', message: 'Password is required' });
    } else if (password.length < 6) {
      const remaining = 6 - password.length;
      errors.push({ 
        field: 'password', 
        message: `Password must be at least 6 characters long. Please add ${remaining} more character${remaining > 1 ? 's' : ''}.` 
      });
    }

    if (role !== 'customer') {
      errors.push({ field: 'role', message: 'Public registration only allows the customer role' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },

  login: (req, res, next) => {
    const { email, password } = req.body;
    const errors = [];

    if (!email) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!validateEmail(email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email format (e.g., user@example.com)' });
    }

    if (!password) {
      errors.push({ field: 'password', message: 'Password is required' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  }
};

const loanValidation = {
  create: (req, res, next) => {
    const { customerId, associateId, amount, interestRate, termMonths, lateFeeMode } = req.body;
    const errors = [];

    if (!validateIntegerId(customerId)) {
      errors.push({ field: 'customerId', message: 'Valid customer ID is required' });
    }

    if (associateId !== undefined && associateId !== null && !validateIntegerId(associateId)) {
      errors.push({ field: 'associateId', message: 'Associate ID must be a positive integer when provided' });
    }

    if (!validateAmount(amount)) {
      errors.push({ field: 'amount', message: 'Amount must be a positive number' });
    }

    if (!validateInterestRate(interestRate)) {
      errors.push({ field: 'interestRate', message: 'Interest rate must be between 0 and 100' });
    }

    if (!validateTermMonths(termMonths)) {
      errors.push({ field: 'termMonths', message: 'Term must be between 1 and 360 months' });
    }

    rejectUnsupportedLateFeeMode(lateFeeMode, errors);

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },

  simulate: (req, res, next) => {
    const { amount, interestRate, termMonths, lateFeeMode } = req.body;
    const errors = [];

    if (!validateAmount(amount)) {
      errors.push({ field: 'amount', message: 'Amount must be a positive number' });
    }

    if (!validateInterestRate(interestRate)) {
      errors.push({ field: 'interestRate', message: 'Interest rate must be between 0 and 100' });
    }

    if (!validateTermMonths(termMonths)) {
      errors.push({ field: 'termMonths', message: 'Term must be between 1 and 360 months' });
    }

    rejectUnsupportedLateFeeMode(lateFeeMode, errors);

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },

  updateStatus: (req, res, next) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'approved', 'rejected', 'active', 'closed', 'defaulted'];
    
    if (!validStatuses.includes(status)) {
      const error = new ValidationError('Invalid loan status');
      error.errors = [{ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` }];
      return next(error);
    }

    next();
  }
};

const paymentValidation = {
  create: (req, res, next) => {
    const { amount, loanId, lateFeeMode } = req.body;
    const errors = [];

    if (!validateAmount(amount)) {
      errors.push({ field: 'amount', message: 'Amount must be a positive number' });
    }

    if (!loanId || !Number.isInteger(Number(loanId))) {
      errors.push({ field: 'loanId', message: 'Valid loan ID is required' });
    }

    rejectUnsupportedLateFeeMode(lateFeeMode, errors);

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  }
};

const customerValidation = {
  create: (req, res, next) => {
    const { name, email, phone } = req.body;
    const errors = [];

    if (!name || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
    }

    if (!email) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!validateEmail(email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email format (e.g., user@example.com)' });
    }

    if (!phone || !validatePhone(phone)) {
      errors.push({ field: 'phone', message: 'Valid phone number is required' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  }
};

const agentValidation = {
  create: (req, res, next) => {
    const { name, email, phone } = req.body;
    const errors = [];

    if (!name || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
    }

    if (!email) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!validateEmail(email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email format (e.g., user@example.com)' });
    }

    if (!phone || !validatePhone(phone)) {
      errors.push({ field: 'phone', message: 'Valid phone number is required' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  }
};

const associateValidation = {
  create: (req, res, next) => {
    const { name, email, phone, status } = req.body;
    const errors = [];

    if (!name || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
    }

    if (!email) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!validateEmail(email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email format (e.g., user@example.com)' });
    }

    if (!phone || !validatePhone(phone)) {
      errors.push({ field: 'phone', message: 'Valid phone number is required' });
    }

    if (status && !['active', 'inactive'].includes(status)) {
      errors.push({ field: 'status', message: 'Status must be active or inactive' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },

  update: (req, res, next) => {
    const { name, email, phone, status } = req.body;
    const errors = [];

    if (name !== undefined && name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
    }

    if (email !== undefined && !validateEmail(email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email format (e.g., user@example.com)' });
    }

    if (phone !== undefined && !validatePhone(phone)) {
      errors.push({ field: 'phone', message: 'Valid phone number is required' });
    }

    if (status !== undefined && !['active', 'inactive'].includes(status)) {
      errors.push({ field: 'status', message: 'Status must be active or inactive' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },
};

module.exports = {
  validate,
  validateEmail,
  validatePhone,
  validateAmount,
  validateInterestRate,
  validateTermMonths,
  authValidation,
  loanValidation,
  paymentValidation,
  customerValidation,
  agentValidation,
  associateValidation,
};
