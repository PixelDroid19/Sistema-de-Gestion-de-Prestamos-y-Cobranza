const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createConfigRouter } = require('../src/modules/config/presentation/router');
const { globalErrorHandler } = require('../src/utils/errorHandler');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const allowAdminOnly = (allowedRoles = []) => (req, res, next) => {
  const role = req.headers['x-test-role'] || 'admin';
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ success: false, error: { message: 'Access denied', statusCode: 403 } });
  }

  req.user = { id: 5, role };
  return next();
};

test('createConfigRouter serves payment-method, settings, and catalog contract responses', async () => {
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
      async listPaymentMethodsLegacy() {
        calls.push(['listPaymentMethodsLegacy']);
        return [{ id: 11, nombre: 'Transferencia', activo: true }];
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
        return { roles: ['admin', 'customer', 'socio'] };
      },
      async resolveLateFeePolicyForUser({ userId }) {
        calls.push(['resolveLateFeePolicyForUser', userId]);
        return { userId: Number(userId), source: 'global', policy: { id: 3, dailyRate: '2.50' } };
      },
      async getTnaRateStats() {
        calls.push(['getTnaRateStats']);
        return { totalRates: 2, activeRates: 1 };
      },
      async findTnaRatesByUser({ userId }) {
        calls.push(['findTnaRatesByUser', userId]);
        return { userId: Number(userId), tnaRates: [{ id: 10, annualRate: '48.00' }] };
      },
    },
  }));
  app.use(globalErrorHandler);

  activeServer = await listen(app);

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
  const legacyPaymentMethodsResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/pmconfig',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const saveSettingResponse = await requestJson(activeServer, {
    method: 'PUT',
    path: '/settings/company-name',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { label: 'Nombre legal', value: 'LendFlow SAS', description: 'Exportes' },
  });
  const lateFeeResolveResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/late-fee/resolve',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { userId: 44 },
  });
  const lateFeeByUserResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/late-fee/user/45',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const tnaStatsResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/tna-rates/stats',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
  });
  const tnaByUserResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/tna-rates/user/99',
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
  assert.equal(legacyPaymentMethodsResponse.statusCode, 200);
  assert.equal(saveSettingResponse.statusCode, 200);
  assert.equal(lateFeeResolveResponse.statusCode, 200);
  assert.equal(lateFeeByUserResponse.statusCode, 200);
  assert.equal(tnaStatsResponse.statusCode, 200);
  assert.equal(tnaByUserResponse.statusCode, 200);
  assert.equal(catalogsResponse.statusCode, 200);

  assert.deepEqual(listResponse.body, {
    success: true,
    data: {
      paymentMethods: [{ id: 11, label: 'Transferencia', key: 'transferencia', isActive: true, requiresReference: true, description: '' }],
    },
  });
  assert.equal(createResponse.body.message, 'Payment method created successfully');
  assert.equal(updateResponse.body.message, 'Payment method updated successfully');
  assert.equal(deleteResponse.body.message, 'Payment method deleted successfully');
  assert.deepEqual(legacyPaymentMethodsResponse.body, {
    success: true,
    data: {
      paymentMethods: [{ id: 11, nombre: 'Transferencia', activo: true }],
    },
  });
  assert.equal(saveSettingResponse.body.message, 'Setting saved successfully');
  assert.deepEqual(lateFeeResolveResponse.body, {
    success: true,
    data: {
      userId: 44,
      source: 'global',
      policy: { id: 3, dailyRate: '2.50' },
    },
  });
  assert.equal(lateFeeByUserResponse.body.data.userId, 45);
  assert.deepEqual(tnaStatsResponse.body, {
    success: true,
    data: {
      totalRates: 2,
      activeRates: 1,
    },
  });
  assert.deepEqual(tnaByUserResponse.body, {
    success: true,
    data: {
      userId: 99,
      tnaRates: [{ id: 10, annualRate: '48.00' }],
    },
  });
  assert.deepEqual(catalogsResponse.body, {
    success: true,
    data: {
      catalogs: { roles: ['admin', 'customer', 'socio'] },
    },
  });
  assert.deepEqual(calls, [
    ['listPaymentMethods'],
    ['createPaymentMethod', createPayload],
    ['updatePaymentMethod', '12', { label: 'Transferencia editada', isActive: false }],
    ['deletePaymentMethod', '12'],
    ['listSettings'],
    ['listPaymentMethodsLegacy'],
    ['upsertSetting', 'company-name', { label: 'Nombre legal', value: 'LendFlow SAS', description: 'Exportes' }],
    ['resolveLateFeePolicyForUser', 44],
    ['resolveLateFeePolicyForUser', '45'],
    ['getTnaRateStats'],
    ['findTnaRatesByUser', '99'],
    ['listAdminCatalogs'],
  ]);
});

test('createConfigRouter denies non-admin access without invoking config use cases', async () => {
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
    },
  }));

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/payment-methods',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'customer' },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(invoked, false);
  assert.deepEqual(response.body, {
    success: false,
    error: {
      message: 'Access denied',
      statusCode: 403,
    },
  });
});
