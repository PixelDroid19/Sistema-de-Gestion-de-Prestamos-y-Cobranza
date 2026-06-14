const { LOG_CATEGORY } = require('@/modules/shared/logCategories');

const EVENT_AUDIT_BRIDGE_WIRED = Symbol('credicobranza.eventAuditBridgeWired');

/**
 * Map domain event type prefixes to the AuditLog `module` enum values.
 * Falls back to the prefix itself (uppercased) if no explicit mapping exists.
 */
const EVENT_PREFIX_TO_AUDIT_MODULE = {
  'auth.':         'AUTH',
  'credit.':       'CREDITOS',
  'payment.':      'PAGOS',
  'customer.':     'CLIENTES',
  'associate.':    'SOCIOS',
  'config.':       'CONFIGURACION',
  'user.':         'USUARIOS',
  'notification.': 'NOTIFICACIONES',
  'system.':       'SISTEMA',
};

/**
 * Map domain event type segments to AuditLog `action` enum values.
 * Best-effort: extracts a verb-like suffix from the event type string.
 */
const resolveAuditAction = (eventType) => {
  const parts = eventType.split('.');
  const last = (parts[parts.length - 1] || '').toUpperCase();

  const ACTION_MAP = {
    CREATED: 'CREATE',
    UPDATED: 'UPDATE',
    DELETED: 'DELETE',
    CHANGED: 'UPDATE',
    APPLIED: 'UPDATE',
    PAID: 'CREATE',
    RECORDED: 'CREATE',
    ADDED: 'CREATE',
    COMPLETED: 'UPDATE',
    GENERATED: 'EXPORT',
    SUCCESS: 'LOGIN',
    FAILED: 'REJECT',
    LOCKED: 'UPDATE',
    GRANTED: 'APPROVE',
    REVOKED: 'DELETE',
    DEACTIVATED: 'UPDATE',
    REACTIVATED: 'UPDATE',
    UNLOCKED: 'UPDATE',
  };

  return ACTION_MAP[last] || last;
};

const resolveAuditModule = (eventType) => {
  for (const [prefix, mod] of Object.entries(EVENT_PREFIX_TO_AUDIT_MODULE)) {
    if (eventType.startsWith(prefix)) {
      return mod;
    }
  }
  return eventType.split('.')[0]?.toUpperCase() || 'UNKNOWN';
};

/**
 * Wire the domain event bus to the audit service so that BUSINESS, SECURITY,
 * and AUDIT category events are automatically persisted in the AuditLog table.
 *
 * Call once at bootstrap after both `domainEventBus` and `auditService` are
 * available.
 *
 * @param {{ domainEventBus: import('./domainEventBus').DomainEventBus, auditService: object }} deps
 */
const wireEventAuditBridge = ({ domainEventBus, auditService }) => {
  if (!domainEventBus?.onCategory || !auditService?.log) {
    return; // Audit not wired — skip silently (e.g. in tests without DB).
  }
  if (domainEventBus[EVENT_AUDIT_BRIDGE_WIRED]) {
    return domainEventBus[EVENT_AUDIT_BRIDGE_WIRED];
  }

  const bridgeHandler = async (envelope) => {
    const { eventType, data, userId, userRole, ip, requestId, traceId, severity, category } = envelope;

    try {
      await auditService.log({
        actor: userId ? { id: userId, role: userRole } : null,
        action: resolveAuditAction(eventType),
        module: resolveAuditModule(eventType),
        entityId: data?.entityId ?? data?.loanId ?? data?.customerId ?? data?.associateId ?? data?.userId ?? null,
        entityType: data?.entityType ?? null,
        previousData: data?.previousData ?? null,
        newData: data?.newData ?? data ?? null,
        metadata: {
          eventType,
          category,
          severity,
          requestId,
          traceId,
          ip,
          ...(data?.metadata || {}),
        },
      });
    } catch (err) {
      // Never crash the bus or the caller if audit persistence fails
      const { logger } = require('@/utils/logger');
      logger.error('Audit bridge: failed to persist event', {
        eventType,
        error: err?.message || String(err),
      });
    }
  };

  // Subscribe to the three auditable categories
  const unsubscribers = [LOG_CATEGORY.BUSINESS, LOG_CATEGORY.SECURITY, LOG_CATEGORY.AUDIT]
    .map((cat) => domainEventBus.onCategory(cat, bridgeHandler));
  const unsubscribe = () => {
    unsubscribers.forEach((unsub) => unsub?.());
    delete domainEventBus[EVENT_AUDIT_BRIDGE_WIRED];
  };

  Object.defineProperty(domainEventBus, EVENT_AUDIT_BRIDGE_WIRED, {
    configurable: true,
    enumerable: false,
    value: unsubscribe,
  });

  return unsubscribe;
};

module.exports = { wireEventAuditBridge };
