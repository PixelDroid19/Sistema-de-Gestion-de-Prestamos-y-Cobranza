const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');

const requestContextStorage = new AsyncLocalStorage();

/**
 * Build an enriched request context with trace identifiers and request metadata.
 * If the incoming request carries an `X-Request-Id` header it is reused (distributed
 * tracing); otherwise a fresh UUID is generated.  `traceId` is always unique per request.
 */
const buildRequestContext = ({ req, res }) => {
  const incomingRequestId = req.headers?.['x-request-id'];
  const requestId = typeof incomingRequestId === 'string' && incomingRequestId.trim()
    ? incomingRequestId.trim()
    : randomUUID();
  const traceId = randomUUID();

  return {
    req,
    res,
    requestId,
    traceId,
    userId: null,
    userRole: null,
    ip: req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || null,
    method: req.method,
    path: req.originalUrl || req.url,
    startTime: Date.now(),
  };
};

/**
 * Run a callback within an isolated request context backed by AsyncLocalStorage.
 * Enriches the context with `requestId`, `traceId`, IP, method, path, and timing.
 */
const runWithRequestContext = (context, callback) => {
  const enriched = buildRequestContext(context);

  // Expose trace headers so clients/frontend can correlate responses
  if (enriched.res && typeof enriched.res.setHeader === 'function') {
    enriched.res.setHeader('X-Request-Id', enriched.requestId);
    enriched.res.setHeader('X-Trace-Id', enriched.traceId);
  }

  return requestContextStorage.run(enriched, callback);
};

/** Return the current request context or null when called outside a request scope. */
const getRequestContext = () => requestContextStorage.getStore() || null;

/** Shorthand — return the raw Express `req` from the current context. */
const getCurrentRequest = () => getRequestContext()?.req || null;

/**
 * Enrich the running context with authenticated user info.
 * Called from the auth middleware after JWT verification succeeds.
 */
const enrichContextWithUser = (user) => {
  const ctx = getRequestContext();
  if (ctx && user) {
    ctx.userId = user.id ?? null;
    ctx.userRole = user.role ?? null;
  }
};

module.exports = {
  runWithRequestContext,
  getRequestContext,
  getCurrentRequest,
  enrichContextWithUser,
};
