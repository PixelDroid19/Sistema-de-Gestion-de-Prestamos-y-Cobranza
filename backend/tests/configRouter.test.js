const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createConfigRouter } = require('@/modules/config/presentation/router');
const { globalErrorHandler } = require('@/utils/errorHandler');
const { closeServer, listen, requestJson } = require('./helpers/http');

const listenForTest = async (t, app) => {
  const server = await listen(app);
  t.after(() => closeServer(server));
  return server;
};

const allowAdminOnly = (allowedRoles = []) => (req, res, next) => {
  const role = req.headers['x-test-role'] || 'admin';
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ success: false, error: { message: 'No tienes acceso a esta acción.', statusCode: 403 } });
  }

  req.user = { id: 5, role };
  return next();
};

test('createConfigRouter serves payment-method, settings, and catalog contract responses', async (t) => {
  const calls = [];
  const app = express();

  app.use(express.json());
  app.use(createConfigRouter({
    authMiddleware: allowAdminOnly,
    useCases: {
      async listPaymentMethods() {
        calls.push(['listPaymentMethods']);
        return [{ id: 11, label: 'Transferencia', key: 'transferencia', isActive: true, requiresReference: true, description: '' }];
      },
      async createPaymentMethod(payload) {
        calls.push(['createPaymentMethod', payload]);
        return { id: 12, ...payload };
      },
      async updatePaymentMethod(paymentMethodId, payload) {
        calls.push(['updatePaymentMethod', paymentMethodId, payload]);
        return { id: Number(paymentMethodId), ...payload };
      },
      async deletePaymentMethod(paymentMethodId) {
        calls.push(['deletePaymentMethod', paymentMethodId]);
        return { id: Number(paymentMethodId) };
      },
      async listSettings() {
        calls.push(['listSettings']);
        return [{ id: 21, key: 'company-name', label: 'Nombre de la compania', value: 'LendFlow SAS', description: '' }];
      },
      async upsertSetting(settingKey, payload) {
        calls.push(['upsertSetting', settingKey, payload]);
        return { id: 21, key: settingKey, ...payload };
      },
      async listAdminCatalogs() {
        calls.push(['listAdminCatalogs']);
        return { roles: ['admin', 'employee'] };
      },
      async listRoles() {
        calls.push(['listRoles']);
        return ['admin', 'employee'];
      },
    },
  }));
  app.use(globalErrorHandler);

  const activeServer = await listenForTest(t, app);

  const createPayload = {
    label: 'Transferencia',
    key: 'transferencia',
    requiresReference: true,
    isActive: true,
  };

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/payment-methods',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const createResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/payment-methods',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: createPayload,
  });
  const updateResponse = await requestJson(activeServer, {
    method: 'PUT',
    path: '/payment-methods/12',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { label: 'Transferencia editada', isActive: false },
  });
  const deleteResponse = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/payment-methods/12',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const settingsResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/settings',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const saveSettingResponse = await requestJson(activeServer, {
    method: 'PUT',
    path: '/settings/company-name',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { label: 'Nombre legal', value: 'LendFlow SAS', description: 'Exportes' },
  });
  const rolesResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/roles',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const catalogsResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/catalogs',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(createResponse.statusCode, 201);
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(settingsResponse.statusCode, 200);
  assert.equal(saveSettingResponse.statusCode, 200);
  assert.equal(rolesResponse.statusCode, 200);
  assert.equal(catalogsResponse.statusCode, 200);

  assert.deepEqual(listResponse.body, {
    success: true,
    data: {
      paymentMethods: [{ id: 11, label: 'Transferencia', key: 'transferencia', isActive: true, requiresReference: true, description: '' }],
    },
  });
  assert.equal(createResponse.body.message, 'Método de pago creado correctamente');
  assert.equal(updateResponse.body.message, 'Método de pago actualizado correctamente');
  assert.equal(deleteResponse.body.message, 'Método de pago eliminado correctamente');
  assert.equal(saveSettingResponse.body.message, 'Ajuste guardado correctamente');
  assert.deepEqual(rolesResponse.body, {
    success: true,
    data: {
      roles: ['admin', 'employee'],
    },
  });
  assert.deepEqual(catalogsResponse.body, {
    success: true,
    data: {
      catalogs: { roles: ['admin', 'employee'] },
    },
  });
  assert.deepEqual(calls, [
    ['listPaymentMethods'],
    ['createPaymentMethod', createPayload],
    ['updatePaymentMethod', 12, { label: 'Transferencia editada', isActive: false }],
    ['deletePaymentMethod', 12],
    ['listSettings'],
    ['upsertSetting', 'company-name', { label: 'Nombre legal', value: 'LendFlow SAS', description: 'Exportes' }],
    ['listRoles'],
    ['listAdminCatalogs'],
  ]);
});

