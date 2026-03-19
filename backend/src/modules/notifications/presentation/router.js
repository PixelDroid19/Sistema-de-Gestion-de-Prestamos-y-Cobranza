const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createNotificationsRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

  router.use(authMiddleware());

  router.get('/', asyncHandler(async (req, res) => {
    res.json(await useCases.getNotifications({ actor: req.user }));
  }));

  router.get('/unread-count', asyncHandler(async (req, res) => {
    res.json(await useCases.getUnreadCount({ actor: req.user }));
  }));

  router.patch('/:notificationId/read', asyncHandler(async (req, res) => {
    res.json(await useCases.markAsRead({ actor: req.user, notificationId: req.params.notificationId }));
  }));

  router.patch('/mark-all-read', asyncHandler(async (req, res) => {
    res.json(await useCases.markAllAsRead({ actor: req.user }));
  }));

  router.delete('/clear', asyncHandler(async (req, res) => {
    res.json(await useCases.clearNotifications({ actor: req.user }));
  }));

  return router;
};

module.exports = {
  createNotificationsRouter,
};
