const express = require('express');
const { asyncHandler } = require('@/utils/errorHandler');
const { attachPagination } = require('@/middleware/validation');

const createAssociatesRouter = ({ associateValidation, authMiddleware, useCases }) => {
  const router = express.Router();
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

  router.get('/', authMiddleware(['admin']), attachPagination(), asyncHandler(async (req, res) => {
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
      res.json({ success: true, count: result.pagination.totalItems, data: { associates: result.items, pagination: result.pagination } });
      return;
    }

    res.json({ success: true, count: result.length, data: { associates: result } });
  }));

  router.post('/', authMiddleware(['admin']), associateValidation.create, asyncHandler(async (req, res) => {
    const associate = await useCases.createAssociate({ actor: req.user, payload: req.body });
    res.status(201).json({ success: true, message: 'Associate created successfully', data: { associate } });
  }));

  router.get('/:id', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const associate = await useCases.getAssociateById(req.params.id);
    res.json({ success: true, data: { associate } });
  }));

  router.patch('/:id', authMiddleware(['admin']), associateValidation.update, asyncHandler(async (req, res) => {
    const associate = await useCases.updateAssociate({ actor: req.user, associateId: req.params.id, payload: req.body });
    res.json({ success: true, message: 'Associate updated successfully', data: { associate } });
  }));

  router.delete('/:id', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    await useCases.deleteAssociate({ actor: req.user, associateId: req.params.id });
    res.json({ success: true, message: 'Associate deleted successfully' });
  }));

  router.get('/:id/portal', authMiddleware(['admin', 'socio']), asyncHandler(async (req, res) => {
    const portal = await useCases.listAssociatePortalSummary({ actor: req.user, associateId: req.params.id });
    res.json({ success: true, data: { portal } });
  }));

  router.get('/portal/me', authMiddleware(['socio']), asyncHandler(async (req, res) => {
    const portal = await useCases.listAssociatePortalSummary({ actor: req.user });
    res.json({ success: true, data: { portal } });
  }));

  router.post('/:id/contributions', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const contribution = await useCases.createAssociateContribution({ actor: req.user, associateId: req.params.id, payload: req.body });
    res.status(201).json({ success: true, message: 'Associate contribution created successfully', data: { contribution } });
  }));

  router.post('/:id/distributions', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const distribution = await useCases.createProfitDistribution({ actor: req.user, associateId: req.params.id, payload: req.body });
    res.status(201).json({ success: true, message: 'Profit distribution created successfully', data: { distribution } });
  }));

  router.post('/:id/reinvestments', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.createAssociateReinvestment({ actor: req.user, associateId: req.params.id, payload: req.body });
    res.status(201).json({ success: true, message: 'Associate reinvestment created successfully', data: result });
  }));

  router.post('/distributions/proportional', authMiddleware(['admin']), associateValidation.proportionalDistribution, asyncHandler(async (req, res) => {
    const distribution = await useCases.createProportionalProfitDistribution({
      actor: req.user,
      idempotencyKey: resolveIdempotencyKey(req),
      payload: req.body,
    });
    const isReplay = distribution.idempotencyStatus === 'replayed';
    res.status(isReplay ? 200 : 201).json({
      success: true,
      message: isReplay
        ? 'Proportional profit distribution replayed safely'
        : 'Proportional profit distribution created successfully',
      data: { distribution },
    });
  }));

  router.get('/:id/installments', authMiddleware(['admin', 'socio']), asyncHandler(async (req, res) => {
    const result = await useCases.getAssociateInstallments({
      actor: req.user,
      associateId: req.params.id,
    });
    res.json({ success: true, data: { installments: result } });
  }));

  router.post('/:id/installments/:installmentNumber/pay', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.payAssociateInstallment({
      actor: req.user,
      associateId: req.params.id,
      installmentNumber: req.params.installmentNumber,
      payload: req.body,
    });
    res.json({ success: true, message: 'Installment marked as paid', data: { installment: result } });
  }));

  router.get('/:id/calendar-events', authMiddleware(['admin', 'socio']), asyncHandler(async (req, res) => {
    const result = await useCases.getAssociateCalendar({
      actor: req.user,
      associateId: req.params.id,
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
