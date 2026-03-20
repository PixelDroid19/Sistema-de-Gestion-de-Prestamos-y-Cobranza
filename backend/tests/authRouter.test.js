const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createAuthRouter } = require('../src/modules/auth/presentation/router');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const allowAuth = () => (req, res, next) => {
  req.user = { id: 7, role: 'customer' };
  next();
};

const passthroughValidation = {
  register(req, res, next) {
    next();
  },
  adminRegister(req, res, next) {
    next();
  },
  login(req, res, next) {
    next();
  },
};

test('createAuthRouter serves register and login contract responses', async () => {
  const calls = [];
  const router = createAuthRouter({
    authValidation: passthroughValidation,
    authMiddleware: allowAuth,
    useCases: {
      async registerUser(payload) {
        calls.push(['registerUser', payload]);
        const registrationPayload = payload.payload;
        return {
          token: 'register-token',
          user: {
            id: 11,
            name: registrationPayload.name,
            email: registrationPayload.email,
            role: registrationPayload.role,
          },
        };
      },
      async loginUser(payload) {
        calls.push(['loginUser', payload]);
        return {
          token: 'login-token',
          user: {
            id: 11,
            name: 'Ana Customer',
            email: payload.email,
            role: 'customer',
          },
        };
      },
      async getProfile() {
        throw new Error('getProfile should not be called');
      },
      async updateProfile() {
        throw new Error('updateProfile should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const registerPayload = {
    name: 'Ana Customer',
    email: 'ana@example.com',
    password: 'secret123',
    role: 'customer',
  };
  const loginPayload = {
    email: 'ana@example.com',
    password: 'secret123',
  };

  const registerResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/register',
    body: registerPayload,
  });
  const loginResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/login',
    body: loginPayload,
  });

  assert.equal(registerResponse.statusCode, 201);
  assert.deepEqual(registerResponse.body, {
    success: true,
    message: 'User registered successfully',
    data: {
      token: 'register-token',
      user: {
        id: 11,
        name: 'Ana Customer',
        email: 'ana@example.com',
        role: 'customer',
      },
    },
  });
  assert.equal(loginResponse.statusCode, 200);
  assert.deepEqual(loginResponse.body, {
    success: true,
    message: 'Login successful',
    data: {
      token: 'login-token',
      user: {
        id: 11,
        name: 'Ana Customer',
        email: 'ana@example.com',
        role: 'customer',
      },
    },
  });
  assert.deepEqual(calls, [
    ['registerUser', { actor: null, registrationSource: 'public', payload: registerPayload }],
    ['loginUser', loginPayload],
  ]);
});

test('createAuthRouter serves admin registration through the trusted flow contract', async () => {
  const calls = [];
  const adminAwareAuth = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createAuthRouter({
    authValidation: passthroughValidation,
    authMiddleware: adminAwareAuth,
    useCases: {
      async registerUser(payload) {
        calls.push(['registerUser', payload]);
        return {
          token: 'admin-register-token',
          user: {
            id: 22,
            name: payload.payload.name,
            email: payload.payload.email,
            role: payload.payload.role,
          },
        };
      },
      async loginUser() {
        throw new Error('login should not be called');
      },
      async getProfile() {
        throw new Error('getProfile should not be called');
      },
      async updateProfile() {
        throw new Error('updateProfile should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const payload = {
    name: 'Ana Agent',
    email: 'agent@example.com',
    password: 'secret123',
    role: 'agent',
    phone: '+573001112233',
  };

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/admin/register',
    headers: { authorization: 'Bearer valid-token' },
    body: payload,
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body, {
    success: true,
    message: 'User created successfully',
    data: {
      token: 'admin-register-token',
      user: {
        id: 22,
        name: 'Ana Agent',
        email: 'agent@example.com',
        role: 'agent',
      },
    },
  });
  assert.deepEqual(calls, [
    ['registerUser', { actor: { id: 1, role: 'admin' }, registrationSource: 'admin', payload }],
  ]);
});

test('createAuthRouter serves profile read and update happy paths', async () => {
  const calls = [];
  const router = createAuthRouter({
    authValidation: passthroughValidation,
    authMiddleware: allowAuth,
    useCases: {
      async registerUser() {
        throw new Error('register should not be called');
      },
      async loginUser() {
        throw new Error('login should not be called');
      },
      async getProfile(userId) {
        calls.push(['getProfile', userId]);
        return {
          id: userId,
          name: 'Ana Customer',
          email: 'ana@example.com',
          role: 'customer',
        };
      },
      async updateProfile(userId, payload) {
        calls.push(['updateProfile', userId, payload]);
        return {
          id: userId,
          name: payload.name,
          email: payload.email,
          role: 'customer',
        };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const profileResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/profile',
    headers: { authorization: 'Bearer valid-token' },
  });
  const updateResponse = await requestJson(activeServer, {
    method: 'PUT',
    path: '/profile',
    headers: { authorization: 'Bearer valid-token' },
    body: {
      name: 'Ana Maria',
      email: 'ana.maria@example.com',
    },
  });

  assert.equal(profileResponse.statusCode, 200);
  assert.deepEqual(profileResponse.body, {
    success: true,
    data: {
      user: {
        id: 7,
        name: 'Ana Customer',
        email: 'ana@example.com',
        role: 'customer',
      },
    },
  });
  assert.equal(updateResponse.statusCode, 200);
  assert.deepEqual(updateResponse.body, {
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: 7,
        name: 'Ana Maria',
        email: 'ana.maria@example.com',
        role: 'customer',
      },
    },
  });
  assert.deepEqual(calls, [
    ['getProfile', 7],
    ['updateProfile', 7, { name: 'Ana Maria', email: 'ana.maria@example.com' }],
  ]);
});
