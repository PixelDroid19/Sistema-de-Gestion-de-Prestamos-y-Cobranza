const { ValidationError } = require('@/utils/errorHandler');
const { UNSUPPORTED_LATE_FEE_MODES, normalizeLateFeeMode } = require('@/modules/credits/domain/calculation');
const { parsePaginationQuery } = require('@/modules/shared/pagination');
const { ADMINISTRATIVE_LOGIN_ROLES, isAdministrativeLoginRole, normalizeApplicationRole } = require('@/modules/shared/roles');
const { validateCurrencyPrecision } = require('@/modules/shared/money');
const {
  validateEmail,
  validatePhone,
  validateAmount,
  validateInterestRate,
  validateTermMonths,
  validateIntegerId,
  validateOptionalDateInput,
  validateIdempotencyKey,
  validateIntegerRange,
  validateParticipationPercentage,
  validateAssociateInterestRate,
} = require('@/modules/shared/validators');
const { isValidDateOnly } = require('@/modules/shared/dateUtils');

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

const usesPolicySource = (value) => String(value || '').trim().toLowerCase() === 'policy';


const pushParticipationPercentageError = (errors, field = 'participationPercentage') => {
  errors.push({
    field,
    message: 'participationPercentage must be between 0 and 100 with up to 4 decimal places',
  });
};

const pushNameValidation = ({ errors, name, required }) => {
  if (required && (!name || String(name).trim().length < 2)) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
    return;
  }

  if (!required && name !== undefined && String(name).trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
  }
};

const pushEmailValidation = ({ errors, email, required }) => {
  if (required && !email) {
    errors.push({ field: 'email', message: 'Email is required' });
    return;
  }

  if (email !== undefined && email !== null && email !== '' && !validateEmail(email)) {
    errors.push({ field: 'email', message: 'Please enter a valid email format (e.g., user@example.com)' });
  }
};

const pushPhoneValidation = ({ errors, phone, required }) => {
  if (required && (!phone || !validatePhone(phone))) {
    errors.push({ field: 'phone', message: 'Valid phone number is required' });
    return;
  }

  if (!required && phone !== undefined && !validatePhone(phone)) {
    errors.push({ field: 'phone', message: 'Valid phone number is required' });
  }
};

const pushActiveInactiveStatusValidation = ({ errors, status }) => {
  if (status !== undefined && !['active', 'inactive'].includes(status)) {
    errors.push({ field: 'status', message: 'Status must be active or inactive' });
  }
};

const pushCustomerStatusValidation = ({ errors, status }) => {
  if (status !== undefined && !['active', 'inactive', 'blacklisted'].includes(status)) {
    errors.push({ field: 'status', message: 'Status must be active, inactive, or blacklisted' });
  }
};

const pushParticipationValidation = ({ req, errors, participationPercentage }) => {
  if (req.user?.role !== 'admin' && Object.prototype.hasOwnProperty.call(req.body, 'participationPercentage')) {
    errors.push({ field: 'participationPercentage', message: 'Only admins can set participationPercentage' });
  } else if (!validateParticipationPercentage(participationPercentage)) {
    pushParticipationPercentageError(errors);
  }
};

const pushAssociateFinancialTermsValidation = ({ errors, interestType, interestRate, interestPaymentDay, interestPaymentMonth, initialCapital, interestStartDate, interestStartsAt }) => {
  if (interestType !== undefined && !['monthly', 'annual'].includes(String(interestType).trim().toLowerCase())) {
    errors.push({ field: 'interestType', message: 'interestType must be monthly or annual' });
  }

  if (!validateAssociateInterestRate(interestRate)) {
    errors.push({ field: 'interestRate', message: 'interestRate must be between 0 and 100 with up to 4 decimal places' });
  }

  if (!validateIntegerRange(interestPaymentDay, 1, 28)) {
    errors.push({ field: 'interestPaymentDay', message: 'interestPaymentDay must be an integer between 1 and 28' });
  }

  if (!validateIntegerRange(interestPaymentMonth, 1, 12)) {
    errors.push({ field: 'interestPaymentMonth', message: 'interestPaymentMonth must be an integer between 1 and 12' });
  }

  if (initialCapital !== undefined && (!validateAmount(Number(initialCapital)) || !validateCurrencyPrecision(initialCapital))) {
    errors.push({ field: 'initialCapital', message: 'initialCapital must be a positive number with up to 2 decimal places' });
  }

  const effectiveStartDate = interestStartsAt ?? interestStartDate;
  if (!validateOptionalDateInput(effectiveStartDate)) {
    errors.push({ field: 'interestStartDate', message: 'interestStartDate must be a valid date' });
  }
};

