const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { globalErrorHandler, NotFoundError } = require('@/utils/errorHandler');
const { buildModuleRegistry } = require('@/modules');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const loadUseCases = () => {
  try {
    return require('@/modules/operatingExpenses/application/useCases');
  } catch (_error) {
    return {};
  }
};

const loadRouter = () => {
  try {
    return require('@/modules/operatingExpenses/presentation/router');
  } catch (_error) {
    return {};
  }
};

const roleAwareAuth = (config = {}) => (req, res, next) => {
  const role = req.headers['x-test-role'] || 'admin';
  const requiredPermissions = Array.isArray(config?.permissions) ? config.permissions : [];
  if (!['admin', 'employee'].includes(role)) {
    res.status(401).json({ success: false, error: { message: 'Esta cuenta no puede acceder a la plataforma administrativa.', statusCode: 401 } });
    return;
  }

  if (role === 'employee') {
    const granted = String(req.headers['x-test-permissions'] || '').split(',').filter(Boolean);
    const denied = requiredPermissions.filter((permission) => !granted.includes(permission));
    if (denied.length > 0) {
      res.status(403).json({ success: false, error: { message: `Insufficient permissions. Denied: ${denied.join(', ')}`, statusCode: 403 } });
      return;
    }
  }

  req.user = { id: 9, role, name: 'Operador QA' };
  next();
};

test('operating expense use cases create, list, and annul traceable expenses', async () => {
  const {
    createCreateOperatingExpense,
    createListOperatingExpenses,
    createAnnulOperatingExpense,
  } = loadUseCases();

  assert.equal(typeof createCreateOperatingExpense, 'function');
  assert.equal(typeof createListOperatingExpenses, 'function');
  assert.equal(typeof createAnnulOperatingExpense, 'function');

  const calls = [];
  const auditCalls = [];
  const repository = {
    async create(payload) {
      calls.push(['create', payload]);
      return { id: 4, ...payload };
    },
    async listPage(input) {
      calls.push(['listPage', input]);
      return {
        items: [{ id: 4, amount: 250000, status: 'completed' }],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      };
    },
    async findById(id) {
      calls.push(['findById', id]);
      return {
        id,
        status: 'completed',
        async update(payload) {
          calls.push(['update', id, payload]);
          return { id, ...payload };
        },
      };
    },
  };

  const auditService = {
    async log(entry) {
      auditCalls.push(entry);
    },
  };

  const created = await createCreateOperatingExpense({ operatingExpenseRepository: repository, auditService })({
    actor: { id: 9, role: 'admin' },
    payload: {
      amount: '250000.50',
      expenseDate: '2026-05-20',
      category: 'Servicios',
      description: 'Pago de servicios de oficina',
      paymentMethod: 'transfer',
      reference: 'TRX-55',
      notes: 'Mes de mayo',
    },
  });
  const listed = await createListOperatingExpenses({ operatingExpenseRepository: repository })({
    filters: { fromDate: '2026-05-01', toDate: '2026-05-31', status: 'completed' },
    pagination: { page: 1, pageSize: 20, limit: 20, offset: 0 },
  });
  const annulled = await createAnnulOperatingExpense({ operatingExpenseRepository: repository, auditService })({
    actor: { id: 9, role: 'admin' },
    expenseId: 4,
    payload: { reason: 'Registro duplicado' },
  });

  assert.equal(created.amount, 250000.5);
  assert.equal(created.expenseDate.toISOString(), '2026-05-20T00:00:00.000Z');
  assert.equal(created.status, 'completed');
  assert.equal(created.createdByUserId, 9);
  assert.equal(listed.items.length, 1);
  assert.equal(annulled.status, 'annulled');
  assert.equal(annulled.annulledByUserId, 9);
  assert.equal(annulled.annulmentReason, 'Registro duplicado');
  assert.deepEqual(auditCalls.map((entry) => [entry.action, entry.module, entry.entityId, entry.entityType]), [
    ['CREATE', 'operatingExpenses', '4', 'OperatingExpense'],
    ['UPDATE', 'operatingExpenses', '4', 'OperatingExpense'],
  ]);
  assert.deepEqual(calls[1], ['listPage', {
    filters: {
      fromDate: new Date('2026-05-01T00:00:00.000Z'),
      toDate: new Date('2026-05-31T00:00:00.000Z'),
      status: 'completed',
    },
    pagination: { page: 1, pageSize: 20, limit: 20, offset: 0 },
  }]);
});

