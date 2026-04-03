const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

/**
 * Create credit simulator router
 * @param {{ authMiddleware: function, useCases: object }} deps
 * @returns {import('express').Router}
 */
const createCreditSimulatorRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

  // POST /credit-simulator/calculate - Calculate loan simulation
  router.post('/calculate', authMiddleware(), asyncHandler(async (req, res) => {
    const { principal, term, interestRate, paymentMethod } = req.body;

    // Validate required fields
    if (!principal || principal <= 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Principal must be a positive number' },
      });
    }
    if (!term || term <= 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Term must be a positive number' },
      });
    }
    if (interestRate === undefined || interestRate < 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Interest rate must be non-negative' },
      });
    }

    const result = await useCases.calculateLoan({
      principal: parseFloat(principal),
      term: parseInt(term, 10),
      interestRate: parseFloat(interestRate),
      paymentMethod: paymentMethod || 'french',
    });

    res.json({
      success: true,
      message: 'Loan calculation completed successfully',
      data: { simulation: result },
    });
  }));

  return router;
};

module.exports = {
  createCreditSimulatorRouter,
};
