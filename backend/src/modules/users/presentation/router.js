const express = require('express');
const { asyncHandler, ValidationError } = require('@/utils/errorHandler');
const { attachPagination } = require('@/middleware/validation');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');

/**
 * Composes admin-only user account routes from authorization middleware and
 * user-management use cases.
 * @param {{ authMiddleware: Function, useCases: object }} dependencies
 * @returns {import('express').Router} Express router for administrative user management.
 */
const createUsersRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

  /**
   * Validates user route identifiers without accepting decimals, exponents or
   * mixed text, while preserving the string contract used by user use cases.
   * @param {string|number} value
   * @returns {string}
   */
  const parseRequiredUserId = (value) => {
    if (!validateIntegerId(value)) {
      throw new ValidationError(buildInvalidIntegerIdMessage('userId'));
    }

    return String(value).trim();
  };

  // All routes require admin authentication
  router.use(authMiddleware(['admin']));

  // List all users
  router.get('/', attachPagination(), asyncHandler(async (req, res) => {
    const result = await useCases.listUsers({ pagination: req.pagination });
    if (result?.pagination) {
      res.json({ success: true, count: result.pagination.totalItems, data: { users: result.items, pagination: result.pagination } });
      return;
    }

    res.json({ success: true, count: result.length, data: result });
  }));

  // Get single user
  router.get('/:userId', asyncHandler(async (req, res) => {
    const userId = parseRequiredUserId(req.params.userId);
    const user = await useCases.getUserById(userId);
    res.json({ success: true, data: user });
  }));

  // Update user (role, name, email)
  router.put('/:userId', asyncHandler(async (req, res) => {
    const userId = parseRequiredUserId(req.params.userId);
    const user = await useCases.updateUser(userId, req.body);
    res.json({ success: true, message: 'Usuario actualizado correctamente', data: user });
  }));

  // Deactivate user
  router.post('/:userId/deactivate', asyncHandler(async (req, res) => {
    const userId = parseRequiredUserId(req.params.userId);

    // Prevent self-deactivation
    if (Number(userId) === req.user.id) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No puede desactivar su propia cuenta',
          statusCode: 400,
        },
      });
    }
    const user = await useCases.deactivateUser(userId);
    res.json({ success: true, message: 'Usuario desactivado correctamente', data: user });
  }));

  // Reactivate user
  router.post('/:userId/reactivate', asyncHandler(async (req, res) => {
    const userId = parseRequiredUserId(req.params.userId);
    const user = await useCases.reactivateUser(userId);
    res.json({ success: true, message: 'Usuario reactivado correctamente', data: user });
  }));

  // Unlock user account (admin only)
  router.post('/:userId/unlock', asyncHandler(async (req, res) => {
    const userId = parseRequiredUserId(req.params.userId);
    const user = await useCases.unlockUser(userId);
    res.json({ success: true, message: 'Cuenta de usuario desbloqueada correctamente', data: user });
  }));

  return router;
};

module.exports = {
  createUsersRouter,
};
