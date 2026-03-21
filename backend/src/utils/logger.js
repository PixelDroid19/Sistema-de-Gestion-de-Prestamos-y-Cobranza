const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'loan-recovery-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Log the completed HTTP request with timing and caller metadata.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const logRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
};

/**
 * Log an application error with request context when available.
 * @param {Error & { statusCode?: number }} error
 * @param {import('express').Request} [req]
 */
const logError = (error, req) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    path: req?.path,
    method: req?.method,
    body: req?.body,
    params: req?.params,
    query: req?.query,
    user: req?.user?.id
  });
};

/**
 * Log a database operation using the shared structured logger.
 * @param {string} message
 * @param {object} [data={}]
 */
const logDatabase = (message, data = {}) => {
  logger.info('Database Operation', {
    message,
    ...data
  });
};

/**
 * Log a security-relevant event through the shared structured logger.
 * @param {string} event
 * @param {object} [data={}]
 */
const logSecurity = (event, data = {}) => {
  logger.warn('Security Event', {
    event,
    ...data
  });
};

/**
 * Log a domain or business event through the shared structured logger.
 * @param {string} event
 * @param {object} [data={}]
 */
const logBusiness = (event, data = {}) => {
  logger.info('Business Event', {
    event,
    ...data
  });
};

/**
 * Log structured DAG comparison metadata for credits rollout decisions.
 * @param {string} event
 * @param {object} [data={}]
 */
const logDagComparison = (event, data = {}) => {
  logger.info('Credits DAG Comparison', {
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
  logDagComparison,
};
