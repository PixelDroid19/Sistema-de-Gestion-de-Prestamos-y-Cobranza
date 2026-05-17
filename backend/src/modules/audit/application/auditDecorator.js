const { logger } = require('@/utils/logger');

// Lazy-require to avoid circular dependency at load time
let _domainEventBus = null;
const getDomainEventBus = () => {
  if (!_domainEventBus) {
    _domainEventBus = require('@/modules/shared/events').domainEventBus;
  }
  return _domainEventBus;
};

/**
 * Map module + action to a well-known EVENT_TYPE string.
 * Falls back to `<module>.<action>` lowercase.
 */
const ACTION_TO_VERB = {
  CREATE: 'created',
  UPDATE: 'updated',
  DELETE: 'deleted',
  LOGIN: 'login.success',
  LOGOUT: 'logout',
  EXPORT: 'exported',
};

const resolveEventType = (module, action) => {
  const prefix = String(module || 'unknown').toLowerCase();
  const verb = ACTION_TO_VERB[String(action).toUpperCase()] || String(action).toLowerCase();
  return `${prefix}.${verb}`;
};
/**
 * Create an audit decorator that wraps a use case with audit logging.
 * @param {{ auditService: object, action: string, module: string, getEntityId?: Function, getEntityType?: Function }} config
 * @returns {Function} Decorated use case
 */
const withAudit = ({ auditService, action, module, getEntityId, getEntityType }) => {
  return (useCase) => {
    return async (params) => {
      const { req } = params;
      const actor = params.actor || (req?.user ? { id: req.user.id, name: req.user.name, role: req.user.role } : null);

      let previousData = null;
      let newData = null;
      let entityId = null;
      let entityType = null;

      // For update/delete operations, try to get previous state
      if (getEntityId && (action === 'UPDATE' || action === 'DELETE')) {
        try {
          entityId = getEntityId(params);
          entityType = getEntityType ? getEntityType(params) : null;
          // Note: Getting previous data would require the use case to pass it
          // This is a limitation of this approach
        } catch (e) {
          // Ignore errors getting entity ID
        }
      }

      const result = await useCase(params);

      // Log the audit event after successful execution
      if (auditService) {
        try {
          // Extract entity ID from result if available
          if (!entityId && result && typeof result === 'object') {
            entityId = result.id || result.loanId || result.customerId || result.userId || null;
          }
          if (!entityType && getEntityType) {
            entityType = getEntityType(params);
          }

          // Get new data from result for CREATE/UPDATE
          if (action === 'CREATE' || action === 'UPDATE') {
            newData = result && typeof result === 'object' ? result : null;
          }

          await auditService.log({
            actor,
            action,
            module,
            entityId: entityId ? String(entityId) : null,
            entityType,
            previousData,
            newData,
            req,
          });

          // Emit domain event for Winston routing (security/business/technical)
          try {
            getDomainEventBus().emit(resolveEventType(module, action), {
              entityId: entityId ? String(entityId) : null,
              entityType,
              newData,
              previousData,
            });
          } catch (_) {
            // Never fail the operation because of event emission
          }
        } catch (auditError) {
          // Log audit failure but don't fail the main operation
          logger.error('Audit logging failed', { error: auditError.message, action, module });
        }
      }

      return result;
    };
  };
};

/**
 * Create an audit wrapper for router handlers that logs actions after successful response.
 * @param {{ auditService: object }} dependencies
 * @returns {object} Helper functions for audit logging in routes
 */
const createAuditRouterHelpers = ({ auditService }) => {
  /**
   * Middleware to attach audit context to request for later logging.
   */
  const attachAuditContext = (action, module) => {
    return (req, res, next) => {
      req._auditContext = {
        action,
        module,
        actor: req.user ? { id: req.user.id, name: req.user.name, role: req.user.role } : null,
      };
      next();
    };
  };

  /**
   * Log an audit event after a successful operation.
   * Call this after a successful response in the route handler.
   */
  const logAudit = async (req, { action, module, entityId, entityType, previousData, newData }) => {
    if (!auditService) return;

    const actor = req._auditContext?.actor || (req.user ? { id: req.user.id, name: req.user.name, role: req.user.role } : null);
    const auditAction = action || req._auditContext?.action;
    const auditModule = module || req._auditContext?.module;

    if (!auditAction || !auditModule) return;

    await auditService.log({
      actor,
      action: auditAction,
      module: auditModule,
      entityId: entityId ? String(entityId) : null,
      entityType,
      previousData,
      newData,
      req,
    });
  };

  return {
    attachAuditContext,
    logAudit,
  };
};

module.exports = {
  withAudit,
  createAuditRouterHelpers,
};
