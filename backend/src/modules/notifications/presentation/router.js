const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');

const createNotificationsRouter = ({ authMiddleware, notificationValidation, useCases }) => {
  const router = express.Router();

  router.use(authMiddleware());

  router.get('/', asyncHandler(async (req, res) => {
    res.json(await useCases.getNotifications({ actor: req.user }));
  }));

  router.get('/unread-count', asyncHandler(async (req, res) => {
    res.json(await useCases.getUnreadCount({ actor: req.user }));
  }));

  router.put('/:notificationId/read', asyncHandler(async (req, res) => {
    res.json(await useCases.markAsRead({ actor: req.user, notificationId: req.params.notificationId }));
  }));

  router.patch('/mark-all-read', asyncHandler(async (req, res) => {
    res.json(await useCases.markAllAsRead({ actor: req.user }));
  }));

  router.post('/subscriptions', notificationValidation.registerSubscription, asyncHandler(async (req, res) => {
    res.status(201).json(await useCases.registerPushSubscription({ actor: req.user, payload: req.body }));
  }));

  router.delete('/subscriptions', notificationValidation.deleteSubscription, asyncHandler(async (req, res) => {
    res.json(await useCases.deletePushSubscription({ actor: req.user, payload: req.body }));
  }));

  router.delete('/clear', asyncHandler(async (req, res) => {
    res.json(await useCases.clearNotifications({ actor: req.user }));
  }));

  return router;
};

module.exports = {
  createNotificationsRouter,
};
