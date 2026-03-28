const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');
const { attachPagination } = require('../../../middleware/validation');

const createUsersRouter = ({ authMiddleware, useCases }) => {
  const router = express.Router();

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
    const user = await useCases.getUserById(req.params.userId);
    res.json({ success: true, data: user });
  }));

  // Update user (role, name, email)
  router.put('/:userId', asyncHandler(async (req, res) => {
    const user = await useCases.updateUser(req.params.userId, req.body);
    res.json({ success: true, message: 'User updated successfully', data: user });
  }));

  // Deactivate user
  router.post('/:userId/deactivate', asyncHandler(async (req, res) => {
    // Prevent self-deactivation
    if (Number(req.params.userId) === req.user.id) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'You cannot deactivate your own account',
          statusCode: 400,
        },
      });
    }
    const user = await useCases.deactivateUser(req.params.userId);
    res.json({ success: true, message: 'User deactivated successfully', data: user });
  }));

  // Reactivate user
  router.post('/:userId/reactivate', asyncHandler(async (req, res) => {
    const user = await useCases.reactivateUser(req.params.userId);
    res.json({ success: true, message: 'User reactivated successfully', data: user });
  }));

  // Unlock user account (admin only)
  router.post('/:userId/unlock', asyncHandler(async (req, res) => {
    const user = await useCases.unlockUser(req.params.userId);
    res.json({ success: true, message: 'User account unlocked successfully', data: user });
  }));

  return router;
};

module.exports = {
  createUsersRouter,
};
