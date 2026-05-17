const { EventEmitter } = require('node:events');
const { LOG_SEVERITY } = require('@/modules/shared/logCategories');
const { resolveEventCategory } = require('./eventTypes');
const { getRequestContext } = require('@/modules/shared/requestContext');

/**
 * In-process domain event bus.
 *
 * - Handlers run asynchronously and are error-isolated (a failing handler never
 *   crashes the bus or the calling code).
 * - Context (requestId, traceId, userId, ip) is auto-injected from
 *   AsyncLocalStorage so callers only need to supply domain data.
 * - Category subscribers (`onCategory`) receive events whose resolved category
 *   matches, enabling cross-cutting concerns like audit-bridge and SSE streaming.
 */
class DomainEventBus {
  constructor({ logger } = {}) {
    this._emitter = new EventEmitter();
    this._emitter.setMaxListeners(50);
    this._categoryHandlers = new Map();
    this._logger = logger || console;
  }

  /**
   * Emit a domain event.
   *
   * @param {string} eventType — one of the EVENT_TYPES constants (e.g. `'auth.login.success'`)
   * @param {object} [data={}] — domain-specific payload
   * @param {object} [overrides] — optional `{ category, severity, actor }` overrides
   */
  emit(eventType, data = {}, overrides = {}) {
    const ctx = getRequestContext();
    const category = overrides.category || resolveEventCategory(eventType);
    const severity = overrides.severity || LOG_SEVERITY.INFO;

    const envelope = Object.freeze({
      eventType,
      category,
      severity,
      timestamp: new Date().toISOString(),
      requestId: ctx?.requestId ?? null,
      traceId: ctx?.traceId ?? null,
      userId: overrides.actor?.id ?? ctx?.userId ?? null,
      userRole: overrides.actor?.role ?? ctx?.userRole ?? null,
      ip: ctx?.ip ?? null,
      data,
    });

    // Deliver to type-specific listeners
    this._emitter.emit(eventType, envelope);

    // Deliver to category-wide listeners
    const handlers = this._categoryHandlers.get(category);
    if (handlers) {
      for (const handler of handlers) {
        try {
          const result = handler(envelope);
          if (result && typeof result.catch === 'function') {
            result.catch((err) => this._logHandlerError(eventType, err));
          }
        } catch (err) {
          this._logHandlerError(eventType, err);
        }
      }
    }
  }

  /**
   * Subscribe to a specific event type.
   * @returns {Function} unsubscribe
   */
  on(eventType, handler) {
    const safe = this._wrapSafe(eventType, handler);
    this._emitter.on(eventType, safe);
    return () => this._emitter.off(eventType, safe);
  }

  /**
   * Subscribe to ALL events of a given category (e.g. 'security', 'business').
   * @returns {Function} unsubscribe
   */
  onCategory(category, handler) {
    if (!this._categoryHandlers.has(category)) {
      this._categoryHandlers.set(category, new Set());
    }
    this._categoryHandlers.get(category).add(handler);
    return () => this._categoryHandlers.get(category)?.delete(handler);
  }

  /** Wrap a handler so it never throws into the emitter. */
  _wrapSafe(eventType, handler) {
    return (envelope) => {
      try {
        const result = handler(envelope);
        if (result && typeof result.catch === 'function') {
          result.catch((err) => this._logHandlerError(eventType, err));
        }
      } catch (err) {
        this._logHandlerError(eventType, err);
      }
    };
  }

  _logHandlerError(eventType, err) {
    this._logger.error?.(`[DomainEventBus] Handler error for ${eventType}`, {
      error: err?.message || String(err),
    });
  }
}

// Singleton — one bus per process
const domainEventBus = new DomainEventBus();

module.exports = { DomainEventBus, domainEventBus };
