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
      ...(isDevelopment && { stack: error.stack }),
      ...(isDevelopment && { path: req.path }),
      ...(isDevelopment && { method: req.method }),
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

  console.error('Error Details:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user?.id
  });

  if (err.name === 'SequelizeValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ValidationError(message);
    error.errors = err.errors;
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = `${err.errors[0].path} already exists`;
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
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  asyncHandler,
  globalErrorHandler,
  notFoundHandler,
  formatErrorResponse,
};
