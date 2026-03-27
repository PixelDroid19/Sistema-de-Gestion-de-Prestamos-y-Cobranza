/**
 * Manual implementation of a Rate Limiter to avoid dependencies on external packages
 * in environments with npm installation issues.
 */

const createSimpleRateLimiter = ({ windowMs, max, message }) => {
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

// Global limiter: 100 requests per 1 minute per IP
const globalLimiter = createSimpleRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Demasiadas peticiones desde esta IP. Intente de nuevo en un minuto.',
});

// Auth limiter: 5 attempts per 15 minutes
const authLimiter = createSimpleRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos de acceso fallidos. Por favor, espere 15 minutos.',
});

// Payments limiter: 3 payments per minute
const paymentLimiter = createSimpleRateLimiter({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Operación de pago en curso o demasiados intentos. Por favor, espere.',
});

// Workbench limiter: 10 simulations per 5 minutes
const workbenchLimiter = createSimpleRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Límite de simulaciones de grafo alcanzado. Por favor, espere.',
});

module.exports = {
  globalLimiter,
  authLimiter,
  paymentLimiter,
  workbenchLimiter,
};
