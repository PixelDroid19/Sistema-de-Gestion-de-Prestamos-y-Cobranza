const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const createApp = require('../src/app');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

test('createApp mounts injected routes from the module registry and documents only registered surfaces', async () => {
  const authRouter = express.Router();
  authRouter.get('/profile', (req, res) => {
    res.json({ success: true, source: 'module-registry' });
  });

  const app = createApp({
    sharedRuntime: { id: 'runtime-1' },
    moduleRegistry: [
      {
        name: 'auth',
        basePath: '/api/auth',
        router: authRouter,
      },
    ],
  });

  activeServer = await listen(app);

  const profileResponse = await requestJson(activeServer, {
    path: '/api/auth/profile',
  });
  const docsResponse = await requestJson(activeServer, {
    path: '/api',
  });

  assert.equal(profileResponse.statusCode, 200);
  assert.deepEqual(profileResponse.body, {
    success: true,
    source: 'module-registry',
  });
  assert.equal(docsResponse.statusCode, 200);
  assert.equal(docsResponse.body.endpoints.auth, '/api/auth');
  assert.equal('notifications' in docsResponse.body.endpoints, false);
});

test('createApp forwards all modularized business surfaces from injected module routers', async () => {
  const creditsRouter = express.Router();
  creditsRouter.get('/recovery-roster', (req, res) => {
    res.json({ success: true, surface: 'credits-recovery-roster' });
  });

  const associatesRouter = express.Router();
  associatesRouter.get('/', (req, res) => {
    res.json({ success: true, surface: 'associates' });
  });

  const reportsRouter = express.Router();
  reportsRouter.get('/recovery', (req, res) => {
    res.json({ success: true, surface: 'reports' });
  });

  const notificationsRouter = express.Router();
  notificationsRouter.get('/unread-count', (req, res) => {
    res.json({ success: true, surface: 'notifications' });
  });

  const app = createApp({
    sharedRuntime: { id: 'runtime-2' },
    moduleRegistry: [
      {
        name: 'credits',
        basePath: '/api/loans',
        router: creditsRouter,
      },
      {
        name: 'associates',
        basePath: '/api/associates',
        router: associatesRouter,
      },
      {
        name: 'reports',
        basePath: '/api/reports',
        router: reportsRouter,
      },
      {
        name: 'notifications',
        basePath: '/api/notifications',
        router: notificationsRouter,
      },
    ],
  });

  activeServer = await listen(app);

  const creditsResponse = await requestJson(activeServer, {
    path: '/api/loans/recovery-roster',
  });
  const associatesResponse = await requestJson(activeServer, {
    path: '/api/associates',
  });
  const reportsResponse = await requestJson(activeServer, {
    path: '/api/reports/recovery',
  });
  const notificationsResponse = await requestJson(activeServer, {
    path: '/api/notifications/unread-count',
  });
  const docsResponse = await requestJson(activeServer, {
    path: '/api',
  });

  assert.equal(creditsResponse.statusCode, 200);
  assert.deepEqual(creditsResponse.body, {
    success: true,
    surface: 'credits-recovery-roster',
  });
  assert.equal(associatesResponse.statusCode, 200);
  assert.deepEqual(associatesResponse.body, {
    success: true,
    surface: 'associates',
  });
  assert.equal(reportsResponse.statusCode, 200);
  assert.deepEqual(reportsResponse.body, {
    success: true,
    surface: 'reports',
  });
  assert.equal(notificationsResponse.statusCode, 200);
  assert.deepEqual(notificationsResponse.body, {
    success: true,
    surface: 'notifications',
  });
  assert.equal(docsResponse.statusCode, 200);
  assert.equal(docsResponse.body.endpoints.credits, '/api/loans');
  assert.equal(docsResponse.body.endpoints.associates, '/api/associates');
  assert.equal(docsResponse.body.endpoints.reports, '/api/reports');
  assert.equal(docsResponse.body.endpoints.notifications, '/api/notifications');
});

test('createApp builds the registry from the shared runtime when no registry is injected', async () => {
  const loansRouter = express.Router();
  loansRouter.get('/', (req, res) => {
    res.json({ success: true, surface: 'credits' });
  });

  const sharedRuntime = { id: 'runtime-3' };
  const app = createApp({
    sharedRuntime,
    moduleRegistry: [
      {
        name: 'credits',
        basePath: '/api/loans',
        router: loansRouter,
      },
    ],
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    path: '/api/loans',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    surface: 'credits',
  });
  assert.equal(sharedRuntime.id, 'runtime-3');
});
