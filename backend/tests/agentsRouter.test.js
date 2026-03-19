const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createAgentsRouter } = require('../src/modules/agents/presentation/router');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const roleAwareAuth = (roles = []) => (req, res, next) => {
  const role = req.headers['x-test-role'] || 'admin';
  if (roles.length > 0 && !roles.includes(role)) {
    res.status(403).json({ success: false, error: { message: 'Access denied', statusCode: 403 } });
    return;
  }

  req.user = { id: 1, role };
  next();
};

const agentValidation = {
  create(req, res, next) {
    next();
  },
};

test('createAgentsRouter serves list and create contract responses', async () => {
  const calls = [];
  const agents = [
    { id: 4, name: 'Ana Agent', email: 'ana.agent@example.com' },
    { id: 3, name: 'Luis Agent', email: 'luis.agent@example.com' },
  ];
  const router = createAgentsRouter({
    agentValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async listAgents() {
        calls.push(['listAgents']);
        return agents;
      },
      async createAgent(payload) {
        calls.push(['createAgent', payload]);
        return { id: 5, ...payload };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const createPayload = {
    name: 'New Agent',
    email: 'new.agent@example.com',
    phone: '+573001112244',
  };

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const createResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: createPayload,
  });

  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.body, {
    success: true,
    count: 2,
    data: agents,
  });
  assert.equal(createResponse.statusCode, 201);
  assert.deepEqual(createResponse.body, {
    success: true,
    message: 'Agent created successfully',
    data: {
      id: 5,
      name: 'New Agent',
      email: 'new.agent@example.com',
      phone: '+573001112244',
    },
  });
  assert.deepEqual(calls, [
    ['listAgents'],
    ['createAgent', createPayload],
  ]);
});

test('createAgentsRouter requires admin access', async () => {
  const router = createAgentsRouter({
    agentValidation,
    authMiddleware: roleAwareAuth,
    useCases: {
      async listAgents() {
        throw new Error('listAgents should not be called');
      },
      async createAgent() {
        throw new Error('createAgent should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'customer' },
  });

  assert.equal(response.statusCode, 403);
});
