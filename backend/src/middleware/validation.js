const { ValidationError } = require('../utils/errorHandler');
const { UNSUPPORTED_LATE_FEE_MODES, normalizeLateFeeMode } = require('../services/creditSimulationService');

const buildValidationError = (errors, message = 'Please correct the following errors') => {
  const error = new ValidationError(message);
  error.errors = errors;
  return error;
};

/**
 * Adapt a schema validator into Express middleware that raises backend validation errors.
 * @param {{ validate: Function }} schema
 * @returns {import('express').RequestHandler}
 */
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

/**
 * Validate a basic email address shape.
 * @param {string} email
 * @returns {boolean}
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate an E.164-like phone number payload.
 * @param {string} phone
 * @returns {boolean}
 */
const validatePhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate positive monetary amounts.
 * @param {number} amount
 * @returns {boolean}
 */
const validateAmount = (amount) => {
  return typeof amount === 'number' && amount > 0;
};

/**
 * Validate percentage rates accepted by the credit domain.
 * @param {number} rate
 * @returns {boolean}
 */
const validateInterestRate = (rate) => {
  return typeof rate === 'number' && rate >= 0 && rate <= 100;
};

/**
 * Validate supported loan terms in months.
 * @param {number} term
 * @returns {boolean}
 */
const validateTermMonths = (term) => {
  return Number.isInteger(term) && term > 0 && term <= 360;
};

/**
 * Validate positive integer identifiers received in route params or bodies.
 * @param {string|number} value
 * @returns {boolean}
 */
const validateIntegerId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const hasDecimalPrecision = (value, maxDecimals) => {
  const stringValue = typeof value === 'string' ? value.trim() : String(value);
  return /^\d+(\.\d+)?$/.test(stringValue)
    && ((stringValue.split('.')[1] || '').length <= maxDecimals);
};

const validateCurrencyPrecision = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return false;
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
    return false;
  }

  return (normalizedValue.split('.')[1] || '').length <= 2;
};

