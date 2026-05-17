/**
 * PostgreSQL-backed sliding window rate limiter for distributed/cluster deployments.
 * Uses atomic database operations to prevent race conditions and supports
 * multiple application instances sharing the same database.
 */

const { sequelize } = require('@/models');
const { logger } = require('@/utils/logger');

const resolveClientIp = (req) => {
  if (!req) {
    return 'unknown-ip';
  }

  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (forwardedFor) {
    return String(forwardedFor).split(',')[0].trim();
  }

  return req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || 'unknown-ip';
};

const buildRateLimitIdentifier = (req, keyPrefix) => {
  const ip = resolveClientIp(req);

  if (keyPrefix === 'auth') {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const loginIdentifier = email || username;

    if (loginIdentifier) {
      return `${ip}:${loginIdentifier}`;
    }
  }

  return ip;
};

const isReadOnlyRequest = (req) => ['GET', 'HEAD', 'OPTIONS'].includes(String(req?.method || '').toUpperCase());

const shouldBypassGlobalRateLimit = (req) => {
  const path = String(req?.originalUrl || req?.url || req?.path || '');
  return path.startsWith('/api/auth');
};

/**
 * Create a rate limiter backed by PostgreSQL using sliding window algorithm.
 * This provides:
 * - Persistence across server restarts
 * - Cluster/multi-instance support via shared database
 * - Atomic operations preventing race conditions
 */
