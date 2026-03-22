const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');
const { attachPagination } = require('../../../middleware/validation');

const createAgentsRouter = ({ agentValidation, authMiddleware, useCases }) => {
  const router = express.Router();

  router.get('/', authMiddleware(['admin']), attachPagination(), asyncHandler(async (req, res) => {
    const result = await useCases.listAgents({ pagination: req.pagination });
    if (result?.pagination) {
      res.json({ success: true, count: result.pagination.totalItems, data: { agents: result.items, pagination: result.pagination } });
      return;
    }

    res.json({ success: true, count: result.length, data: result });
  }));

  router.post('/', authMiddleware(['admin']), agentValidation.create, asyncHandler(async (req, res) => {
    const agent = await useCases.createAgent(req.body);
    res.status(201).json({ success: true, message: 'Agent created successfully', data: agent });
  }));

  return router;
};

module.exports = {
  createAgentsRouter,
};
