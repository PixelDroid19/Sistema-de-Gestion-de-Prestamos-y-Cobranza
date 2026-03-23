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

  return router;
};

module.exports = {
  createAuthRouter,
};
