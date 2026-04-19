const { asyncHandler } = require('@/utils/errorHandler');

/**
 * Create the audit controller with handlers for audit log endpoints.
 * @param {{ useCases: object }} dependencies
 * @returns {object}
 */
const createAuditController = ({ useCases }) => {
  const getAuditLogs = asyncHandler(async (req, res) => {
    const { page, pageSize, userId, action, module, entityId, entityType, dateFrom, dateTo } = req.query;

    const result = await useCases.getAuditLogs({
      actor: req.user,
      filters: {
        page,
        pageSize,
        userId,
        action,
        module,
        entityId,
        entityType,
        dateFrom,
        dateTo,
      },
    });

    res.json({ success: true, data: result });
  });

  const getAuditStats = asyncHandler(async (req, res) => {
    const { dateFrom, dateTo } = req.query;

    const result = await useCases.getAuditStats({
      actor: req.user,
      dateFrom,
      dateTo,
    });

    res.json({ success: true, data: result });
  });

  return {
    getAuditLogs,
    getAuditStats,
  };
};

module.exports = {
  createAuditController,
};
