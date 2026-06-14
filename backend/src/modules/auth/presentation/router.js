const express = require('express');
const { asyncHandler } = require('@/utils/errorHandler');
const { presentAuthResult, presentProfile } = require('./presenter');
const { authLimiter } = require('@/middleware/rateLimiter');
const { attachPagination } = require('@/middleware/validation');

/**
 * Composes authentication, profile and trusted user-registration routes from
 * validation middleware, authorization middleware and auth use cases.
 * @param {{ authValidation: object, authMiddleware: Function, useCases: object }} dependencies
 * @returns {import('express').Router} Express router for authentication and account access flows.
 */
const createAuthRouter = ({ authValidation, authMiddleware, useCases }) => {
  const router = express.Router();

  router.post('/register', authValidation.register, asyncHandler(async (req, res) => {
    const result = await useCases.registerUser({
      actor: null,
      registrationSource: 'public',
      payload: req.body,
    });
    res.status(201).json(presentAuthResult('Usuario registrado correctamente', result));
  }));

  // Admin-provisioned user registration (admin only)
  router.post('/admin/register', authMiddleware(['admin']), authValidation.adminRegister, asyncHandler(async (req, res) => {
    const result = await useCases.registerUser({
      actor: req.user,
      registrationSource: 'admin',
      payload: req.body,
    });
    res.status(201).json(presentAuthResult('Usuario creado correctamente', result));
  }));

  router.post('/login', authLimiter, authValidation.login, asyncHandler(async (req, res) => {
    const result = await useCases.loginUser(req.body);
    res.json(presentAuthResult('Inicio de sesión correcto', result));
  }));

  router.get('/users', authMiddleware(['admin']), attachPagination(), asyncHandler(async (req, res) => {
    const result = await useCases.listUsers({ pagination: req.pagination });
    if (result?.pagination) {
      res.json({
        success: true,
        count: result.pagination.totalItems,
        data: {
          users: result.items,
          pagination: result.pagination,
        },
      });
      return;
    }

    res.json({ success: true, count: result.length, data: result });
  }));

  // Refresh token endpoint - exchanges old refresh token for new token pair
  router.post('/refresh', authLimiter, asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { message: 'El token de actualización es obligatorio' }
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
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
  }));

  router.get('/profile', authMiddleware(), asyncHandler(async (req, res) => {
    const user = await useCases.getProfile(req.user.id);
    res.json(presentProfile(user));
  }));

  router.put('/profile', authMiddleware(), asyncHandler(async (req, res) => {
    const user = await useCases.updateProfile(req.user.id, req.body);
    res.json(presentAuthResult('Perfil actualizado correctamente', { user }));
  }));

  router.put('/password', authMiddleware(), asyncHandler(async (req, res) => {
    await useCases.changePassword(req.user.id, req.body);
    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  }));

  // Register with permissions - admin only; employees cannot create accounts or assign access.
  router.post('/register-with-permissions', authMiddleware(['admin']), asyncHandler(async (req, res) => {
    const result = await useCases.registerWithPermissions({
      actor: req.user,
      payload: req.body,
    });
    res.status(201).json({ success: true, data: result, message: 'Usuario registrado con permisos correctamente' });
  }));

  return router;
};

module.exports = {
  createAuthRouter,
};
