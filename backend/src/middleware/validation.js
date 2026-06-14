const { ValidationError } = require('@/utils/errorHandler');
const { UNSUPPORTED_LATE_FEE_MODES, normalizeLateFeeMode } = require('@/modules/credits/domain/calculation');
const { parsePaginationQuery } = require('@/modules/shared/pagination');
const { isAdministrativeLoginRole, normalizeApplicationRole } = require('@/modules/shared/roles');
const { parsePositiveCurrencyAmount, validateCurrencyPrecision } = require('@/modules/shared/money');
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
const {
  PUSH_PROVIDER_CHANNELS,
  PUSH_PROVIDER_KEYS,
  PUSH_CHANNELS,
  PUSH_CHANNEL_LABELS,
} = require('@/modules/notifications/infrastructure/push/providerContracts');

const buildValidationError = (errors, message = 'Corrige los errores indicados') => {
  const error = new ValidationError(message);
  error.errors = errors;
  return error;
};

const EMAIL_VALIDATION_MESSAGE = 'Ingresa un correo válido (por ejemplo, usuario@empresa.com)';

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
        throw buildValidationError(validationErrors, 'La validación falló');
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
    message: 'El porcentaje de participación debe estar entre 0 y 100 con máximo 4 decimales',
  });
};

const pushNameValidation = ({ errors, name, required }) => {
  if (required && (!name || String(name).trim().length < 2)) {
    errors.push({ field: 'name', message: 'El nombre debe tener al menos 2 caracteres' });
    return;
  }

  if (!required && name !== undefined && String(name).trim().length < 2) {
    errors.push({ field: 'name', message: 'El nombre debe tener al menos 2 caracteres' });
  }
};

const pushEmailValidation = ({ errors, email, required }) => {
  if (required && !email) {
    errors.push({ field: 'email', message: 'El correo es obligatorio' });
    return;
  }

  if (email !== undefined && email !== null && email !== '' && !validateEmail(email)) {
    errors.push({ field: 'email', message: EMAIL_VALIDATION_MESSAGE });
  }
};

const pushPhoneValidation = ({ errors, phone, required }) => {
  if (required && (!phone || !validatePhone(phone))) {
    errors.push({ field: 'phone', message: 'El teléfono debe ser válido' });
    return;
  }

  if (!required && phone !== undefined && !validatePhone(phone)) {
    errors.push({ field: 'phone', message: 'El teléfono debe ser válido' });
  }
};

const pushActiveInactiveStatusValidation = ({ errors, status }) => {
  if (status !== undefined && !['active', 'inactive'].includes(status)) {
    errors.push({ field: 'status', message: 'El estado debe ser activo o inactivo' });
  }
};

const pushCustomerStatusValidation = ({ errors, status }) => {
  if (status !== undefined && !['active', 'inactive', 'blacklisted'].includes(status)) {
    errors.push({ field: 'status', message: 'El estado debe ser activo, inactivo o bloqueado' });
  }
};

const pushParticipationValidation = ({ req, errors, participationPercentage }) => {
  if (req.user?.role !== 'admin' && Object.prototype.hasOwnProperty.call(req.body, 'participationPercentage')) {
    errors.push({ field: 'participationPercentage', message: 'Solo los administradores pueden definir el porcentaje de participación' });
  } else if (!validateParticipationPercentage(participationPercentage)) {
    pushParticipationPercentageError(errors);
  }
};

const pushAssociateFinancialTermsValidation = ({ errors, interestType, interestRate, interestPaymentDay, interestPaymentMonth, initialCapital, interestStartDate, interestStartsAt }) => {
  if (interestType !== undefined && !['monthly', 'annual'].includes(String(interestType).trim().toLowerCase())) {
    errors.push({ field: 'interestType', message: 'El tipo de interés debe ser mensual o anual' });
  }

  if (!validateAssociateInterestRate(interestRate)) {
    errors.push({ field: 'interestRate', message: 'La tasa de interés debe estar entre 0 y 100 con máximo 4 decimales' });
  }

  if (!validateIntegerRange(interestPaymentDay, 1, 28)) {
    errors.push({ field: 'interestPaymentDay', message: 'El día de pago de intereses debe ser un entero entre 1 y 28' });
  }

  if (!validateIntegerRange(interestPaymentMonth, 1, 12)) {
    errors.push({ field: 'interestPaymentMonth', message: 'El mes de pago de intereses debe ser un entero entre 1 y 12' });
  }

  if (initialCapital !== undefined && (!validateAmount(Number(initialCapital)) || !validateCurrencyPrecision(initialCapital))) {
    errors.push({ field: 'initialCapital', message: 'El capital inicial debe ser un número positivo con máximo 2 decimales' });
  }

  const effectiveStartDate = interestStartsAt ?? interestStartDate;
  if (!validateOptionalDateInput(effectiveStartDate)) {
    errors.push({ field: 'interestStartDate', message: 'La fecha de inicio de intereses debe ser válida' });
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
      message: 'Selecciona una política de mora válida.',
    });
  }
};