test('operating expense use cases reject invalid money, dates, missing records and repeated annulments', async () => {
  const {
    createCreateOperatingExpense,
    createAnnulOperatingExpense,
  } = loadUseCases();

  assert.equal(typeof createCreateOperatingExpense, 'function');
  assert.equal(typeof createAnnulOperatingExpense, 'function');

  const createUseCase = createCreateOperatingExpense({
    operatingExpenseRepository: {
      async create(payload) {
        return { id: 1, ...payload };
      },
    },
  });

  await assert.rejects(() => createUseCase({
    actor: { id: 1, role: 'admin' },
    payload: { amount: '1e5', expenseDate: '2026-05-20', category: 'Servicios', description: 'Pago' },
  }), /El monto del gasto debe ser un valor monetario positivo\./);
  await assert.rejects(() => createUseCase({
    actor: { id: 1, role: 'admin' },
    payload: { amount: '1000', expenseDate: '2026-05-20', category: '', description: 'Pago' },
  }), /La categoría del gasto es obligatoria\./);
  await assert.rejects(() => createUseCase({
    actor: { id: 1, role: 'admin' },
    payload: { amount: '1000', expenseDate: '20-05-2026', category: 'Servicios', description: 'Pago' },
  }), /fecha del gasto.*operativa válida/i);

  const missingAnnulUseCase = createAnnulOperatingExpense({
    operatingExpenseRepository: {
      async findById() {
        return null;
      },
    },
  });
  await assert.rejects(() => missingAnnulUseCase({
    actor: { id: 1, role: 'admin' },
    expenseId: 999,
    payload: { reason: 'No existe' },
  }), NotFoundError);

  const repeatedAnnulUseCase = createAnnulOperatingExpense({
    operatingExpenseRepository: {
      async findById() {
        return { id: 3, status: 'annulled' };
      },
    },
  });
  await assert.rejects(() => repeatedAnnulUseCase({
    actor: { id: 1, role: 'admin' },
    expenseId: 3,
    payload: { reason: 'Ya anulado' },
  }), /El gasto operativo ya está anulado\./);

  const missingReasonAnnulUseCase = createAnnulOperatingExpense({
    operatingExpenseRepository: {
      async findById() {
        return {
          id: 4,
          status: 'completed',
          async update() {
            throw new Error('update should not be called without an annulment reason');
          },
        };
      },
    },
  });
  await assert.rejects(() => missingReasonAnnulUseCase({
    actor: { id: 1, role: 'admin' },
    expenseId: 4,
    payload: { reason: '' },
  }), /El motivo de anulación es obligatorio\./);
});

test('operating expense list rejects inverted date ranges before querying repository', async () => {
  const { createListOperatingExpenses } = loadUseCases();
  assert.equal(typeof createListOperatingExpenses, 'function');

  let repositoryCalled = false;
  const listUseCase = createListOperatingExpenses({
    operatingExpenseRepository: {
      async listPage() {
        repositoryCalled = true;
        return { items: [] };
      },
    },
  });

  assert.throws(() => listUseCase({
    filters: { fromDate: '2026-05-31', toDate: '2026-05-01' },
    pagination: { page: 1, pageSize: 20, limit: 20, offset: 0 },
  }), /fecha inicial debe ser anterior o igual a la fecha final/i);
  assert.equal(repositoryCalled, false);
});

test('operating expense list rejects invalid status filters with an operator message', async () => {
  const { createListOperatingExpenses } = loadUseCases();
  assert.equal(typeof createListOperatingExpenses, 'function');

  let repositoryCalled = false;
  const listUseCase = createListOperatingExpenses({
    operatingExpenseRepository: {
      async listPage() {
        repositoryCalled = true;
        return { items: [] };
      },
    },
  });

  assert.throws(() => listUseCase({
    filters: { status: 'archived_internal' },
    pagination: { page: 1, pageSize: 20, limit: 20, offset: 0 },
  }), (error) => {
    assert.equal(error.message, 'El estado del gasto operativo debe ser completado o anulado.');
    return true;
  });
  assert.equal(repositoryCalled, false);
});

