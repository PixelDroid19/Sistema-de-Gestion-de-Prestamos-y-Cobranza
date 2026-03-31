const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createAuditRouter } = require('../src/modules/audit/presentation/router');
const { globalErrorHandler } = require('../src/utils/errorHandler');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

test('GET /audits requires admin role', async () => {
  const mockAuditService = {
    query: mock.fn(() => Promise.resolve({ items: [], totalItems: 0 })),
    getStats: mock.fn(() => Promise.resolve([])),
  };

  const mockUseCases = {
    getAuditLogs: mock.fn(({ actor }) => {
      if (actor.role !== 'admin') {
        const error = new Error('Forbidden');
        error.statusCode = 403;
        throw error;
      }
      return Promise.resolve({ items: [], totalItems: 0, pagination: {} });
    }),
    getAuditStats: mock.fn(() => Promise.resolve({ stats: [], dateRange: {} })),
  };

  const allowAuth = (role = 'customer') => (req, res, next) => {
    req.user = { id: 1, role };
    next();
  };

  const router = createAuditRouter({ authMiddleware: () => allowAuth('customer'), useCases: mockUseCases, auditService: mockAuditService });

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
});

test('GET /audits requires admin role', async () => {
  const mockAuditService = {
    query: mock.fn(() => Promise.resolve({ items: [], totalItems: 0 })),
    getStats: mock.fn(() => Promise.resolve([])),
  };

  const mockUseCases = {
    getAuditLogs: mock.fn(({ actor }) => {
      if (actor.role !== 'admin') {
        const error = new Error('Forbidden');
        error.statusCode = 403;
        throw error;
      }
      return Promise.resolve({ items: [], totalItems: 0, pagination: {} });
    }),
    getAuditStats: mock.fn(() => Promise.resolve({ stats: [], dateRange: {} })),
  };

  const allowAuth = (role = 'customer') => (req, res, next) => {
    req.user = { id: 1, role };
    next();
  };

  const router = createAuditRouter({
    authMiddleware: () => allowAuth('customer'),
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
    path: '/?userId=1&action=CREATE&module=customers',
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

test('GET /audits/stats requires admin role', async () => {
  const mockUseCases = {
    getAuditLogs: mock.fn(() => Promise.resolve({ items: [], totalItems: 0, pagination: {} })),
    getAuditStats: mock.fn(({ actor }) => {
      if (!actor || actor.role !== 'admin') {
        throw Object.assign(new Error('Only admin users can access audit statistics'), { statusCode: 403 });
      }
      return Promise.resolve({ stats: [], dateRange: {} });
    }),
  };

  const allowAuth = (role) => (req, res, next) => {
    req.user = { id: 1, role };
    next();
  };

  const router = createAuditRouter({
    authMiddleware: () => allowAuth('customer'),
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

  assert.equal(response.statusCode, 403);
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