const authValidation = {
  /** @type {import('express').RequestHandler} */
  register: (req, res, next) => {
    const { name, email, password, phone } = req.body;
    const errors = [];
    if (!name || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'El nombre debe tener al menos 2 caracteres' });
    }

    if (!email) {
      errors.push({ field: 'email', message: 'El correo es obligatorio' });
    } else if (!validateEmail(email)) {
      errors.push({ field: 'email', message: EMAIL_VALIDATION_MESSAGE });
    }

    if (!password) {
      errors.push({ field: 'password', message: 'La contraseña es obligatoria' });
    } else if (password.length < 8) {
      errors.push({
        field: 'password',
        message: 'La contraseña debe tener al menos 8 caracteres e incluir mayúsculas, minúsculas y números.'
      });
    }

    errors.push({ field: 'role', message: 'El registro público está deshabilitado. Un administrador debe crear las cuentas de empleados.' });

    if (phone && !validatePhone(phone)) {
      errors.push({ field: 'phone', message: 'Ingresa un teléfono válido' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },

  /** @type {import('express').RequestHandler} */
  adminRegister: (req, res, next) => {
    const { name, email, password, role } = req.body;
    const errors = [];
    const normalizedRole = normalizeApplicationRole(role);

    if (!name || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'El nombre debe tener al menos 2 caracteres' });
    }

    if (!email) {
      errors.push({ field: 'email', message: 'El correo es obligatorio' });
    } else if (!validateEmail(email)) {
      errors.push({ field: 'email', message: EMAIL_VALIDATION_MESSAGE });
    }

    if (!password) {
      errors.push({ field: 'password', message: 'La contraseña es obligatoria' });
    } else if (password.length < 8) {
      errors.push({
        field: 'password',
        message: 'La contraseña debe tener al menos 8 caracteres e incluir mayúsculas, minúsculas y números.',
      });
    }

    if (!normalizedRole || !isAdministrativeLoginRole(normalizedRole)) {
      errors.push({ field: 'role', message: 'Selecciona un rol administrativo válido.' });
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
      errors.push({ field: 'email', message: 'El correo o usuario es obligatorio' });
    } else if (normalizedEmail && !validateEmail(normalizedEmail)) {
      errors.push({ field: 'email', message: EMAIL_VALIDATION_MESSAGE });
    }

    if (!password) {
      errors.push({ field: 'password', message: 'La contraseña es obligatoria' });
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
      errors.push({ field: 'customerId', message: 'El ID del cliente debe ser válido' });
    }

    if (associateId !== undefined && associateId !== null && associateId !== '') {
      errors.push({ field: 'associateId', message: 'Los socios se gestionan como inversionistas y no se asignan a créditos nuevos' });
    }

    if (!validateAmount(amount)) {
      errors.push({ field: 'amount', message: 'El monto debe ser un número positivo' });
    }

    if (!usesPolicySource(rateSource)) {
      errors.push({ field: 'rateSource', message: 'La creación de créditos debe usar una política de tasa configurada' });
    }

    if (!usesPolicySource(lateFeeSource)) {
      errors.push({ field: 'lateFeeSource', message: 'La creación de créditos debe usar una política de mora configurada' });
    }

    if (!validateTermMonths(termMonths)) {
      errors.push({ field: 'termMonths', message: 'El plazo debe estar entre 1 y 360 meses' });
    }

    if (!validateOptionalDateInput(startDate)) {
      errors.push({ field: 'startDate', message: 'La fecha de inicio del crédito debe ser válida' });
    }

    if (annualLateFeeRate !== undefined && annualLateFeeRate !== null && annualLateFeeRate !== '' && !validateInterestRate(annualLateFeeRate)) {
      errors.push({ field: 'annualLateFeeRate', message: 'La tasa anual de mora debe estar entre 0 y 100' });
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
      errors.push({ field: 'amount', message: 'El monto debe ser un número positivo' });
    }

    if (!usesPolicySource(rateSource) && !validateInterestRate(interestRate)) {
      errors.push({ field: 'interestRate', message: 'La tasa de interés debe estar entre 0 y 100' });
    }

    if (!validateTermMonths(termMonths)) {
      errors.push({ field: 'termMonths', message: 'El plazo debe estar entre 1 y 360 meses' });
    }

    if (!validateOptionalDateInput(startDate)) {
      errors.push({ field: 'startDate', message: 'La fecha de inicio del crédito debe ser válida' });
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
      const error = new ValidationError('Estado del crédito inválido');
      error.errors = [{ field: 'status', message: 'Selecciona un estado de crédito válido.' }];
      return next(error);
    }

    next();
  },

  /** @type {import('express').RequestHandler} */
  payoffQuote: (req, res, next) => {
    const errors = [];
    const { asOfDate } = req.query;

    if (!validateIntegerId(req.params.id)) {
      errors.push({ field: 'id', message: 'El ID del crédito debe ser válido' });
    }

    if (!asOfDate || !isValidDateOnly(String(asOfDate).trim())) {
      errors.push({ field: 'asOfDate', message: 'La fecha efectiva debe tener formato AAAA-MM-DD' });
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
      errors.push({ field: 'id', message: 'El ID del crédito debe ser válido' });
    }

    if (!asOfDate || !isValidDateOnly(String(asOfDate).trim())) {
      errors.push({ field: 'asOfDate', message: 'La fecha efectiva debe tener formato AAAA-MM-DD' });
    }

    if (parsePositiveCurrencyAmount(quotedTotal) === null) {
      errors.push({ field: 'quotedTotal', message: 'El total cotizado debe ser un número positivo' });
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
      errors.push({ field: 'amount', message: 'El monto debe ser un número positivo' });
    }

    if (!validateIntegerId(loanId)) {
      errors.push({ field: 'loanId', message: 'El ID del crédito debe ser válido' });
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
        errors.push({ field: 'birthDate', message: 'La fecha de nacimiento debe tener formato AAAA-MM-DD' });
      }
    }

    if (documentNumber !== undefined && documentNumber !== null && String(documentNumber).trim() === '') {
      errors.push({ field: 'documentNumber', message: 'El número de documento no puede estar vacío' });
    }

    if (occupation !== undefined && occupation !== null && String(occupation).trim() === '') {
      errors.push({ field: 'occupation', message: 'La ocupación no puede estar vacía' });
    }

    if (department !== undefined && department !== null && String(department).trim() === '') {
      errors.push({ field: 'department', message: 'El departamento no puede estar vacío' });
    }

    if (city !== undefined && city !== null && String(city).trim() === '') {
      errors.push({ field: 'city', message: 'La ciudad no puede estar vacía' });
    }

    if (address !== undefined && address !== null && String(address).trim() === '') {
      errors.push({ field: 'address', message: 'La dirección no puede estar vacía' });
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
      errors.push({ field: 'amount', message: 'El monto debe ser un número positivo con máximo 2 decimales' });
    }

    if (!validateOptionalDateInput(distributionDate)) {
      errors.push({ field: 'distributionDate', message: 'La fecha de distribución debe ser válida cuando se indique' });
    }

    if (basis !== undefined && (typeof basis !== 'object' || basis === null || Array.isArray(basis))) {
      errors.push({ field: 'basis', message: 'La base de distribución debe ser un objeto cuando se indique' });
    }

    if (!validateIdempotencyKey(effectiveIdempotencyKey)) {
      errors.push({ field: 'idempotencyKey', message: 'La clave de idempotencia debe tener entre 8 y 160 caracteres cuando se indique' });
    }

    if (errors.length > 0) {
      return next(buildValidationError(errors));
    }

    next();
  },
};

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
      errors.push({ field: 'providerKey', message: 'El proveedor de notificaciones no está soportado por el sistema' });
    }

    if (!PUSH_CHANNELS.has(channel)) {
      errors.push({ field: 'channel', message: 'El canal debe ser web o móvil' });
    }

    if (PUSH_PROVIDER_KEYS.has(providerKey) && PUSH_CHANNELS.has(channel)) {
      const expectedChannel = PUSH_PROVIDER_CHANNELS[providerKey];
      if (expectedChannel !== channel) {
        errors.push({
          field: 'channel',
          message: `Las suscripciones del proveedor seleccionado deben usar el canal ${PUSH_CHANNEL_LABELS[expectedChannel]}`,
        });
      }
    }

    if (!endpoint && !deviceToken) {
      errors.push({ field: 'endpoint', message: 'Debes indicar el identificador de la suscripción o el token del dispositivo' });
    }

    if (channel === 'web') {
      if (!endpoint) {
        errors.push({ field: 'endpoint', message: 'Las suscripciones web requieren el identificador web de la suscripción' });
      }

      if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) {
        errors.push({ field: 'subscription', message: 'Las suscripciones web requieren los datos de suscripción' });
      }
    }

    if (channel === 'mobile' && !deviceToken && !endpoint) {
      errors.push({ field: 'deviceToken', message: 'Las suscripciones móviles requieren el token del dispositivo o el identificador de la suscripción' });
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
      errors.push({ field: 'providerKey', message: 'El proveedor de notificaciones no está soportado por el sistema' });
    }

    if (!endpoint && !deviceToken) {
      errors.push({ field: 'endpoint', message: 'Debes indicar el identificador de la suscripción o el token del dispositivo' });
    }

    if (providerKey === 'webpush' && !endpoint) {
      errors.push({ field: 'endpoint', message: 'Las suscripciones web requieren el identificador web de la suscripción' });
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
