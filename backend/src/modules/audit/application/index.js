const { createGetAuditLogs, createGetAuditStats } = require('./useCases');
const { withAudit, createAuditRouterHelpers } = require('./auditDecorator');

module.exports = {
  createGetAuditLogs,
  createGetAuditStats,
  withAudit,
  createAuditRouterHelpers,
};
