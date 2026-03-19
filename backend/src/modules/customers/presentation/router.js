const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createCustomersRouter = ({ customerValidation, authMiddleware, useCases }) => {
  const router = express.Router();

  router.get('/', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const customers = await useCases.listCustomers();
    res.json({ success: true, data: customers, message: 'Customers retrieved successfully' });
  }));

  router.post('/', authMiddleware(['admin']), customerValidation.create, asyncHandler(async (req, res) => {
    const customer = await useCases.createCustomer(req.body);
    res.status(201).json({ success: true, data: customer, message: 'Customer created successfully' });
  }));

  return router;
};

module.exports = {
  createCustomersRouter,
};
