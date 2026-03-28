/**
 * PostgreSQL-backed sliding window rate limiter for distributed/cluster deployments.
 * Uses atomic database operations to prevent race conditions and supports
 * multiple application instances sharing the same database.
 */

const { sequelize } = require('../models');

/**
 * Create a rate limiter backed by PostgreSQL using sliding window algorithm.
 * This provides:
 * - Persistence across server restarts
 * - Cluster/multi-instance support via shared database
 * - Atomic operations preventing race conditions
 */
const createSqlRateLimiter = ({ windowMs, max, keyPrefix = 'rl', message }) => {
  // Clean up entries older than 2x windowMs to prevent table bloat
  const cleanupOldEntries = async () => {
    const cutoff = Date.now() - (windowMs * 2);
    try {
      await sequelize.query(
        `DELETE FROM rate_limit_entries WHERE key_prefix = :keyPrefix AND created_at < :cutoff`,
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
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Use a transaction for atomic operations
      const result = await sequelize.transaction(async (tx) => {
        // Count requests from this IP within the current window
        const [countResult] = await sequelize.query(
          `SELECT COUNT(*) as count FROM rate_limit_entries 
           WHERE key_prefix = :keyPrefix AND identifier = :identifier AND created_at > :windowStart`,
          { 
            replacements: { keyPrefix, identifier: key, windowStart },
            type: sequelize.QueryTypes.SELECT,
            transaction: tx,
          }
        );

        const currentCount = parseInt(countResult[0]?.count || '0', 10);

        if (currentCount >= max) {
          // Get the oldest entry to calculate retry-after
          const [oldestResult] = await sequelize.query(
            `SELECT created_at FROM rate_limit_entries 
             WHERE key_prefix = :keyPrefix AND identifier = :identifier 
             ORDER BY created_at ASC LIMIT 1`,
            {
              replacements: { keyPrefix, identifier: key },
              type: sequelize.QueryTypes.SELECT,
              transaction: tx,
            }
          );

          const oldestEntry = oldestResult[0];
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
          `INSERT INTO rate_limit_entries (key_prefix, identifier, created_at) 
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
      // If database error occurs, allow the request but log the error
      // This prevents rate limiting from causing outages if DB is unavailable
      console.error('Rate limiter database error:', err.message);
      next();
    }
  };
};

/**
 * Create a simple in-memory rate limiter for when database is not available.
 * This is used as a fallback when the database connection is not established.
 */
const createInMemoryRateLimiter = ({ windowMs, max, message }) => {
  const requests = new Map(); // In-memory storage (IP -> { count, resetTime })

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const now = Date.now();
    const entry = requests.get(ip);

    if (!entry || now > entry.resetTime) {
      requests.set(ip, {
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
  if (isDatabaseAvailable()) {
    return createSqlRateLimiter(options);
  }
  console.warn('Rate limiter: Database not available, using in-memory rate limiter (not suitable for clusters)');
  return createInMemoryRateLimiter(options);
};

// Global limiter: 100 requests per 1 minute per IP
const globalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyPrefix: 'global',
  message: 'Demasiadas peticiones desde esta IP. Intente de nuevo en un minuto.',
});

// Auth limiter: 10 attempts per 15 minutes
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'auth',
  message: 'Demasiados intentos de acceso fallidos. Por favor, espere 15 minutos.',
});

// Payments limiter: 3 payments per minute
const paymentLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 3,
  keyPrefix: 'payment',
  message: 'Operación de pago en curso o demasiados intentos. Por favor, espere.',
});

// Workbench limiter: 20 simulations per 5 minutes
const workbenchLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyPrefix: 'workbench',
  message: 'Límite de simulaciones de grafo alcanzado. Por favor, espere.',
});

module.exports = {
  globalLimiter,
  authLimiter,
  paymentLimiter,
  workbenchLimiter,
  createRateLimiter,
  createSqlRateLimiter,
  createInMemoryRateLimiter,
};