const createSqlRateLimiter = ({ windowMs, max, keyPrefix = 'rl', message }) => {
  const inMemoryFallback = createInMemoryRateLimiter({ windowMs, max, keyPrefix, message });
  let sqlUnavailable = false;

  // Clean up entries older than 2x windowMs to prevent table bloat
  const cleanupOldEntries = async () => {
    const cutoff = new Date(Date.now() - (windowMs * 2));
    try {
      await sequelize.query(
        `DELETE FROM rate_limit_entries WHERE "keyPrefix" = :keyPrefix AND created_at < :cutoff`,
        { replacements: { keyPrefix, cutoff }, type: sequelize.QueryTypes.DELETE }
      );
    } catch (err) {
      // Silently ignore cleanup errors - they're non-critical
    }
  };

  // Periodically clean up old entries (every 100 requests on average)
  let requestCount = 0;
  const cleanupThreshold = 100;
  const maybeCleanup = async () => {
    requestCount++;
    if (requestCount >= cleanupThreshold) {
      requestCount = 0;
      // Run cleanup in background (don't await)
      cleanupOldEntries().catch(() => {});
    }
  };

  return async (req, res, next) => {
    if (sqlUnavailable) {
      return inMemoryFallback(req, res, next);
    }

    const identifier = buildRateLimitIdentifier(req, keyPrefix);
    const key = `${keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = new Date(now - windowMs);

    try {
      // Use a transaction for atomic operations
      const result = await sequelize.transaction(async (tx) => {
        // Count requests from this IP within the current window
        const [countRow] = await sequelize.query(
          `SELECT COUNT(*) as count FROM rate_limit_entries 
           WHERE "keyPrefix" = :keyPrefix AND identifier = :identifier AND created_at > :windowStart`,
          { 
            replacements: { keyPrefix, identifier: key, windowStart },
            type: sequelize.QueryTypes.SELECT,
            transaction: tx,
          }
        );

        const currentCount = parseInt(countRow?.count || '0', 10);

        if (currentCount >= max) {
          // Get the oldest entry to calculate retry-after
          const [oldestRow] = await sequelize.query(
            `SELECT created_at FROM rate_limit_entries 
             WHERE "keyPrefix" = :keyPrefix AND identifier = :identifier 
             ORDER BY created_at ASC LIMIT 1`,
            {
              replacements: { keyPrefix, identifier: key },
              type: sequelize.QueryTypes.SELECT,
              transaction: tx,
            }
          );

          const oldestEntry = oldestRow;
          const retryAfter = oldestEntry 
            ? Math.ceil((new Date(oldestEntry.created_at).getTime() + windowMs - now) / 1000)
            : Math.ceil(windowMs / 1000);

          return {
            allowed: false,
            retryAfter: Math.max(1, retryAfter),
          };
        }

        // Insert new entry for this request
        await sequelize.query(
          `INSERT INTO rate_limit_entries ("keyPrefix", identifier, created_at) 
           VALUES (:keyPrefix, :identifier, :createdAt)`,
          {
            replacements: { keyPrefix, identifier: key, createdAt: new Date(now) },
            type: sequelize.QueryTypes.INSERT,
            transaction: tx,
          }
        );

        return { allowed: true, remaining: max - currentCount - 1 };
      });

      // Run cleanup check in background
      maybeCleanup().catch(() => {});

      if (!result.allowed) {
        return res.status(429).json({
          status: 'error',
          code: 'TOO_MANY_REQUESTS',
          message: message || 'Demasiadas peticiones. Por favor, espere un momento.',
          retryAfter: result.retryAfter,
        });
      }

      // Add rate limit headers
      res.set('X-RateLimit-Limit', max);
      res.set('X-RateLimit-Remaining', result.remaining);
      next();
    } catch (err) {
      // Fail closed into in-memory protection instead of bypassing throttling entirely.
      sqlUnavailable = true;
      logger.error('Rate limiter SQL unavailable, falling back to in-memory', { error: err.message });
      return inMemoryFallback(req, res, next);
    }
  };
};

/**
 * Create a simple in-memory rate limiter for when database is not available.
 * This is used as a fallback when the database connection is not established.
 */
const createInMemoryRateLimiter = ({ windowMs, max, keyPrefix, message }) => {
  const requests = new Map(); // In-memory storage (IP -> { count, resetTime })

  // Evict expired entries periodically to prevent unbounded growth
  const CLEANUP_INTERVAL_MS = Math.max(windowMs * 2, 60_000);
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of requests) {
      if (now > entry.resetTime) {
        requests.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref(); // Don't block process exit

  return (req, res, next) => {
    const identifier = buildRateLimitIdentifier(req, keyPrefix);
    const now = Date.now();
    const entry = requests.get(identifier);

    if (!entry || now > entry.resetTime) {
      requests.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({
        status: 'error',
        code: 'TOO_MANY_REQUESTS',
        message: message || 'Demasiadas peticiones. Por favor, espere un momento.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
    }

    next();
  };
};

// Check if sequelize is available and connected
const isDatabaseAvailable = () => {
  try {
    return sequelize && sequelize.models && sequelize.models.RateLimitEntry;
  } catch (err) {
    return false;
  }
};

// Use database-backed limiter if available, otherwise fall back to in-memory
const createRateLimiter = (options) => {
  if (process.env.NODE_ENV === 'test') {
    return (_req, _res, next) => next();
  }
  if (isDatabaseAvailable()) {
    return createSqlRateLimiter(options);
  }
  logger.warn('Rate limiter: Database not available, using in-memory rate limiter (not suitable for clusters)');
  return createInMemoryRateLimiter(options);
};

/** Rate limiting presets — adjust per environment via env vars if needed. */
const RATE_LIMITS = {
  /** General API abuse prevention per IP */
  GLOBAL:  { windowMs: 60 * 1000, max: 100, keyPrefix: 'global' },
  /** Navigation/data-fetch traffic per IP */
  READ:    { windowMs: 60 * 1000, max: 600, keyPrefix: 'read' },
  /** Brute-force login prevention per IP+email */
  AUTH:    { windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'auth' },
  /** Payment mutation rate per IP */
  PAYMENT: { windowMs: 60 * 1000, max: 3, keyPrefix: 'payment' },
};

const globalLimiter = createRateLimiter({
  ...RATE_LIMITS.GLOBAL,
  message: 'Demasiadas peticiones desde esta IP. Intente de nuevo en un minuto.',
});

const readLimiter = createRateLimiter({
  ...RATE_LIMITS.READ,
  message: 'Demasiadas consultas desde esta IP. Intente de nuevo en un minuto.',
});

const authLimiter = createRateLimiter({
  ...RATE_LIMITS.AUTH,
  message: 'Demasiados intentos de acceso. Por favor, espere 15 minutos.',
});

const paymentLimiter = createRateLimiter({
  ...RATE_LIMITS.PAYMENT,
  message: 'Operación de pago en curso o demasiados intentos. Por favor, espere.',
});


module.exports = {
  globalLimiter,
  readLimiter,
  authLimiter,
  paymentLimiter,
  createRateLimiter,
  createSqlRateLimiter,
  createInMemoryRateLimiter,
  buildRateLimitIdentifier,
  resolveClientIp,
  isReadOnlyRequest,
  shouldBypassGlobalRateLimit,
};
