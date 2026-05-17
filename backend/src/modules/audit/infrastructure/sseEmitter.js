const { domainEventBus, LOG_CATEGORY } = require('@/modules/shared/events');

/**
 * Map of active SSE connections keyed by a unique connection ID.
 * Each entry holds `{ res, userId, role, connectedAt }`.
 * @type {Map<string, { res: import('express').Response, userId: number, role: string, connectedAt: Date }>}
 */
const connections = new Map();

let _nextId = 0;
let _categoryUnsubscribers = [];

/**
 * Send an SSE-formatted event to a single response stream.
 */
const sendSSE = (res, eventName, data) => {
  try {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (_) {
    /** connection already closed — handled by the 'close' handler */
  }
};

/**
 * Broadcast an event envelope to every active SSE connection.
 * Only admin users receive audit-level events.
 */
const broadcast = (envelope) => {
  const { category } = envelope;
  const isAuditEvent = category === LOG_CATEGORY.AUDIT || category === LOG_CATEGORY.SECURITY;

  for (const [, conn] of connections) {
    if (isAuditEvent && conn.role !== 'admin') continue;
    sendSSE(conn.res, 'audit', envelope);
  }
};

/**
 * Wire the SSE emitter to the domain event bus.
 * Call once at module load or at bootstrap.
 */
const wireSSEEmitter = () => {
  if (_categoryUnsubscribers.length > 0) return;

  Object.values(LOG_CATEGORY).forEach((cat) => {
    const unsub = domainEventBus.onCategory(cat, broadcast);
    _categoryUnsubscribers.push(unsub);
  });
};

/**
 * Express middleware that establishes an SSE stream for the calling admin user.
 * Mount at `GET /api/audits/stream`.
 */
const sseStreamHandler = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const connId = String(++_nextId);
  connections.set(connId, {
    res,
    userId: req.user?.id,
    role: req.user?.role,
    connectedAt: new Date(),
  });

  sendSSE(res, 'connected', { connectionId: connId, serverTime: new Date().toISOString() });

  const keepAlive = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch (_) { /* noop */ }
  }, 30_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    connections.delete(connId);
  });
};

/**
 * Get the count of currently active SSE connections (useful for monitoring).
 */
const getActiveConnectionCount = () => connections.size;

module.exports = {
  wireSSEEmitter,
  sseStreamHandler,
  getActiveConnectionCount,
};
