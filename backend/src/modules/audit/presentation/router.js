const express = require('express');
const { createAuditController } = require('./auditController');
const { sseStreamHandler, wireSSEEmitter } = require('@/modules/audit/infrastructure/sseEmitter');

/**
 * Create the audit router with admin-only endpoints.
 * @param {{ authMiddleware: Function, useCases: object }} dependencies
 * @returns {import('express').Router}
 */
const createAuditRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

  wireSSEEmitter();

  router.use(authMiddleware({ permissions: ['AUDIT_VIEW_ALL'] }));

  const controller = createAuditController({ useCases });

  router.get('/', controller.getAuditLogs);

  router.get('/stats', controller.getAuditStats);

  router.get('/stream', sseStreamHandler);

  return router;
};

module.exports = {
  createAuditRouter,
};
