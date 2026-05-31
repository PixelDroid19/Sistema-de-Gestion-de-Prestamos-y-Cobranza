const { logError } = require('./logger');

const SESSION_INVALID_MESSAGE = 'La sesión no es válida. Inicia sesión de nuevo.';
const SESSION_EXPIRED_MESSAGE = 'La sesión expiró. Inicia sesión de nuevo.';
const ACCOUNT_LOCKED_MESSAGE = 'La cuenta está bloqueada temporalmente por demasiados intentos fallidos.';
const AUTHENTICATION_REQUIRED_MESSAGE = 'La autenticación es requerida.';
const ACCESS_DENIED_MESSAGE = 'No tienes acceso a esta acción.';
const RESOURCE_CONFLICT_MESSAGE = 'El registro tiene un conflicto con la información existente.';
const CORS_ORIGIN_DENIED_MESSAGE = 'El origen de la solicitud no está permitido.';
const CORS_ORIGIN_REQUIRED_MESSAGE = 'El origen de la solicitud es requerido.';
const INTERNAL_SERVER_ERROR_MESSAGE = 'Ocurrió un error interno del servidor.';
const UNIQUE_CONSTRAINT_MESSAGES = {
  email: 'Ya existe un registro con ese correo electrónico.',
  phone: 'Ya existe un registro con ese teléfono.',
  document: 'Ya existe un registro con ese documento.',
  documentNumber: 'Ya existe un registro con ese documento.',
  identificationNumber: 'Ya existe un registro con ese documento.',
};
const NOT_FOUND_MESSAGES = {
  'Attachment file': 'El archivo adjunto no existe.',
  Associate: 'El socio no existe.',
  Customer: 'El cliente no existe.',
  Installment: 'La cuota no existe.',
  Loan: 'El crédito no existe.',
  'Loan alert': 'La alerta del crédito no existe.',
  Notification: 'La notificación no existe.',
  'Operating expense': 'El gasto operativo no existe.',
  Payment: 'El pago no existe.',
  'Payment method': 'El método de pago no existe.',
  Permission: 'El permiso no existe.',
  'Promise to pay': 'La promesa de pago no existe.',
  'Rate policy': 'La política de tasa no existe.',
  'Late fee policy': 'La política de mora no existe.',
  'Refresh token': 'La sesión no existe o ya no está disponible.',
  Route: 'La ruta solicitada no existe.',
  User: 'El usuario no existe.',
};

const getNotFoundMessage = (resource = 'Resource') => {
  const normalizedResource = String(resource || '').trim();
  if (NOT_FOUND_MESSAGES[normalizedResource]) {
    return NOT_FOUND_MESSAGES[normalizedResource];
  }
  if (/^FinancialProduct\b/.test(normalizedResource)) {
    return 'El producto financiero no existe.';
  }
  return 'El registro solicitado no existe.';
};

/**
 * Base application error that carries HTTP status metadata for API responses.
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error raised when request or domain input is invalid.
 */
class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

class BadRequestError extends ValidationError {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }
}

/**
 * Validation error raised when a business rule denies an otherwise valid action.
 */
class BusinessRuleViolationError extends ValidationError {
  constructor(message, { code = 'BUSINESS_RULE_VIOLATION', denialReasons = [] } = {}) {
    super(message);
    this.name = 'BusinessRuleViolationError';
    this.code = code;
    this.denialReasons = denialReasons;
  }
}

/**
 * Authentication error raised when a caller is not authenticated.
 */