const attachPagination = ({ defaultPage, defaultPageSize, maxPageSize } = {}) => (req, _res, next) => {
  try {
    req.pagination = parsePaginationQuery(req.query, { defaultPage, defaultPageSize, maxPageSize });
    next();
  } catch (error) {
    next(error);
  }
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
    const { name, email, password, phone } = req.body;
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
    } else if (password.length < 8) {
      errors.push({ 
        field: 'password', 
        message: 'Password must be at least 8 characters long and include uppercase, lowercase, and numeric characters.' 
      });
    }

    errors.push({ field: 'role', message: 'Public registration is disabled. An administrator must create employee accounts.' });

    if (phone && !validatePhone(phone)) {
      errors.push({ field: 'phone', message: 'Please enter a valid phone number' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },

  /** @type {import('express').RequestHandler} */
  adminRegister: (req, res, next) => {
    const { name, email, password, role, phone, associateId } = req.body;
    const errors = [];
    const normalizedRole = normalizeApplicationRole(role);

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
    } else if (password.length < 8) {
      errors.push({
        field: 'password',
        message: 'Password must be at least 8 characters long and include uppercase, lowercase, and numeric characters.',
      });
    }

    if (!normalizedRole || !isAdministrativeLoginRole(normalizedRole)) {
      errors.push({ field: 'role', message: `Role must be one of: ${ADMINISTRATIVE_LOGIN_ROLES.join(', ')}` });
    }

    if (normalizedRole === 'socio' && (!phone || !validatePhone(phone))) {
      errors.push({ field: 'phone', message: 'Valid phone number is required for socio registration' });
    }

    if (normalizedRole === 'socio' && !validateIntegerId(associateId)) {
      errors.push({ field: 'associateId', message: 'Valid associateId is required for socio registration' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },

  /** @type {import('express').RequestHandler} */
  login: (req, res, next) => {
    const { email, username, password } = req.body;
    const errors = [];

    const normalizedEmail = typeof email === 'string' ? email.trim() : '';
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';

    if (!normalizedEmail && !normalizedUsername) {
      errors.push({ field: 'email', message: 'Email or username is required' });
    } else if (normalizedEmail && !validateEmail(normalizedEmail)) {
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
    const { customerId, associateId, amount, termMonths, lateFeeMode, startDate, annualLateFeeRate, rateSource, lateFeeSource } = req.body;
    const errors = [];

    if (!validateIntegerId(customerId)) {
      errors.push({ field: 'customerId', message: 'Valid customer ID is required' });
    }

    if (associateId !== undefined && associateId !== null && associateId !== '') {
      errors.push({ field: 'associateId', message: 'Socios are managed as investors and cannot be assigned to new credits' });
    }

    if (!validateAmount(amount)) {
      errors.push({ field: 'amount', message: 'Amount must be a positive number' });
    }

    if (!usesPolicySource(rateSource)) {
      errors.push({ field: 'rateSource', message: 'Credit creation must use a configured rate policy' });
    }

    if (!usesPolicySource(lateFeeSource)) {
      errors.push({ field: 'lateFeeSource', message: 'Credit creation must use a configured late fee policy' });
    }

    if (!validateTermMonths(termMonths)) {
      errors.push({ field: 'termMonths', message: 'Term must be between 1 and 360 months' });
    }

    if (!validateOptionalDateInput(startDate)) {
      errors.push({ field: 'startDate', message: 'Loan start date must be a valid date' });
    }

    if (annualLateFeeRate !== undefined && annualLateFeeRate !== null && annualLateFeeRate !== '' && !validateInterestRate(Number(annualLateFeeRate))) {
      errors.push({ field: 'annualLateFeeRate', message: 'Annual late fee rate must be between 0 and 100' });
    }

    rejectUnsupportedLateFeeMode(lateFeeMode, errors);

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },

  /** @type {import('express').RequestHandler} */
  simulate: (req, res, next) => {
    const { amount, interestRate, termMonths, lateFeeMode, startDate, rateSource } = req.body;
    const errors = [];

    if (!validateAmount(amount)) {
      errors.push({ field: 'amount', message: 'Amount must be a positive number' });
    }

    if (!usesPolicySource(rateSource) && !validateInterestRate(interestRate)) {
      errors.push({ field: 'interestRate', message: 'Interest rate must be between 0 and 100' });
    }

    if (!validateTermMonths(termMonths)) {
      errors.push({ field: 'termMonths', message: 'Term must be between 1 and 360 months' });
    }

    if (!validateOptionalDateInput(startDate)) {
      errors.push({ field: 'startDate', message: 'Loan start date must be a valid date' });
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

    if (!asOfDate || !isValidDateOnly(String(asOfDate).trim())) {
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

    if (!asOfDate || !isValidDateOnly(String(asOfDate).trim())) {
      errors.push({ field: 'asOfDate', message: 'asOfDate must be a valid YYYY-MM-DD date' });
    }

    if (!validateAmount(Number(quotedTotal))) {
      errors.push({ field: 'quotedTotal', message: 'quotedTotal must be a positive number' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },

  /** @type {import('express').RequestHandler} */
  adminRegister: (req, res, next) => {
    const { name, email, password, role, phone, associateId } = req.body;
    const errors = [];
    const normalizedRole = normalizeApplicationRole(role);

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
    } else if (password.length < 8) {
      errors.push({
        field: 'password',
        message: 'Password must be at least 8 characters long and include uppercase, lowercase, and numeric characters.',
      });
    }

    if (!normalizedRole || !isAdministrativeLoginRole(normalizedRole)) {
      errors.push({ field: 'role', message: `Role must be one of: ${ADMINISTRATIVE_LOGIN_ROLES.join(', ')}` });
    }

    if (normalizedRole === 'socio' && (!phone || !validatePhone(phone))) {
      errors.push({ field: 'phone', message: 'Valid phone number is required for socio registration' });
    }

    if (normalizedRole === 'socio' && !validateIntegerId(associateId)) {
      errors.push({ field: 'associateId', message: 'Valid associateId is required for socio registration' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },
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
    const { name, email, phone, status } = req.body;
    const errors = [];

    pushNameValidation({ errors, name, required: true });
    pushEmailValidation({ errors, email, required: true });
    pushPhoneValidation({ errors, phone, required: true });
    pushCustomerStatusValidation({ errors, status });

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
      birthDate,
      documentNumber,
      occupation,
      department,
      city,
      address,
    } = req.body;
    const errors = [];

    pushNameValidation({ errors, name, required: false });
    pushEmailValidation({ errors, email, required: false });
    pushPhoneValidation({ errors, phone, required: false });
    pushCustomerStatusValidation({ errors, status });

    if (birthDate !== undefined && birthDate !== null && birthDate !== '') {
      if (!isValidDateOnly(String(birthDate).trim())) {
        errors.push({ field: 'birthDate', message: 'Birth date must be a valid YYYY-MM-DD date' });
      }
    }

    if (documentNumber !== undefined && documentNumber !== null && String(documentNumber).trim() === '') {
      errors.push({ field: 'documentNumber', message: 'Document number cannot be empty' });
    }

    if (occupation !== undefined && occupation !== null && String(occupation).trim() === '') {
      errors.push({ field: 'occupation', message: 'Occupation cannot be empty' });
    }

    if (department !== undefined && department !== null && String(department).trim() === '') {
      errors.push({ field: 'department', message: 'Department cannot be empty' });
    }

    if (city !== undefined && city !== null && String(city).trim() === '') {
      errors.push({ field: 'city', message: 'City cannot be empty' });
    }

    if (address !== undefined && address !== null && String(address).trim() === '') {
      errors.push({ field: 'address', message: 'Address cannot be empty' });
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
      interestType,
      interestRate,
      interestPaymentDay,
      interestPaymentMonth,
      initialCapital,
      interestStartDate,
      interestStartsAt,
    } = req.body;
    const errors = [];

    pushNameValidation({ errors, name, required: true });
    pushEmailValidation({ errors, email, required: true });
    pushPhoneValidation({ errors, phone, required: true });
    pushActiveInactiveStatusValidation({ errors, status });
    pushParticipationValidation({ req, errors, participationPercentage });
    pushAssociateFinancialTermsValidation({ errors, interestType, interestRate, interestPaymentDay, interestPaymentMonth, initialCapital, interestStartDate, interestStartsAt });

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
      interestType,
      interestRate,
      interestPaymentDay,
      interestPaymentMonth,
      interestStartDate,
      interestStartsAt,
    } = req.body;
    const errors = [];

    pushNameValidation({ errors, name, required: false });
    pushEmailValidation({ errors, email, required: false });
    pushPhoneValidation({ errors, phone, required: false });
    pushActiveInactiveStatusValidation({ errors, status });
    pushParticipationValidation({ req, errors, participationPercentage });
    pushAssociateFinancialTermsValidation({ errors, interestType, interestRate, interestPaymentDay, interestPaymentMonth, interestStartDate, interestStartsAt });

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

    if (channel === 'mobile' && !deviceToken && !endpoint) {
      errors.push({ field: 'deviceToken', message: 'Mobile subscriptions require a deviceToken or endpoint' });
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
  attachPagination,
  authValidation,
  loanValidation,
  paymentValidation,
  customerValidation,
  associateValidation,
  notificationValidation,
};
