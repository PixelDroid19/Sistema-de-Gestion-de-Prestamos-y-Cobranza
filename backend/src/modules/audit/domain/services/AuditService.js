const { auditLogRepository } = require('../../infrastructure');

/**
 * Extract client IP from request object
 * @param {object} req - Express request object
 * @returns {string|null}
 */
const extractClientIp = (req) => {
  if (!req) return null;
  
  // Check for proxy forwarded IP
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return String(forwardedFor).split(',')[0].trim();
  }
  
  return req.connection?.remoteAddress || req.ip || null;
};

/**
 * Extract user agent from request object
 * @param {object} req - Express request object
 * @returns {string|null}
 */
const extractUserAgent = (req) => {
  if (!req) return null;
  return req.headers['user-agent'] || null;
};

/**
 * Create an audit service singleton for logging and querying audit events.
 * @param {{ auditLogRepository?: object }} [options]
 * @returns {object}
 */
const createAuditService = ({ auditLogRepository: repo } = {}) => {
  const repository = repo || auditLogRepository;

  /**
   * Log an audit event.
   * @param {{ actor?: object, action: string, module: string, entityId?: string, entityType?: string, previousData?: object, newData?: object, metadata?: object, req?: object }} params
   * @returns {Promise<object>}
   */
  const log = async ({ actor, action, module, entityId, entityType, previousData, newData, metadata, req }) => {
    const userId = actor?.id || null;
    const userName = actor?.name || actor?.email || null;
    const ip = extractClientIp(req);
    const userAgent = extractUserAgent(req);

    return repository.create({
      userId,
      userName,
      action,
      module,
      entityId: entityId ? String(entityId) : null,
      entityType,
      previousData: previousData || null,
      newData: newData || null,
      metadata: metadata || null,
      ip,
      userAgent,
    });
  };

  /**
   * Query audit logs with filters.
   * @param {{ userId?: number, action?: string, module?: string, entityId?: string, entityType?: string, dateFrom?: string, dateTo?: string, limit?: number, offset?: number }} filters
   * @returns {Promise<{ items: Array<object>, totalItems: number }>}
   */
  const query = async ({ userId, action, module, entityId, entityType, dateFrom, dateTo, limit = 100, offset = 0 } = {}) => {
    return repository.findWithFilters({
      userId,
      action,
      module,
      entityId,
      entityType,
      dateFrom,
      dateTo,
      limit,
      offset,
    });
  };

  /**
   * Get aggregated audit statistics by module and action.
   * @param {{ dateFrom?: string, dateTo?: string }} [dateRange]
   * @returns {Promise<Array>}
   */
  const getStats = async ({ dateFrom, dateTo } = {}) => {
    return repository.getStatsByModule({ dateFrom, dateTo });
  };

  return {
    log,
    query,
    getStats,
  };
};

// Singleton instance
const auditService = createAuditService();

module.exports = {
  createAuditService,
  auditService,
};
