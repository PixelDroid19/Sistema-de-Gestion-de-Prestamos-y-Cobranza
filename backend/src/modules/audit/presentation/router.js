const express = require('express');
const { createAuditController } = require('./auditController');

/**
 * Create the audit router with admin-only endpoints.
 * @param {{ authMiddleware: Function, useCases: object }} dependencies
 * @returns {import('express').Router}
 */
const createAuditRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

  // All audit routes require explicit audit visibility.
  router.use(authMiddleware({ permissions: ['AUDIT_VIEW_ALL'] }));

  const controller = createAuditController({ useCases });

  // GET /api/audits - Get paginated audit logs with filters
  router.get('/', controller.getAuditLogs);

  // GET /api/audits/stats - Get aggregated audit statistics
  router.get('/stats', controller.getAuditStats);

  return router;
};

module.exports = {
  createAuditRouter,
};