test('createConfigRouter lets employees read active payment methods only', async (t) => {
  const calls = [];
  const app = express();

  app.use(express.json());
  app.use(createConfigRouter({
    authMiddleware: allowAdminOnly,
    useCases: {
      async listActivePaymentMethods() {
        calls.push(['listActivePaymentMethods']);
        return [{ id: 31, label: 'Transferencia activa', key: 'transferencia-activa', isActive: true, requiresReference: true, description: '' }];
      },
      async listPaymentMethods() {
        calls.push(['listPaymentMethods']);
        return [];
      },
      async listRoles() {
        return ['admin', 'employee'];
      },
    },
  }));
  app.use(globalErrorHandler);

  const activeServer = await listenForTest(t, app);

  const activeResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/payment-methods/active',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'employee' },
  });
  const adminOnlyResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/payment-methods',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'employee' },
  });

  assert.equal(activeResponse.statusCode, 200);
  assert.deepEqual(activeResponse.body, {
    success: true,
    data: {
      paymentMethods: [{ id: 31, label: 'Transferencia activa', key: 'transferencia-activa', isActive: true, requiresReference: true, description: '' }],
    },
  });
  assert.equal(adminOnlyResponse.statusCode, 403);
  assert.deepEqual(calls, [['listActivePaymentMethods']]);
});

test('createConfigRouter rejects malformed config resource identifiers before executing mutations', async (t) => {
  const calls = [];
  const app = express();

  app.use(express.json());
  app.use(createConfigRouter({
    authMiddleware: allowAdminOnly,
    useCases: {
      async updateRatePolicy(policyId) {
        calls.push(['updateRatePolicy', policyId]);
        return { id: Number(policyId), label: 'Tasa QA' };
      },
      async deleteRatePolicy(policyId) {
        calls.push(['deleteRatePolicy', policyId]);
        return { id: Number(policyId) };
      },
      async updateLateFeePolicy(policyId) {
        calls.push(['updateLateFeePolicy', policyId]);
        return { id: Number(policyId), label: 'Mora QA' };
      },
      async deleteLateFeePolicy(policyId) {
        calls.push(['deleteLateFeePolicy', policyId]);
        return { id: Number(policyId) };
      },
      async updatePaymentMethod(paymentMethodId) {
        calls.push(['updatePaymentMethod', paymentMethodId]);
        return { id: Number(paymentMethodId), label: 'Transferencia QA' };
      },
      async deletePaymentMethod(paymentMethodId) {
        calls.push(['deletePaymentMethod', paymentMethodId]);
        return { id: Number(paymentMethodId) };
      },
      async listRoles() {
        return ['admin', 'employee'];
      },
    },
  }));
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message },
    });
  });

  const activeServer = await listenForTest(t, app);

  const cases = [
    { method: 'PUT', path: '/rate-policies/1e2', field: /número de la política/i, body: { label: 'Tasa QA' } },
    { method: 'DELETE', path: '/rate-policies/abc', field: /número de la política/i },
    { method: 'PUT', path: '/late-fee-policies/7.5', field: /número de la política/i, body: { label: 'Mora QA' } },
    { method: 'DELETE', path: '/late-fee-policies/1e2', field: /número de la política/i },
    { method: 'PUT', path: '/payment-methods/abc', field: /número del método de pago/i, body: { label: 'Transferencia QA' } },
    { method: 'DELETE', path: '/payment-methods/1.5', field: /número del método de pago/i },
  ];

  for (const routeCase of cases) {
    const response = await requestJson(activeServer, {
      method: routeCase.method,
      path: routeCase.path,
      headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
      body: routeCase.body,
    });
    assert.equal(response.statusCode, 400, routeCase.path);
    assert.match(response.body.error.message, routeCase.field);
  }
  assert.deepEqual(calls, []);
});