class AuthenticationError extends AppError {
  constructor(message = AUTHENTICATION_REQUIRED_MESSAGE) {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error raised when a caller lacks permission.
 */
class AuthorizationError extends AppError {
  constructor(message = ACCESS_DENIED_MESSAGE) {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not-found error raised when a requested resource does not exist.
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(getNotFoundMessage(resource), 404);
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

/**
 * Conflict error raised when persistence detects duplicate or incompatible state.
 */
class ConflictError extends AppError {
  constructor(message = RESOURCE_CONFLICT_MESSAGE) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

/**
 * Idempotent replay error - thrown when a duplicate idempotency key is detected
 * and the original response should be returned instead of reprocessing.
 * This is NOT an operational error - it's an expected case for idempotent replays.
 */
class IdempotentReplayError extends AppError {
  constructor(message, cachedPayload = {}) {
    super(message, 200); // Return 200 OK, not an error status
    this.name = 'IdempotentReplayError';
    this.cachedPayload = cachedPayload;
    this.isOperational = true;
  }
}

/**
 * Account locked error - thrown when a user account is locked due to too many
 * consecutive failed login attempts.
 */
class AccountLockedError extends AppError {
  constructor(message = ACCOUNT_LOCKED_MESSAGE, lockoutDurationMinutes = 15) {
    super(message, 423); // 423 Locked
    this.name = 'AccountLockedError';
    this.lockoutDurationMinutes = lockoutDurationMinutes;
  }
}

const formatAccountLockedMessage = (remainingMinutes) => {
  const minutes = Number.isFinite(Number(remainingMinutes))
    ? Math.max(1, Math.ceil(Number(remainingMinutes)))
    : 1;
  return `${ACCOUNT_LOCKED_MESSAGE} Intenta de nuevo en ${minutes} minuto(s).`;
};

/**
 * Build the JSON API error payload, including development diagnostics when enabled.
 * @param {Error & { statusCode?: number, errors?: Array<object> }} error
 * @param {import('express').Request} req
 * @returns {object}
 */
const formatErrorResponse = (error, req) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const errorResponse = {
    success: false,
    error: {
      message: error.message,
      statusCode: error.statusCode || 500,
      ...(error.code ? { code: error.code } : {}),
      ...(Array.isArray(error.denialReasons) && error.denialReasons.length > 0
        ? { denialReasons: error.denialReasons }
        : {}),
      ...(isDevelopment && { stack: error.stack }),
      ...(isDevelopment && { path: req?.path }),
      ...(isDevelopment && { method: req?.method }),
      ...(isDevelopment && { timestamp: new Date().toISOString() })
    }
  };

  if (error.errors && Array.isArray(error.errors)) {
    errorResponse.error.validationErrors = error.errors.map((err) => ({
      field: err.field || err.path,
      message: err.message,
      value: err.value,
    }));
  }

  return errorResponse;
};

/**
 * Wrap an async Express handler so rejected promises flow into next().
 * @param {Function} fn
 * @returns {import('express').RequestHandler}
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const getUniqueConstraintField = (err) => {
  const constraintName = String(err?.parent?.constraint || err?.original?.constraint || '').trim();
  if (constraintName === 'Customers_pkey') {
    return 'customerSequence';
  }

  if (Array.isArray(err?.errors)) {
    const matchingError = err.errors.find((entry) => typeof entry?.path === 'string' && entry.path.trim());
    if (matchingError?.path) {
      return matchingError.path;
    }
  }

  if (err?.fields && typeof err.fields === 'object') {
    const fieldName = Object.keys(err.fields).find((key) => typeof key === 'string' && key.trim());
    if (fieldName) {
      return fieldName;
    }
  }

  return 'Resource';
};

const getUniqueConstraintMessage = (err) => {
  const field = getUniqueConstraintField(err);
  if (field === 'customerSequence') {
    return 'No se pudo guardar el cliente porque el consecutivo ya está en uso. Intenta nuevamente.';
  }

  return UNIQUE_CONSTRAINT_MESSAGES[field] || 'Ya existe un registro con esos datos.';
};

/**
 * Normalize known backend errors into the shared API error response contract.
 * @param {Error & { statusCode?: number, errors?: Array<object> }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const globalErrorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Only log as application error if it's NOT an operational client error.
  // Operational errors (4xx, isOperational=true) are expected business flows
  // and are already captured by the HTTP request logger with their status code.
  const isOperationalClientError = err.isOperational === true && (err.statusCode || 500) < 500;
  if (!isOperationalClientError) {
    logError(err, req);
  }

  if (err.name === 'SequelizeValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ValidationError(message);
    error.errors = err.errors;
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    error = new ConflictError(getUniqueConstraintMessage(err));
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    const message = 'El registro relacionado no existe.';
    error = new ValidationError(message);
  }

  if (err.name === 'JsonWebTokenError') {
    error = new AuthenticationError(SESSION_INVALID_MESSAGE);
  }

  if (err.name === 'TokenExpiredError') {
    error = new AuthenticationError(SESSION_EXPIRED_MESSAGE);
  }

  if (err.name === 'CastError') {
    const message = 'El identificador recibido no es válido.';
    error = new ValidationError(message);
  }

  // Handle idempotent replay - return the cached response with 200 status
  if (err.name === 'IdempotentReplayError') {
    return res.status(200).json({
      success: true,
      data: err.cachedPayload,
      idempotent: true,
    });
  }

  // Handle CORS errors - origin not allowed
  if (err.message && err.message.includes('is not allowed by CORS policy')) {
    return res.status(403).json({
      success: false,
      error: {
        message: CORS_ORIGIN_DENIED_MESSAGE,
        statusCode: 403,
      },
    });
  }

  if (err.message === 'Origin header is required') {
    return res.status(403).json({
      success: false,
      error: {
        message: CORS_ORIGIN_REQUIRED_MESSAGE,
        statusCode: 403,
      },
    });
  }

  if (!error.statusCode) {
    error.statusCode = 500;
    error.message = INTERNAL_SERVER_ERROR_MESSAGE;
  }

  const errorResponse = formatErrorResponse(error, req);

  res.status(error.statusCode).json(errorResponse);
};

/**
 * Convert unmatched routes into the shared not-found error contract.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError('Route');
  next(error);
};

module.exports = {
  AppError,
  ValidationError,
  BadRequestError,
  BusinessRuleViolationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  IdempotentReplayError,
  AccountLockedError,
  ACCOUNT_LOCKED_MESSAGE,
  AUTHENTICATION_REQUIRED_MESSAGE,
  ACCESS_DENIED_MESSAGE,
  RESOURCE_CONFLICT_MESSAGE,
  CORS_ORIGIN_DENIED_MESSAGE,
  CORS_ORIGIN_REQUIRED_MESSAGE,
  INTERNAL_SERVER_ERROR_MESSAGE,
  formatAccountLockedMessage,
  asyncHandler,
  globalErrorHandler,
  notFoundHandler,
  formatErrorResponse,
};
