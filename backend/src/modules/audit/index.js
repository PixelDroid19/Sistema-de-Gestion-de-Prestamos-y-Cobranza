const { createModule, resolveAuthContext } = require('../shared');
const { createGetAuditLogs, createGetAuditStats } = require('./application');
const { auditService } = require('./domain/services');
const { createAuditRouter } = require('./presentation');

/**
 * Create the audit module for tracking and querying audit events.
 * @param {{ sharedRuntime?: object }} [options]
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createAuditModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);

  const useCases = {
    getAuditLogs: createGetAuditLogs({ auditService }),
    getAuditStats: createGetAuditStats({ auditService }),
  };

  return createModule({
    name: 'audit',
    basePath: '/api/audits',
    router: createAuditRouter({ authMiddleware, useCases }),
  });
};

module.exports = {
  createAuditModule,
};
