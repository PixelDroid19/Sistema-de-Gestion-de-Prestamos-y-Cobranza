const { auditLogRepository } = require('@/modules/audit/infrastructure');
const { getCurrentRequest } = require('@/modules/shared/requestContext');

const AUDIT_MODULE_ALIASES = new Map([
  ['credits', 'CREDITOS'],
  ['creditos', 'CREDITOS'],
  ['customers', 'CLIENTES'],
  ['clientes', 'CLIENTES'],
  ['payments', 'PAGOS'],
  ['pagos', 'PAGOS'],
  ['associates', 'SOCIOS'],
  ['socios', 'SOCIOS'],
  ['reports', 'REPORTES'],
  ['reportes', 'REPORTES'],
  ['users', 'USUARIOS'],
  ['usuarios', 'USUARIOS'],
  ['permissions', 'PERMISOS'],
  ['permisos', 'PERMISOS'],
  ['audit', 'AUDITORÍA'],
  ['audits', 'AUDITORÍA'],
  ['auditoria', 'AUDITORÍA'],
  ['auditoría', 'AUDITORÍA'],
  ['auth', 'AUTH'],
]);

const AUDIT_MODULE_REVERSE_ALIASES = new Map([
  ['CREDITOS', 'credits'],
  ['CLIENTES', 'customers'],
  ['PAGOS', 'payments'],
  ['SOCIOS', 'associates'],
  ['REPORTES', 'reports'],
  ['USUARIOS', 'users'],
  ['PERMISOS', 'permissions'],
  ['AUDITORÍA', 'audit'],
  ['AUTH', 'auth'],
]);

const normalizeAuditModule = (module) => {
  const normalizedModule = String(module || '').trim();
  if (!normalizedModule) {
    return normalizedModule;
  }

  return AUDIT_MODULE_ALIASES.get(normalizedModule.toLowerCase()) || normalizedModule.toUpperCase();
};

const normalizeAuditAction = (action) => String(action || '').trim().toUpperCase();

const presentAuditModule = (module) => {
  const normalizedModule = String(module || '').trim();
  if (!normalizedModule) {
    return normalizedModule;
  }

  return AUDIT_MODULE_REVERSE_ALIASES.get(normalizedModule.toUpperCase()) || normalizedModule.toLowerCase();
};

const presentAuditRecord = (record) => {
  if (!record || typeof record !== 'object') {
    return record;
  }

  const presentedRecord = { ...record };

  if (Object.prototype.hasOwnProperty.call(record, 'action')) {
    presentedRecord.action = normalizeAuditAction(record.action);
  }

  if (Object.prototype.hasOwnProperty.call(record, 'module')) {
    presentedRecord.module = presentAuditModule(record.module);
  }

  return presentedRecord;
};

/**
 * Extract client IP from request object
 * @param {object} req - Express request object
 * @returns {string|null}
 */
const extractClientIp = (req) => {
  if (!req) return null;
  
  // Check for proxy forwarded IP
  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (forwardedFor) {
    return String(forwardedFor).split(',')[0].trim();
  }
  
  return req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || null;
};

/**
 * Extract user agent from request object
 * @param {object} req - Express request object
 * @returns {string|null}
 */
const extractUserAgent = (req) => {
  if (!req) return null;
  return req.headers?.['user-agent'] || null;
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
    const resolvedRequest = req || getCurrentRequest();
    const userId = actor?.id || null;
    const userName = actor?.name || actor?.email || null;
    const ip = extractClientIp(resolvedRequest);
    const userAgent = extractUserAgent(resolvedRequest);

    return repository.create({
      userId,
      userName,
      action: normalizeAuditAction(action),
      module: normalizeAuditModule(module),
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
    const result = await repository.findWithFilters({
      userId,
      action: action ? normalizeAuditAction(action) : action,
      module: module ? normalizeAuditModule(module) : module,
      entityId,
      entityType,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    return {
      ...result,
      items: Array.isArray(result?.items) ? result.items.map((item) => presentAuditRecord(item)) : [],
    };
  };

  /**
   * Get aggregated audit statistics by module and action.
   * @param {{ dateFrom?: string, dateTo?: string }} [dateRange]
   * @returns {Promise<Array>}
   */
  const getStats = async ({ dateFrom, dateTo } = {}) => {
    const stats = await repository.getStatsByModule({ dateFrom, dateTo });

    return Array.isArray(stats)
      ? stats.map((stat) => presentAuditRecord(stat))
      : [];
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
  normalizeAuditAction,
  normalizeAuditModule,
  presentAuditModule,
};
