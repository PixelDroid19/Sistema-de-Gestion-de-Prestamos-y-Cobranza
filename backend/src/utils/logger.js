const winston = require('winston');
const fs = require('fs');
const path = require('path');
require('winston-daily-rotate-file');
const { LOG_CATEGORY } = require('@/modules/shared/logCategories');

// ---------------------------------------------------------------------------
// Sensitive-data sanitisation
// ---------------------------------------------------------------------------

const SENSITIVE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'refreshToken',
  'accessToken',
  'token',
  'authorization',
  'cookie',
  'deviceToken',
  'cvv',
  'cardNumber',
  'accountNumber',
  'ssn',
  'secret',
]);

const sanitizeSensitive = (value) => {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeSensitive);
  }

  return Object.entries(value).reduce((acc, [key, val]) => {
    if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
      acc[key] = '[REDACTED]';
    } else {
      acc[key] = sanitizeSensitive(val);
    }
    return acc;
  }, {});
};

// ---------------------------------------------------------------------------
// Auto-inject request context (traceId, requestId, userId, ip …)
// ---------------------------------------------------------------------------

/**
 * Winston format that reads the current AsyncLocalStorage request context and
 * merges trace / user / request identifiers into every log entry automatically.
 *
 * Imported lazily to avoid circular-require at module load time (logger is
 * required before the request-context module in some test setups).
 */
const injectRequestContext = winston.format((info) => {
  // Lazy-require to break the potential logger ↔ requestContext cycle.
  const { getRequestContext } = require('@/modules/shared/requestContext');
  const ctx = getRequestContext();

  if (ctx) {
    info.requestId = ctx.requestId ?? undefined;
    info.traceId = ctx.traceId ?? undefined;
    info.userId = ctx.userId ?? undefined;
    info.userRole = ctx.userRole ?? undefined;
    info.ip = info.ip || ctx.ip || undefined;
    if (ctx.startTime) {
      info.elapsed = `${Date.now() - ctx.startTime}ms`;
    }
  }

  return info;
});

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

const logsDir = path.resolve(process.cwd(), 'logs');
const shouldUseFileTransports = process.env.LOG_TO_FILES !== 'false';
const fileTransports = [];

const canWriteLogFiles = () => {
  const probePath = path.join(logsDir, `.write-check-${process.pid}`);
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(probePath, '');
    fs.unlinkSync(probePath);
    return true;
  } catch (_err) {
    return false;
  }
};

const guardTransport = (transport) => {
  transport.on('error', () => {
    // Read-only or transient filesystem failures must not crash the API.
    transport.silent = true;
  });
  return transport;
};

if (shouldUseFileTransports) {
  if (canWriteLogFiles()) {
    // Combined — all levels, daily rotation, 30 days retention
    fileTransports.push(
      guardTransport(new winston.transports.DailyRotateFile({
        filename: path.join(logsDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        zippedArchive: true,
      })),
    );

    // Errors only — separate file for fast triage
    fileTransports.push(
      guardTransport(new winston.transports.DailyRotateFile({
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '30d',
        zippedArchive: true,
      })),
    );

    // Security category — separate file for SIEM / compliance
    fileTransports.push(
      guardTransport(new winston.transports.DailyRotateFile({
        filename: path.join(logsDir, 'security-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '90d',
        zippedArchive: true,
        // Only accept entries with category === 'security'
        filter: (info) => info.category === LOG_CATEGORY.SECURITY,
      })),
    );
  }
}

// ---------------------------------------------------------------------------
// Logger instance
// ---------------------------------------------------------------------------

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    injectRequestContext(),
    winston.format.json(),
  ),
  defaultMeta: {
    service: 'loan-recovery-api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: fileTransports,
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  }));
}

// ---------------------------------------------------------------------------
// Category-aware helpers
// ---------------------------------------------------------------------------

/**
 * Log the completed HTTP request with timing and caller metadata.
 */
const logRequest = (req, res, next) => {
  res.on('finish', () => {
    const { getRequestContext } = require('@/modules/shared/requestContext');
    const ctx = getRequestContext();
    const duration = ctx?.startTime ? Date.now() - ctx.startTime : undefined;

    logger.info('HTTP Request', {
      category: LOG_CATEGORY.TECHNICAL,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration: duration !== undefined ? `${duration}ms` : undefined,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  });

  next();
};

/**
 * Log an application error with request context when available.
 */
const logError = (error, req) => {
  logger.error('Application Error', {
    category: LOG_CATEGORY.TECHNICAL,
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    path: req?.path,
    method: req?.method,
    body: sanitizeSensitive(req?.body),
    params: req?.params,
    query: req?.query,
    user: req?.user?.id,
  });
};

/**
 * Log a database operation.
 */
const logDatabase = (message, data = {}) => {
  logger.info('Database Operation', {
    category: LOG_CATEGORY.TECHNICAL,
    message,
    ...data,
  });
};

/**
 * Log a security-relevant event (warn level — always captured).
 */
const logSecurity = (event, data = {}) => {
  logger.warn('Security Event', {
    category: LOG_CATEGORY.SECURITY,
    event,
    ...sanitizeSensitive(data),
  });
};

/**
 * Log a domain or business event.
 */
const logBusiness = (event, data = {}) => {
  logger.info('Business Event', {
    category: LOG_CATEGORY.BUSINESS,
    event,
    ...data,
  });
};

/**
 * Log a technical/infrastructure event (replaces ad-hoc console calls).
 */
const logTechnical = (event, data = {}) => {
  logger.info('Technical Event', {
    category: LOG_CATEGORY.TECHNICAL,
    event,
    ...data,
  });
};

module.exports = {
  logger,
  logRequest,
  logError,
  logDatabase,
  logSecurity,
  logBusiness,
  logTechnical,
  sanitizeSensitive,
};
