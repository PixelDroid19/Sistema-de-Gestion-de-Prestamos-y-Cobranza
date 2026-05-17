const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createAuditRouter } = require('@/modules/audit/presentation/router');
const { globalErrorHandler } = require('@/utils/errorHandler');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

test('GET /audits allows employee actors already authorized with AUDIT_VIEW_ALL', async () => {
  const mockAuditService = {
    query: mock.fn(() => Promise.resolve({ items: [], totalItems: 0 })),
    getStats: mock.fn(() => Promise.resolve([])),
  };

  const mockUseCases = {
    getAuditLogs: mock.fn(({ actor }) => {
      assert.equal(actor.role, 'employee');
      return Promise.resolve({ items: [], totalItems: 0, pagination: {} });
    }),
    getAuditStats: mock.fn(() => Promise.resolve({ stats: [], dateRange: {} })),
  };

  const allowAuth = (role = 'employee') => (req, res, next) => {
    req.user = { id: 1, role };
    next();
  };

  const router = createAuditRouter({ authMiddleware: () => allowAuth('employee'), useCases: mockUseCases, auditService: mockAuditService });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(mockUseCases.getAuditLogs.mock.callCount(), 1);
});

test('GET /audits wires audit view permission to the auth middleware', async () => {
  const mockAuditService = {
    query: mock.fn(() => Promise.resolve({ items: [], totalItems: 0 })),
    getStats: mock.fn(() => Promise.resolve([])),
  };

  const mockUseCases = {
    getAuditLogs: mock.fn(() => Promise.resolve({ items: [], totalItems: 0, pagination: {} })),
    getAuditStats: mock.fn(() => Promise.resolve({ stats: [], dateRange: {} })),
  };

  let authOptions;
  const authMiddleware = (options) => {
    authOptions = options;
    return (req, res, next) => {
      req.user = { id: 1, role: 'employee' };
      next();
    };
  };

  const router = createAuditRouter({
    authMiddleware,
    useCases: mockUseCases,
    auditService: mockAuditService,
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.deepEqual(authOptions, { permissions: ['AUDIT_VIEW_ALL'] });
  assert.equal(response.statusCode, 200);
});

test('GET /audits rejects when the permission middleware denies access', async () => {
  const mockAuditService = {
    query: mock.fn(() => Promise.resolve({ items: [], totalItems: 0 })),
    getStats: mock.fn(() => Promise.resolve([])),
  };

  const mockUseCases = {
    getAuditLogs: mock.fn(() => Promise.resolve({ items: [], totalItems: 0, pagination: {} })),
    getAuditStats: mock.fn(() => Promise.resolve({ stats: [], dateRange: {} })),
  };

  const denyAuth = () => (req, res, next) => {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    next(error);
  };

  const router = createAuditRouter({
    authMiddleware: denyAuth,
    useCases: mockUseCases,
    auditService: mockAuditService,
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(mockUseCases.getAuditLogs.mock.callCount(), 0);
});

test('GET /audits returns audit logs for admin', async () => {
  const mockLogs = [
    {
      id: '1',
      userId: 1,
      userName: 'Admin User',
      action: 'CREATE',
      module: 'customers',
      entityId: '123',
      entityType: 'Customer',
      timestamp: '2024-01-15T10:30:00Z',
    },
    {
      id: '2',
      userId: 2,
      userName: 'Other User',
      action: 'UPDATE',
      module: 'credits',
      entityId: '456',
      entityType: 'Loan',
      timestamp: '2024-01-15T11:00:00Z',
    },
  ];

  const mockUseCases = {
    getAuditLogs: mock.fn(() => Promise.resolve({
      items: mockLogs,
      totalItems: 2,
      pagination: { page: 1, pageSize: 25, totalItems: 2, totalPages: 1 },
    })),
    getAuditStats: mock.fn(() => Promise.resolve({ stats: [], dateRange: {} })),
  };

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createAuditRouter({
    authMiddleware: () => allowAuth(),
    useCases: mockUseCases,
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.items.length, 2);
  assert.equal(response.body.data.pagination.totalItems, 2);
});

test('GET /audits passes query filters to use case', async () => {
  const mockUseCases = {
    getAuditLogs: mock.fn(({ filters }) => {
      assert.equal(filters.userId, '1');
      assert.equal(filters.action, 'CREATE');
      assert.equal(filters.module, 'customers');
      assert.equal(filters.ip, '203.0.113.10');
      return Promise.resolve({ items: [], totalItems: 0, pagination: {} });
    }),
    getAuditStats: mock.fn(() => Promise.resolve({ stats: [], dateRange: {} })),
  };

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createAuditRouter({
    authMiddleware: () => allowAuth(),
    useCases: mockUseCases,
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/?userId=1&action=CREATE&module=customers&ip=203.0.113.10',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(mockUseCases.getAuditLogs.mock.callCount(), 1);
});

test('GET /audits/stats returns audit statistics', async () => {
  const mockStats = [
    {
      module: 'customers',
      totalCount: 15,
      actions: { CREATE: 10, UPDATE: 3, DELETE: 2 },
    },
    {
      module: 'credits',
      totalCount: 8,
      actions: { CREATE: 5, UPDATE: 3 },
    },
  ];

  const mockUseCases = {
    getAuditLogs: mock.fn(() => Promise.resolve({ items: [], totalItems: 0, pagination: {} })),
    getAuditStats: mock.fn(() => Promise.resolve({
      stats: mockStats,
      dateRange: { dateFrom: '2024-01-01', dateTo: '2024-12-31' },
    })),
  };

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createAuditRouter({
    authMiddleware: () => allowAuth(),
    useCases: mockUseCases,
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/stats',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.stats.length, 2);
  assert.equal(response.body.data.stats[0].module, 'customers');
});

test('GET /audits/stats allows employee actors already authorized with AUDIT_VIEW_ALL', async () => {
  const mockUseCases = {
    getAuditLogs: mock.fn(() => Promise.resolve({ items: [], totalItems: 0, pagination: {} })),
    getAuditStats: mock.fn(({ actor }) => {
      assert.equal(actor.role, 'employee');
      return Promise.resolve({ stats: [], dateRange: {} });
    }),
  };

  const allowAuth = (role) => (req, res, next) => {
    req.user = { id: 1, role };
    next();
  };

  const router = createAuditRouter({
    authMiddleware: () => allowAuth('employee'),
    useCases: mockUseCases,
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/stats',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(mockUseCases.getAuditStats.mock.callCount(), 1);
});

test('GET /audits/stats passes date range filters', async () => {
  const mockUseCases = {
    getAuditLogs: mock.fn(() => Promise.resolve({ items: [], totalItems: 0, pagination: {} })),
    getAuditStats: mock.fn(({ dateFrom, dateTo }) => {
      assert.equal(dateFrom, '2024-01-01');
      assert.equal(dateTo, '2024-12-31');
      return Promise.resolve({ stats: [], dateRange: { dateFrom, dateTo } });
    }),
  };

  const allowAuth = () => (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  };

  const router = createAuditRouter({
    authMiddleware: () => allowAuth(),
    useCases: mockUseCases,
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/stats?dateFrom=2024-01-01&dateTo=2024-12-31',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(mockUseCases.getAuditStats.mock.callCount(), 1);
});
