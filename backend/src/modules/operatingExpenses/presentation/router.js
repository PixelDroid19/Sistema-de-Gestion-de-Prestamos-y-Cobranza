const express = require('express');
const { attachPagination } = require('@/middleware/validation');
const { asyncHandler, ValidationError } = require('@/utils/errorHandler');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');

const parseRequiredRouteId = (value, fieldName) => {
  if (!validateIntegerId(value)) {
    throw new ValidationError(buildInvalidIntegerIdMessage(fieldName));
  }

  return Number(String(value).trim());
};

/**
 * Composes the administrative HTTP surface for operating expense movements.
 * @param {{ authMiddleware: Function, useCases: object }} dependencies
 * @returns {import('express').Router} Express router for traceable cash outflows.
 */
const createOperatingExpensesRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();
  const requirePermission = (permission) => authMiddleware({ permissions: [permission] });

  router.get('/', requirePermission('FINANCE_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    const filters = {
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      status: req.query.status,
      employeeId: req.query.employeeId || req.query.createdByUserId,
    };
    const result = await useCases.listOperatingExpenses({
      filters,
      pagination: req.pagination,
    });

    res.json({
      success: true,
      count: result.pagination?.totalItems ?? result.items?.length ?? 0,
      data: {
        expenses: result.items || [],
        ...(result.pagination ? { pagination: result.pagination } : {}),
      },
    });
  }));

  router.post('/', requirePermission('FINANCE_CREATE'), asyncHandler(async (req, res) => {
    const expense = await useCases.createOperatingExpense({
      actor: req.user,
      payload: req.body,
    });
    res.status(201).json({
      success: true,
      message: 'Gasto operativo registrado correctamente',
      data: { expense },
    });
  }));

  router.post('/:expenseId/annul', requirePermission('FINANCE_ANNUL'), asyncHandler(async (req, res) => {
    const expenseId = parseRequiredRouteId(req.params.expenseId, 'expenseId');
    const expense = await useCases.annulOperatingExpense({
      actor: req.user,
      expenseId,
      payload: req.body,
    });
    res.json({
      success: true,
      message: 'Gasto operativo anulado correctamente',
      data: { expense },
    });
  }));

  return router;
};

module.exports = {
  createOperatingExpensesRouter,
};
