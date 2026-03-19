const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createReportsRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

  router.get('/recovered', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getRecoveredLoans({ actor: req.user }));
  }));

  router.get('/outstanding', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getOutstandingLoans({ actor: req.user }));
  }));

  router.get('/recovery', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    res.json(await useCases.getRecoveryReport({ actor: req.user }));
  }));

  return router;
};

module.exports = {
  createReportsRouter,
};