test('createConfigRouter emits audit entries and notifications for config mutations', async (t) => {
  const auditEntries = [];
  const notifications = [];
  const app = express();

  app.use(express.json());
  app.use(createConfigRouter({
    authMiddleware: allowAdminOnly,
    auditService: {
      async log(entry) {
        auditEntries.push(entry);
      },
    },
    notificationService: {
      async sendNotification(userId, message, type, data) {
        notifications.push({ userId, message, type, data });
      },
    },
    useCases: {
      async createPaymentMethod() {
        return { id: 12, label: 'Transferencia QA', key: 'transferencia-qa' };
      },
      async createLateFeePolicy() {
        return { id: 22, label: 'Mora QA', key: 'mora-qa' };
      },
      async listRoles() {
        return ['admin', 'employee'];
      },
    },
  }));
  app.use(globalErrorHandler);

  const activeServer = await listenForTest(t, app);

  const paymentMethodResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/payment-methods',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { label: 'Transferencia QA' },
  });
  const lateFeeResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/late-fee-policies',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { label: 'Mora QA', annualEffectiveRate: 12, lateFeeMode: 'SIMPLE' },
  });

  assert.equal(paymentMethodResponse.statusCode, 201);
  assert.equal(lateFeeResponse.statusCode, 201);
  assert.deepEqual(auditEntries.map((entry) => [entry.action, entry.module, entry.entityType]), [
    ['CREATE', 'config', 'PaymentMethod'],
    ['CREATE', 'config', 'LateFeePolicy'],
  ]);
  assert.deepEqual(notifications.map((notification) => [notification.userId, notification.type]), [
    [5, 'config_changed'],
    [5, 'config_changed'],
  ]);
  assert.match(notifications[0].message, /Método de pago/);
  assert.match(notifications[1].message, /Política de mora/);
});

test('createConfigRouter denies non-admin access to sensitive configuration without invoking config use cases', async (t) => {
  let invoked = false;
  const app = express();

  app.use(express.json());
  app.use(createConfigRouter({
    authMiddleware: allowAdminOnly,
    useCases: {
      async listPaymentMethods() {
        invoked = true;
        return [];
      },
      async createPaymentMethod() {
        invoked = true;
        return {};
      },
      async updatePaymentMethod() {
        invoked = true;
        return {};
      },
      async deletePaymentMethod() {
        invoked = true;
        return {};
      },
      async listSettings() {
        invoked = true;
        return [];
      },
      async upsertSetting() {
        invoked = true;
        return {};
      },
      async listAdminCatalogs() {
        invoked = true;
        return {};
      },
      async listRoles() {
        invoked = true;
        return [];
      },
    },
  }));

  const activeServer = await listenForTest(t, app);

  const blockedRequests = [
    { role: 'employee', method: 'GET', path: '/rate-policies' },
    { role: 'employee', method: 'POST', path: '/rate-policies', body: { label: 'No permitido', annualEffectiveRate: 1 } },
    { role: 'employee', method: 'PUT', path: '/late-fee-policies/7', body: { label: 'No permitido', annualEffectiveRate: 1 } },
    { role: 'employee', method: 'DELETE', path: '/payment-methods/9' },
    { role: 'customer', method: 'GET', path: '/payment-methods' },
    { role: 'socio', method: 'GET', path: '/settings' },
  ];

  for (const request of blockedRequests) {
    const response = await requestJson(activeServer, {
      method: request.method,
      path: request.path,
      headers: { authorization: 'Bearer valid-token', 'x-test-role': request.role },
      body: request.body,
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.body, {
      success: false,
      error: {
        message: 'No tienes acceso a esta acción.',
        statusCode: 403,
      },
    });
  }

  assert.equal(invoked, false);
});

test('createConfigRouter does not expose legacy /pmconfig', async (t) => {
  let called = false;
  const app = express();

  app.use(express.json());
  app.use(createConfigRouter({
    authMiddleware: allowAdminOnly,
    useCases: {
      async listPaymentMethods() {
        called = true;
        return [];
      },
      async listSettings() {
        called = true;
        return [];
      },
      async listRoles() {
        return ['admin', 'employee'];
      },
      async listAdminCatalogs() {
        return { roles: ['admin', 'employee'] };
      },
    },
  }));
  app.use(globalErrorHandler);

  const activeServer = await listenForTest(t, app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/pmconfig',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(called, false);
  assert.equal(typeof response.body, 'string');
});
