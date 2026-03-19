const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createAssociatesRouter = ({ associateValidation, authMiddleware, useCases }) => {
  const router = express.Router();

  router.get('/', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const associates = await useCases.listAssociates();
    res.json({ success: true, count: associates.length, data: { associates } });
  }));

  router.post('/', authMiddleware(['admin']), associateValidation.create, asyncHandler(async (req, res) => {
    const associate = await useCases.createAssociate(req.body);
    res.status(201).json({ success: true, message: 'Associate created successfully', data: { associate } });
  }));

  router.get('/:id', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const associate = await useCases.getAssociateById(req.params.id);
    res.json({ success: true, data: { associate } });
  }));

  router.patch('/:id', authMiddleware(['admin']), associateValidation.update, asyncHandler(async (req, res) => {
    const associate = await useCases.updateAssociate(req.params.id, req.body);
    res.json({ success: true, message: 'Associate updated successfully', data: { associate } });
  }));

  router.delete('/:id', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    await useCases.deleteAssociate(req.params.id);
    res.json({ success: true, message: 'Associate deleted successfully' });
  }));

  return router;
};

module.exports = {
  createAssociatesRouter,
};
