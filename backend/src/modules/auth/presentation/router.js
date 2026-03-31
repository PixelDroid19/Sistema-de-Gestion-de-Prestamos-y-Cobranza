const express = require('express');
const { asyncHandler } = require('../../../utils/errorHandler');
const { presentAuthResult, presentProfile } = require('./presenter');

const createAuthRouter = ({ authValidation, authMiddleware, useCases }) => {
  const router = express.Router();

  router.post('/register', authValidation.register, asyncHandler(async (req, res) => {
    const result = await useCases.registerUser({
      actor: null,
      registrationSource: 'public',
      payload: req.body,
    });
    res.status(201).json(presentAuthResult('User registered successfully', result));
  }));

  // Admin-provisioned user registration (admin only)
  router.post('/admin/register', authMiddleware(['admin']), authValidation.adminRegister, asyncHandler(async (req, res) => {
    const result = await useCases.registerUser({
      actor: req.user,
      registrationSource: 'admin',
      payload: req.body,
    });
    res.status(201).json(presentAuthResult('User created successfully', result));
  }));

  router.post('/login', authValidation.login, asyncHandler(async (req, res) => {
    const result = await useCases.loginUser(req.body);
    res.json(presentAuthResult('Login successful', result));
  }));

  // Refresh token endpoint - exchanges old refresh token for new token pair
  router.post('/refresh', asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Refresh token is required' } 
      });
    }
    const result = await useCases.refreshToken({ refreshToken });
    res.json({
      success: true,
      data: result,
    });
  }));

  // Logout endpoint - revokes all refresh tokens for the user
  router.post('/logout', authMiddleware(), asyncHandler(async (req, res) => {
    await useCases.revokeAllUserTokens(req.user.id);
    res.json({ success: true, message: 'Logged out successfully' });
  }));

  router.get('/profile', authMiddleware(), asyncHandler(async (req, res) => {
    const user = await useCases.getProfile(req.user.id);
    res.json(presentProfile(user));
  }));

  router.put('/profile', authMiddleware(), asyncHandler(async (req, res) => {
    const user = await useCases.updateProfile(req.user.id, req.body);
    res.json(presentAuthResult('Profile updated successfully', { user }));
  }));

  router.put('/password', authMiddleware(), asyncHandler(async (req, res) => {
    await useCases.changePassword(req.user.id, req.body);
    res.json({ success: true, message: 'Password changed successfully' });
  }));

  // Register with permissions - requires admin + PERMISSIONS_ASSIGN permission
  router.post('/register-with-permissions', authMiddleware({ permissions: ['PERMISSIONS_ASSIGN'] }), asyncHandler(async (req, res) => {
    const result = await useCases.registerWithPermissions({
      actor: req.user,
      payload: req.body,
    });
    res.status(201).json({ success: true, data: result, message: 'User registered with permissions successfully' });
  }));

  return router;
};

module.exports = {
  createAuthRouter,
};
