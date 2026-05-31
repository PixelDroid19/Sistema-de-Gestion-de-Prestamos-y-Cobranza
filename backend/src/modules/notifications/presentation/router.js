const express = require('express');
const { asyncHandler, ValidationError } = require('@/utils/errorHandler');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');

/**
 * Composes authenticated notification routes from auth middleware, validation
 * middleware and notification use cases.
 * @param {{ authMiddleware: Function, notificationValidation: object, useCases: object }} dependencies
 * @returns {import('express').Router} Express router for backoffice notifications.
 */
const createNotificationsRouter = ({ authMiddleware, notificationValidation, useCases }) => {
  const router = express.Router();
  /**
   * Parses notification route identifiers without accepting partial numeric coercion.
   * @param {string|number} value
   * @returns {number}
   */
  const parseNotificationId = (value) => {
    if (!validateIntegerId(value)) {
      throw new ValidationError(buildInvalidIntegerIdMessage('notificationId'));
    }

    return Number(String(value).trim());
  };

  router.use(authMiddleware());

  router.get('/', asyncHandler(async (req, res) => {
    res.json(await useCases.getNotifications({ actor: req.user }));
  }));

  router.get('/unread-count', asyncHandler(async (req, res) => {
    res.json(await useCases.getUnreadCount({ actor: req.user }));
  }));

  router.put('/:notificationId/read', asyncHandler(async (req, res) => {
    const notificationId = parseNotificationId(req.params.notificationId);
    res.json(await useCases.markAsRead({ actor: req.user, notificationId }));
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
