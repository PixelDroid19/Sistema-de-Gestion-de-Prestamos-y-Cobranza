const express = require('express');
const { asyncHandler, ValidationError } = require('@/utils/errorHandler');
const { attachPagination } = require('@/middleware/validation');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');

/**
 * Composes the administrative associate HTTP surface from validation,
 * authorization middleware and associate use cases.
 * @param {{ associateValidation: object, authMiddleware: Function, useCases: object }} dependencies
 * @returns {import('express').Router} Express router for associate records and financial movements.
 */
const createAssociatesRouter = ({ associateValidation, authMiddleware, useCases }) => {
  const router = express.Router();
  const requirePermission = (permission) => authMiddleware({ permissions: [permission] });
  /**
   * Parses required route identifiers without accepting partial numeric coercion.
   * @param {string|number} value
   * @param {string} fieldName
   * @returns {number}
   */
  const parseRequiredRouteId = (value, fieldName) => {
    if (!validateIntegerId(value)) {
      throw new ValidationError(buildInvalidIntegerIdMessage(fieldName));
    }

    return Number(String(value).trim());
  };
  const resolveIdempotencyKey = (req) => {
    const headerValue = req.headers['idempotency-key'];
    if (typeof headerValue === 'string' && headerValue.trim()) {
      return headerValue.trim();
    }

    if (typeof req.body?.idempotencyKey === 'string' && req.body.idempotencyKey.trim()) {
      return req.body.idempotencyKey.trim();
    }

    return null;
  };

  router.get('/', requirePermission('SOCIOS_VIEW_ALL'), attachPagination(), asyncHandler(async (req, res) => {
    const filters = {
      search: req.query.search,
      status: req.query.status,
    };
    const hasFilters = Object.values(filters).some((value) => value !== undefined);
    const input = {
      pagination: req.pagination,
    };

    if (hasFilters) {
      input.filters = filters;
    }

    const result = await useCases.listAssociates(input);
    if (result?.pagination) {
      res.json({
        success: true,
        count: result.pagination.totalItems,
        data: {
          associates: result.items,
          pagination: result.pagination,
          summary: result.summary,
        },
      });
      return;
    }

    if (result?.items) {
      res.json({
        success: true,
        count: result.items.length,
        data: {
          associates: result.items,
          summary: result.summary,
        },
      });
      return;
    }

    res.json({ success: true, count: result.length, data: { associates: result } });
  }));

  router.post('/', requirePermission('SOCIOS_CREATE'), associateValidation.create, asyncHandler(async (req, res) => {
    const associate = await useCases.createAssociate({ actor: req.user, payload: req.body });
    res.status(201).json({ success: true, message: 'Socio creado correctamente', data: { associate } });
  }));

  router.get('/:id', requirePermission('SOCIOS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const associateId = parseRequiredRouteId(req.params.id, 'associateId');
    const associate = await useCases.getAssociateById(associateId);
    res.json({ success: true, data: { associate } });
  }));

  router.patch('/:id', requirePermission('SOCIOS_UPDATE'), associateValidation.update, asyncHandler(async (req, res) => {
    const associateId = parseRequiredRouteId(req.params.id, 'associateId');
    const associate = await useCases.updateAssociate({ actor: req.user, associateId, payload: req.body });
    res.json({ success: true, message: 'Socio actualizado correctamente', data: { associate } });
  }));

  router.delete('/:id', requirePermission('SOCIOS_DELETE'), asyncHandler(async (req, res) => {
    const associateId = parseRequiredRouteId(req.params.id, 'associateId');
    const associate = await useCases.deleteAssociate({ actor: req.user, associateId });
    res.json({ success: true, message: 'Socio desactivado correctamente', data: { associate } });
  }));

  router.get('/:id/financial-details', requirePermission('SOCIOS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const associateId = parseRequiredRouteId(req.params.id, 'associateId');
    const details = await useCases.getAssociateFinancialDetails({ actor: req.user, associateId });
    res.json({ success: true, data: { details } });
  }));

  router.post('/:id/contributions', requirePermission('SOCIOS_UPDATE'), asyncHandler(async (req, res) => {
    const associateId = parseRequiredRouteId(req.params.id, 'associateId');
    const contribution = await useCases.createAssociateContribution({ actor: req.user, associateId, payload: req.body });
    res.status(201).json({ success: true, message: 'Aporte del socio registrado correctamente', data: { contribution } });
  }));

  router.post('/:id/distributions', requirePermission('SOCIOS_UPDATE'), asyncHandler(async (req, res) => {
    const associateId = parseRequiredRouteId(req.params.id, 'associateId');
    const distribution = await useCases.createProfitDistribution({ actor: req.user, associateId, payload: req.body });
    res.status(201).json({ success: true, message: 'Distribución de utilidad registrada correctamente', data: { distribution } });
  }));

  router.post('/:id/reinvestments', requirePermission('SOCIOS_UPDATE'), asyncHandler(async (req, res) => {
    const associateId = parseRequiredRouteId(req.params.id, 'associateId');
    const result = await useCases.createAssociateReinvestment({ actor: req.user, associateId, payload: req.body });
    res.status(201).json({ success: true, message: 'Reinversión del socio registrada correctamente', data: result });
  }));

  router.post('/distributions/proportional', requirePermission('SOCIOS_UPDATE'), associateValidation.proportionalDistribution, asyncHandler(async (req, res) => {
    const distribution = await useCases.createProportionalProfitDistribution({
      actor: req.user,
      idempotencyKey: resolveIdempotencyKey(req),
      payload: req.body,
    });
    const isReplay = distribution.idempotencyStatus === 'replayed';
    res.status(isReplay ? 200 : 201).json({
      success: true,
      message: isReplay
        ? 'Distribución proporcional de utilidad reutilizada correctamente'
        : 'Distribución proporcional de utilidad registrada correctamente',
      data: { distribution },
    });
  }));

  router.get('/:id/installments', requirePermission('SOCIOS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const associateId = parseRequiredRouteId(req.params.id, 'associateId');
    const result = await useCases.getAssociateInstallments({
      actor: req.user,
      associateId,
    });
    res.json({ success: true, data: { installments: result } });
  }));

  router.post('/:id/installments/:installmentNumber/pay', requirePermission('SOCIOS_UPDATE'), asyncHandler(async (req, res) => {
    const associateId = parseRequiredRouteId(req.params.id, 'associateId');
    const installmentNumber = parseRequiredRouteId(req.params.installmentNumber, 'installmentNumber');
    const result = await useCases.payAssociateInstallment({
      actor: req.user,
      associateId,
      installmentNumber,
      payload: req.body,
    });
    res.json({ success: true, message: 'Cuota del socio marcada como pagada', data: { installment: result } });
  }));

  router.get('/:id/calendar-events', requirePermission('SOCIOS_VIEW_ALL'), asyncHandler(async (req, res) => {
    const associateId = parseRequiredRouteId(req.params.id, 'associateId');
    const result = await useCases.getAssociateCalendar({
      actor: req.user,
      associateId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    res.json({ success: true, data: { calendar: result } });
  }));

  return router;
};

module.exports = {
  createAssociatesRouter,
};
