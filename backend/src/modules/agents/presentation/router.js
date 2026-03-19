const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createAgentsRouter = ({ agentValidation, authMiddleware, useCases }) => {
  const router = express.Router();

  router.get('/', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const agents = await useCases.listAgents();
    res.json({ success: true, count: agents.length, data: agents });
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