test('operating expenses router exposes permission protected list, create and annul endpoints', async () => {
  const { createOperatingExpensesRouter } = loadRouter();
  assert.equal(typeof createOperatingExpensesRouter, 'function');

  const calls = [];
  const app = express();
  app.use(express.json());
  app.use(createOperatingExpensesRouter({
    authMiddleware: roleAwareAuth,
    useCases: {
      async listOperatingExpenses(input) {
        calls.push(['listOperatingExpenses', input]);
        return {
          items: [{ id: 4, amount: 250000, status: 'completed' }],
          pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        };
      },
      async createOperatingExpense(input) {
        calls.push(['createOperatingExpense', input]);
        return { id: 5, amount: 120000, status: 'completed' };
      },
      async annulOperatingExpense(input) {
        calls.push(['annulOperatingExpense', input]);
        return { id: input.expenseId, status: 'annulled' };
      },
    },
  }));
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const employeeDenied = await requestJson(activeServer, {
    path: '/',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'employee' },
  });
  const listResponse = await requestJson(activeServer, {
    path: '/?fromDate=2026-05-01&toDate=2026-05-31&status=completed',
    headers: {
      authorization: 'Bearer valid-token',
      'x-test-role': 'employee',
      'x-test-permissions': 'FINANCE_VIEW_ALL',
    },
  });
  const createResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { amount: '120000', expenseDate: '2026-05-20', category: 'Servicios', description: 'Pago servicios' },
  });
  const annulResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/5/annul',
    headers: { authorization: 'Bearer valid-token', 'x-test-role': 'admin' },
    body: { reason: 'Duplicado' },
  });

  assert.equal(employeeDenied.statusCode, 403);
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.body.data.expenses[0].id, 4);
  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.body.message, 'Gasto operativo registrado correctamente');
  assert.equal(annulResponse.statusCode, 200);
  assert.equal(annulResponse.body.message, 'Gasto operativo anulado correctamente');
  assert.deepEqual(calls[0], ['listOperatingExpenses', {
    filters: { fromDate: '2026-05-01', toDate: '2026-05-31', status: 'completed', employeeId: undefined },
    pagination: { page: 1, pageSize: 25, limit: 25, offset: 0 },
  }]);
  assert.deepEqual(calls[1], ['createOperatingExpense', {
    actor: { id: 9, role: 'admin', name: 'Operador QA' },
    payload: { amount: '120000', expenseDate: '2026-05-20', category: 'Servicios', description: 'Pago servicios' },
  }]);
  assert.deepEqual(calls[2], ['annulOperatingExpense', {
    actor: { id: 9, role: 'admin', name: 'Operador QA' },
    expenseId: 5,
    payload: { reason: 'Duplicado' },
  }]);
});

test('operating expense list filters by employee responsible for the expense', async () => {
  const { createListOperatingExpenses } = loadUseCases();
  const { buildExpenseWhere } = require('@/modules/operatingExpenses/infrastructure/repositories');

  const calls = [];
  const listUseCase = createListOperatingExpenses({
    operatingExpenseRepository: {
      async listPage(input) {
        calls.push(input);
        return { items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } };
      },
    },
  });

  await listUseCase({
    filters: { status: 'completed', employeeId: '7' },
    pagination: { page: 1, pageSize: 20, limit: 20, offset: 0 },
  });

  assert.equal(calls[0].filters.employeeId, 7);
  assert.deepEqual(buildExpenseWhere(calls[0].filters), {
    status: 'completed',
    createdByUserId: 7,
  });

  assert.throws(() => listUseCase({
    filters: { employeeId: 'employee-7' },
    pagination: { page: 1, pageSize: 20, limit: 20, offset: 0 },
  }), /El identificador debe ser válido/i);
});

test('buildModuleRegistry includes operating expenses as a modular financial surface', () => {
  const sharedRuntime = {
    authContext: {
      tokenService: { sign() {}, verify() {} },
      authMiddleware() {
        return (_req, _res, next) => next();
      },
    },
    notificationService: {
      setPushDeliveryDependencies() {},
    },
    registerModulePorts() {},
    getModulePorts() {
      return null;
    },
  };

  const registry = buildModuleRegistry({ sharedRuntime });
  const byName = Object.fromEntries(registry.map((moduleRegistration) => [moduleRegistration.name, moduleRegistration.basePath]));

  assert.equal(byName.operatingExpenses, '/api/operating-expenses');
});
