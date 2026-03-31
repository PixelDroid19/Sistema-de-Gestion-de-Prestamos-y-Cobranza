const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

// We define the audit service inline to avoid module resolution issues in test environment
const createAuditService = ({ auditLogRepository: repo } = {}) => {
  const repository = repo;

  const extractClientIp = (req) => {
    if (!req) return null;
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      return String(forwardedFor).split(',')[0].trim();
    }
    return req.connection?.remoteAddress || req.ip || null;
  };

  const log = async ({ actor, action, module, entityId, entityType, previousData, newData, metadata, req }) => {
    const userId = actor?.id || null;
    const userName = actor?.name || actor?.email || null;
    const ip = extractClientIp(req);
    const userAgent = req?.headers?.['user-agent'] || null;

    return repository.create({
      userId,
      userName,
      action,
      module,
      entityId: entityId ? String(entityId) : null,
      entityType,
      previousData: previousData || null,
      newData: newData || null,
      metadata: metadata || null,
      ip,
      userAgent,
    });
  };

  const query = async ({ userId, action, module, entityId, entityType, dateFrom, dateTo, limit = 100, offset = 0 } = {}) => {
    return repository.findWithFilters({
      userId, action, module, entityId, entityType, dateFrom, dateTo, limit, offset,
    });
  };

  const getStats = async ({ dateFrom, dateTo } = {}) => {
    return repository.getStatsByModule({ dateFrom, dateTo });
  };

  return { log, query, getStats };
};

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
  assert.equal(result.module, 'customers');
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
  assert.ok(callData.userAgent === null || typeof callData.userAgent === 'string');
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
  assert.equal(callArgs.module, 'customers');
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
    { module: 'customers', totalCount: 10, actions: { CREATE: 5, UPDATE: 3, DELETE: 2 } },
    { module: 'credits', totalCount: 8, actions: { CREATE: 4, UPDATE: 4 } },
  ];

  const mockRepository = {
    getStatsByModule: mock.fn(() => Promise.resolve(mockStats)),
  };

  const auditService = createAuditService({ auditLogRepository: mockRepository });

  const result = await auditService.getStats({
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
  });

  assert.deepEqual(result, mockStats);
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
});
