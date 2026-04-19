const { ValidationError, AuthorizationError } = require('@/utils/errorHandler');
const { AUDIT_MODULES, AUDIT_ACTIONS } = require('@/models/AuditLog');
const {
  normalizeAuditAction,
  normalizeAuditModule,
} = require('@/modules/audit/domain/services/AuditService');

/**
 * Create the use case for retrieving audit logs with filtering and pagination.
 * @param {{ auditService: object }} dependencies
 * @returns {Function}
 */
const createGetAuditLogs = ({ auditService }) => async ({ actor, filters = {} }) => {
  // Only admin users can access audit logs
  if (!actor || actor.role !== 'admin') {
    throw new AuthorizationError('Only admin users can access audit logs');
  }

  const {
    userId,
    action,
    module,
    entityId,
    entityType,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 25,
  } = filters;

  // Validate enum values
  const normalizedAction = action ? normalizeAuditAction(action) : undefined;
  const normalizedModule = module ? normalizeAuditModule(module) : undefined;

  if (normalizedAction && !AUDIT_ACTIONS.includes(normalizedAction)) {
    throw new ValidationError(`Invalid action. Valid actions: ${AUDIT_ACTIONS.join(', ')}`);
  }

  if (normalizedModule && !AUDIT_MODULES.includes(normalizedModule)) {
    throw new ValidationError(`Invalid module. Valid modules: ${AUDIT_MODULES.join(', ')}`);
  }

  const limit = Math.min(Number(pageSize) || 25, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const result = await auditService.query({
    userId: userId ? Number(userId) : undefined,
    action: normalizedAction,
    module: normalizedModule,
    entityId,
    entityType,
    dateFrom,
    dateTo,
    limit,
    offset,
  });

  return {
    items: result.items,
    pagination: {
      page: Number(page),
      pageSize: limit,
      totalItems: result.totalItems,
      totalPages: Math.ceil(result.totalItems / limit) || 0,
    },
  };
};

/**
 * Create the use case for retrieving aggregated audit statistics.
 * @param {{ auditService: object }} dependencies
 * @returns {Function}
 */
const createGetAuditStats = ({ auditService }) => async ({ actor, dateFrom, dateTo }) => {
  // Only admin users can access audit stats
  if (!actor || actor.role !== 'admin') {
    throw new AuthorizationError('Only admin users can access audit statistics');
  }

  const stats = await auditService.getStats({ dateFrom, dateTo });

  // Transform stats into a more usable format
  const statsByModule = stats.reduce((acc, stat) => {
    const moduleName = stat.module;
    if (!acc[moduleName]) {
      acc[moduleName] = {
        module: moduleName,
        totalCount: 0,
        actions: {},
      };
    }
    acc[moduleName].totalCount += Number(stat.count);
    acc[moduleName].actions[stat.action] = Number(stat.count);
    return acc;
  }, {});

  return {
    stats: Object.values(statsByModule),
    dateRange: { dateFrom, dateTo },
  };
};

module.exports = {
  createGetAuditLogs,
  createGetAuditStats,
};