const validateParticipationPercentage = (value) => {
  if (value === undefined || value === null || value === '') {
    return true;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    && numericValue >= 0
    && numericValue <= 100
    && hasDecimalPrecision(value, 4);
};

const pushParticipationPercentageError = (errors, field = 'participationPercentage') => {
  errors.push({
    field,
    message: 'participationPercentage must be between 0 and 100 with up to 4 decimal places',
  });
};

const validateOptionalDateInput = (value) => {
  if (value === undefined || value === null || value === '') {
    return true;
  }

  return !Number.isNaN(new Date(value).getTime());
};

const validateIdempotencyKey = (value) => {
  if (value === undefined || value === null || value === '') {
    return true;
  }

  return typeof value === 'string'
    && value.trim().length >= 8
    && value.trim().length <= 160;
};

/**
 * Reject late-fee modes that the canonical credit simulator does not support.
 * @param {string|undefined|null} lateFeeMode
 * @param {Array<object>} errors
 * @param {string} [field='lateFeeMode']
 */
const rejectUnsupportedLateFeeMode = (lateFeeMode, errors, field = 'lateFeeMode') => {
  const normalizedMode = normalizeLateFeeMode(lateFeeMode);

  if (UNSUPPORTED_LATE_FEE_MODES.has(normalizedMode)) {
    errors.push({
      field,
      message: `Late fee mode must not be one of: ${Array.from(UNSUPPORTED_LATE_FEE_MODES).join(', ')}`,
    });
  }
};

const authValidation = {
  /** @type {import('express').RequestHandler} */
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

  /** @type {import('express').RequestHandler} */
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
  /** @type {import('express').RequestHandler} */
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

  /** @type {import('express').RequestHandler} */
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

  /** @type {import('express').RequestHandler} */
  updateStatus: (req, res, next) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'approved', 'rejected', 'active', 'closed', 'defaulted'];
    
    if (!validStatuses.includes(status)) {
      const error = new ValidationError('Invalid loan status');
      error.errors = [{ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` }];
      return next(error);
    }

    next();
  },

  /** @type {import('express').RequestHandler} */
  payoffQuote: (req, res, next) => {
    const errors = [];
    const { asOfDate } = req.query;

    if (!validateIntegerId(req.params.id)) {
      errors.push({ field: 'id', message: 'Valid loan ID is required' });
    }

    const parsedDate = new Date(`${String(asOfDate || '').trim()}T00:00:00.000Z`);
    if (!asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate)) || Number.isNaN(parsedDate.getTime())) {
      errors.push({ field: 'asOfDate', message: 'asOfDate must be a valid YYYY-MM-DD date' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },

  /** @type {import('express').RequestHandler} */
  payoffExecute: (req, res, next) => {
    const errors = [];
    const { asOfDate, quotedTotal } = req.body;

    if (!validateIntegerId(req.params.id)) {
      errors.push({ field: 'id', message: 'Valid loan ID is required' });
    }

    const parsedDate = new Date(`${String(asOfDate || '').trim()}T00:00:00.000Z`);
    if (!asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate)) || Number.isNaN(parsedDate.getTime())) {
      errors.push({ field: 'asOfDate', message: 'asOfDate must be a valid YYYY-MM-DD date' });
    }

    if (!validateAmount(Number(quotedTotal))) {
      errors.push({ field: 'quotedTotal', message: 'quotedTotal must be a positive number' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  }
};

const paymentValidation = {
  /** @type {import('express').RequestHandler} */
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
  /** @type {import('express').RequestHandler} */
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
  /** @type {import('express').RequestHandler} */
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
  },

  /** @type {import('express').RequestHandler} */
  payoffQuote: (req, res, next) => {
    const errors = [];
    const { asOfDate } = req.query;

    if (!validateIntegerId(req.params.id)) {
      errors.push({ field: 'id', message: 'Valid loan ID is required' });
    }

    const parsedDate = new Date(`${String(asOfDate || '').trim()}T00:00:00.000Z`);
    if (!asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate)) || Number.isNaN(parsedDate.getTime())) {
      errors.push({ field: 'asOfDate', message: 'asOfDate must be a valid YYYY-MM-DD date' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },

  /** @type {import('express').RequestHandler} */
  payoffExecute: (req, res, next) => {
    const errors = [];
    const { asOfDate, quotedTotal } = req.body;

    if (!validateIntegerId(req.params.id)) {
      errors.push({ field: 'id', message: 'Valid loan ID is required' });
    }

    const parsedDate = new Date(`${String(asOfDate || '').trim()}T00:00:00.000Z`);
    if (!asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate)) || Number.isNaN(parsedDate.getTime())) {
      errors.push({ field: 'asOfDate', message: 'asOfDate must be a valid YYYY-MM-DD date' });
    }

    if (!validateAmount(Number(quotedTotal))) {
      errors.push({ field: 'quotedTotal', message: 'quotedTotal must be a positive number' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  }
};

const associateValidation = {
  /** @type {import('express').RequestHandler} */
  create: (req, res, next) => {
    const {
      name,
      email,
      phone,
      status,
      participationPercentage,
    } = req.body;
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

    if (req.user?.role !== 'admin' && Object.prototype.hasOwnProperty.call(req.body, 'participationPercentage')) {
      errors.push({ field: 'participationPercentage', message: 'Only admins can set participationPercentage' });
    } else if (!validateParticipationPercentage(participationPercentage)) {
      pushParticipationPercentageError(errors);
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },

  /** @type {import('express').RequestHandler} */
  update: (req, res, next) => {
    const {
      name,
      email,
      phone,
      status,
      participationPercentage,
    } = req.body;
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

    if (req.user?.role !== 'admin' && Object.prototype.hasOwnProperty.call(req.body, 'participationPercentage')) {
      errors.push({ field: 'participationPercentage', message: 'Only admins can set participationPercentage' });
    } else if (!validateParticipationPercentage(participationPercentage)) {
      pushParticipationPercentageError(errors);
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },
  /** @type {import('express').RequestHandler} */
  proportionalDistribution: (req, res, next) => {
    const { amount, distributionDate, basis, idempotencyKey } = req.body;
    const errors = [];
    const headerIdempotencyKey = req.headers['idempotency-key'];
    const effectiveIdempotencyKey = typeof headerIdempotencyKey === 'string' && headerIdempotencyKey.trim()
      ? headerIdempotencyKey
      : idempotencyKey;

    if (!validateAmount(Number(amount)) || !validateCurrencyPrecision(amount)) {
      errors.push({ field: 'amount', message: 'Amount must be a positive number with up to 2 decimal places' });
    }

    if (!validateOptionalDateInput(distributionDate)) {
      errors.push({ field: 'distributionDate', message: 'distributionDate must be a valid date when provided' });
    }

    if (basis !== undefined && (typeof basis !== 'object' || basis === null || Array.isArray(basis))) {
      errors.push({ field: 'basis', message: 'basis must be an object when provided' });
    }

    if (!validateIdempotencyKey(effectiveIdempotencyKey)) {
      errors.push({ field: 'idempotencyKey', message: 'Idempotency key must be between 8 and 160 characters when provided' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },
};

const PUSH_PROVIDER_CHANNELS = {
  webpush: 'web',
  fcm: 'mobile',
  apns: 'mobile',
};

const PUSH_PROVIDER_KEYS = new Set(Object.keys(PUSH_PROVIDER_CHANNELS));
const PUSH_CHANNELS = new Set(['web', 'mobile']);

const notificationValidation = {
  /** @type {import('express').RequestHandler} */
  registerSubscription: (req, res, next) => {
    const {
      providerKey,
      channel,
      endpoint,
      deviceToken,
      subscription,
    } = req.body;
    const errors = [];

    if (!PUSH_PROVIDER_KEYS.has(providerKey)) {
      errors.push({ field: 'providerKey', message: 'Provider key must be one of: webpush, fcm, apns' });
    }

    if (!PUSH_CHANNELS.has(channel)) {
      errors.push({ field: 'channel', message: 'Channel must be one of: web, mobile' });
    }

    if (PUSH_PROVIDER_KEYS.has(providerKey) && PUSH_CHANNELS.has(channel)) {
      const expectedChannel = PUSH_PROVIDER_CHANNELS[providerKey];
      if (expectedChannel !== channel) {
        errors.push({
          field: 'channel',
          message: `${providerKey} subscriptions must use the ${expectedChannel} channel`,
        });
      }
    }

    if (!endpoint && !deviceToken) {
      errors.push({ field: 'endpoint', message: 'Endpoint or deviceToken is required' });
    }

    if (channel === 'web') {
      if (!endpoint) {
        errors.push({ field: 'endpoint', message: 'Web subscriptions require an endpoint' });
      }

      if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) {
        errors.push({ field: 'subscription', message: 'Web subscriptions require a subscription object' });
      }
    }

    if (channel === 'mobile' && !deviceToken) {
      errors.push({ field: 'deviceToken', message: 'Mobile subscriptions require a deviceToken' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },
  /** @type {import('express').RequestHandler} */
  deleteSubscription: (req, res, next) => {
    const { providerKey, endpoint, deviceToken } = req.body;
    const errors = [];

    if (!PUSH_PROVIDER_KEYS.has(providerKey)) {
      errors.push({ field: 'providerKey', message: 'Provider key must be one of: webpush, fcm, apns' });
    }

    if (!endpoint && !deviceToken) {
      errors.push({ field: 'endpoint', message: 'Endpoint or deviceToken is required' });
    }

    if (providerKey === 'webpush' && !endpoint) {
      errors.push({ field: 'endpoint', message: 'webpush subscriptions require an endpoint identifier' });
    }

    if ((providerKey === 'fcm' || providerKey === 'apns') && !deviceToken) {
      errors.push({ field: 'deviceToken', message: `${providerKey} subscriptions require a deviceToken identifier` });
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
  notificationValidation,
};
