const { logError } = require('./logger');

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
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error raised when a caller lacks permission.
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not-found error raised when a requested resource does not exist.
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error raised when persistence detects duplicate or incompatible state.
 */
class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
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
  constructor(message = 'Account temporarily locked due to too many failed login attempts', lockoutDurationMinutes = 15) {
    super(message, 423); // 423 Locked
    this.name = 'AccountLockedError';
    this.lockoutDurationMinutes = lockoutDurationMinutes;
  }
}

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
    return 'Customer id';
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

  logError(err, req);

  if (err.name === 'SequelizeValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ValidationError(message);
    error.errors = err.errors;
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = `${getUniqueConstraintField(err)} already exists`;
    error = new ConflictError(message);
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    const message = 'Referenced resource does not exist';
    error = new ValidationError(message);
  }

  if (err.name === 'JsonWebTokenError') {
    error = new AuthenticationError('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AuthenticationError('Token expired');
  }

  if (err.name === 'CastError') {
    const message = 'Invalid resource identifier';
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
        message: 'Origin not allowed by CORS policy',
        statusCode: 403,
      },
    });
  }

  if (!error.statusCode) {
    error.statusCode = 500;
    error.message = 'Internal server error';
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
  BusinessRuleViolationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  IdempotentReplayError,
  AccountLockedError,
  asyncHandler,
  globalErrorHandler,
  notFoundHandler,
  formatErrorResponse,
};
