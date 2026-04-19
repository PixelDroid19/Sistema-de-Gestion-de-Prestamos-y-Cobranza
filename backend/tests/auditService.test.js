const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

const { createAuditService } = require('@/modules/audit/domain/services/AuditService');
const { runWithRequestContext } = require('@/modules/shared/requestContext');

test('AuditService.log creates audit entry with required fields', async () => {
  const mockRepository = {
    create: mock.fn((data) => Promise.resolve({ id: 1, ...data })),
  };

  const auditService = createAuditService({ auditLogRepository: mockRepository });

  const result = await auditService.log({
    actor: { id: 1, name: 'Test User' },
    action: 'CREATE',
    module: 'customers',
    entityId: '123',
    entityType: 'Customer',
  });

  assert.equal(result.id, 1);
  assert.equal(result.action, 'CREATE');
  assert.equal(result.module, 'CLIENTES');
  assert.equal(result.entityId, '123');
  assert.equal(result.userId, 1);
  assert.equal(result.userName, 'Test User');
  assert.equal(mockRepository.create.mock.callCount(), 1);
});

test('AuditService.log extracts IP from request headers', async () => {
  const mockRepository = {
    create: mock.fn((data) => Promise.resolve({ id: 1, ...data })),
  };

  const auditService = createAuditService({ auditLogRepository: mockRepository });

  const mockReq = {
    headers: {
      'x-forwarded-for': '192.168.1.1, 10.0.0.1',
    },
    connection: { remoteAddress: '127.0.0.1' },
  };

  await auditService.log({
    actor: { id: 1, name: 'Test User' },
    action: 'UPDATE',
    module: 'credits',
    req: mockReq,
  });

  const callData = mockRepository.create.mock.calls[0].arguments[0];
  assert.equal(callData.ip, '192.168.1.1');
  assert.equal(callData.module, 'CREDITOS');
  assert.ok(callData.userAgent === null || typeof callData.userAgent === 'string');
});

test('AuditService.log falls back to request context when req is omitted', async () => {
  const mockRepository = {
    create: mock.fn((data) => Promise.resolve({ id: 1, ...data })),
  };

  const auditService = createAuditService({ auditLogRepository: mockRepository });

  await runWithRequestContext({
    req: {
      headers: {
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
        'user-agent': 'context-agent',
      },
      socket: { remoteAddress: '127.0.0.1' },
    },
  }, async () => {
    await auditService.log({
      actor: { id: 7, name: 'Context User' },
      action: 'LOGIN',
      module: 'auth',
      entityId: 7,
      entityType: 'User',
    });
  });

  const callData = mockRepository.create.mock.calls[0].arguments[0];
  assert.equal(callData.ip, '203.0.113.10');
  assert.equal(callData.userAgent, 'context-agent');
  assert.equal(callData.module, 'AUTH');
});

test('AuditService.log handles missing actor gracefully', async () => {
  const mockRepository = {
    create: mock.fn((data) => Promise.resolve({ id: 1, ...data })),
  };

  const auditService = createAuditService({ auditLogRepository: mockRepository });

  const result = await auditService.log({
    action: 'DELETE',
    module: 'associates',
    entityId: '456',
  });

  assert.equal(result.userId, null);
  assert.equal(result.userName, null);
});

test('AuditService.query passes filters to repository', async () => {
  const mockRepository = {
    findWithFilters: mock.fn(() => Promise.resolve({
      items: [{ id: 1, action: 'CREATE' }],
      totalItems: 1,
    })),
  };

  const auditService = createAuditService({ auditLogRepository: mockRepository });

  const result = await auditService.query({
    userId: 1,
    action: 'CREATE',
    module: 'customers',
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
    limit: 50,
    offset: 0,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.totalItems, 1);
  assert.equal(mockRepository.findWithFilters.mock.callCount(), 1);

  const callArgs = mockRepository.findWithFilters.mock.calls[0].arguments[0];
  assert.equal(callArgs.userId, 1);
  assert.equal(callArgs.action, 'CREATE');
  assert.equal(callArgs.module, 'CLIENTES');
});

test('AuditService.query uses default pagination values', async () => {
  const mockRepository = {
    findWithFilters: mock.fn(() => Promise.resolve({ items: [], totalItems: 0 })),
  };

  const auditService = createAuditService({ auditLogRepository: mockRepository });

  await auditService.query({});

  const callArgs = mockRepository.findWithFilters.mock.calls[0].arguments[0];
  assert.equal(callArgs.limit, 100);
  assert.equal(callArgs.offset, 0);
});

test('AuditService.getStats calls repository getStatsByModule', async () => {
  const mockStats = [
    { module: 'CLIENTES', totalCount: 10, actions: { CREATE: 5, UPDATE: 3, DELETE: 2 } },
    { module: 'CREDITOS', totalCount: 8, actions: { CREATE: 4, UPDATE: 4 } },
  ];

  const mockRepository = {
    getStatsByModule: mock.fn(() => Promise.resolve(mockStats)),
  };

  const auditService = createAuditService({ auditLogRepository: mockRepository });

  const result = await auditService.getStats({
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
  });

  assert.deepEqual(result, [
    { module: 'customers', totalCount: 10, actions: { CREATE: 5, UPDATE: 3, DELETE: 2 } },
    { module: 'credits', totalCount: 8, actions: { CREATE: 4, UPDATE: 4 } },
  ]);
  assert.equal(mockRepository.getStatsByModule.mock.callCount(), 1);
});

test('AuditService.log converts entityId to string', async () => {
  const mockRepository = {
    create: mock.fn((data) => Promise.resolve({ id: 1, ...data })),
  };

  const auditService = createAuditService({ auditLogRepository: mockRepository });

  await auditService.log({
    actor: { id: 1 },
    action: 'CREATE',
    module: 'credits',
    entityId: 123,
  });

  const callData = mockRepository.create.mock.calls[0].arguments[0];
  assert.equal(callData.entityId, '123');
});

test('AuditService.log handles null entityId', async () => {
  const mockRepository = {
    create: mock.fn((data) => Promise.resolve({ id: 1, ...data })),
  };

  const auditService = createAuditService({ auditLogRepository: mockRepository });

  const result = await auditService.log({
    actor: { id: 1 },
    action: 'LOGIN',
    module: 'auth',
    entityId: null,
  });

  assert.equal(result.entityId, null);
  assert.equal(result.module, 'AUTH');
});

test('AuditService.query normalizes filters and presents stored modules as domain keys', async () => {
  const mockRepository = {
    findWithFilters: mock.fn(() => Promise.resolve({
      items: [{ id: 1, action: 'RESTORE', module: 'CLIENTES' }],
      totalItems: 1,
    })),
  };

  const auditService = createAuditService({ auditLogRepository: mockRepository });

  const result = await auditService.query({ module: 'customers', action: 'restore' });

  assert.equal(mockRepository.findWithFilters.mock.calls[0].arguments[0].module, 'CLIENTES');
  assert.equal(mockRepository.findWithFilters.mock.calls[0].arguments[0].action, 'RESTORE');
  assert.equal(result.items[0].module, 'customers');
  assert.equal(result.items[0].action, 'RESTORE');
});
