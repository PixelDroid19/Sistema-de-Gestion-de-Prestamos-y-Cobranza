const { test, mock, describe } = require('node:test');
const assert = require('node:assert/strict');

const { withAudit, createAuditRouterHelpers } = require('@/modules/audit/application/auditDecorator');

describe('withAudit decorator', () => {
  test('wraps use case and logs audit event on success', async () => {
    const mockAuditService = {
      log: mock.fn(() => Promise.resolve({ id: 1 })),
    };

    const useCase = mock.fn((params) => Promise.resolve({ id: 42, name: 'Test' }));

    const decoratedUseCase = withAudit({
      auditService: mockAuditService,
      action: 'CREATE',
      module: 'test',
      getEntityId: (p) => p?.id,
      getEntityType: () => 'TestEntity',
    })(useCase);

    const result = await decoratedUseCase({ id: 42, actor: { id: 1, name: 'Test User' } });

    assert.equal(result.id, 42);
    assert.equal(useCase.mock.callCount(), 1);
    assert.equal(mockAuditService.log.mock.callCount(), 1);

    const logCall = mockAuditService.log.mock.calls[0].arguments[0];
    assert.equal(logCall.action, 'CREATE');
    assert.equal(logCall.module, 'test');
    assert.equal(logCall.entityId, '42');
    assert.equal(logCall.entityType, 'TestEntity');
    assert.deepEqual(logCall.actor, { id: 1, name: 'Test User' });
  });

  test('does not call audit service when auditService is not provided', async () => {
    const useCase = mock.fn((params) => Promise.resolve({ id: 42 }));

    const decoratedUseCase = withAudit({
      action: 'CREATE',
      module: 'test',
    })(useCase);

    await decoratedUseCase({ id: 42 });

    assert.equal(useCase.mock.callCount(), 1);
  });

  test('extracts entityId from result when not in params', async () => {
    const mockAuditService = {
      log: mock.fn(() => Promise.resolve({ id: 1 })),
    };

    const useCase = mock.fn(() => Promise.resolve({ id: 99, status: 'created' }));

    const decoratedUseCase = withAudit({
      auditService: mockAuditService,
      action: 'CREATE',
      module: 'credits',
    })(useCase);

    await decoratedUseCase({});

    const logCall = mockAuditService.log.mock.calls[0].arguments[0];
    assert.equal(logCall.entityId, '99');
  });

  test('logs UPDATE action with previousData if provided via params', async () => {
    const mockAuditService = {
      log: mock.fn(() => Promise.resolve({ id: 1 })),
    };

    const useCase = mock.fn(() => Promise.resolve({ id: 42, status: 'updated' }));

    const decoratedUseCase = withAudit({
      auditService: mockAuditService,
      action: 'UPDATE',
      module: 'credits',
      getEntityId: (p) => p?.loanId,
    })(useCase);

    await decoratedUseCase({ loanId: 42, previousData: { status: 'pending' } });

    const logCall = mockAuditService.log.mock.calls[0].arguments[0];
    assert.equal(logCall.action, 'UPDATE');
    assert.equal(logCall.entityId, '42');
  });

  test('continues to return result even if audit logging fails', async () => {
    const mockAuditService = {
      log: mock.fn(() => Promise.reject(new Error('Audit failed'))),
    };

    const useCase = mock.fn(() => Promise.resolve({ id: 42 }));

    const decoratedUseCase = withAudit({
      auditService: mockAuditService,
      action: 'CREATE',
      module: 'test',
    })(useCase);

    const result = await decoratedUseCase({ id: 42 });

    assert.equal(result.id, 42);
    assert.equal(useCase.mock.callCount(), 1);
  });
});

describe('createAuditRouterHelpers', () => {
  test('attachAuditContext attaches audit context to request', async () => {
    const mockAuditService = {};
    const helpers = createAuditRouterHelpers({ auditService: mockAuditService });

    const req = { user: { id: 1, name: 'Test', role: 'admin' } };
    const res = {};
    const next = mock.fn();

    helpers.attachAuditContext('CREATE', 'customers')(req, res, next);

    assert.equal(req._auditContext.action, 'CREATE');
    assert.equal(req._auditContext.module, 'customers');
    assert.deepEqual(req._auditContext.actor, { id: 1, name: 'Test', role: 'admin' });
    assert.equal(next.mock.callCount(), 1);
  });

  test('logAudit logs audit event with context from request', async () => {
    const mockAuditService = {
      log: mock.fn(() => Promise.resolve({ id: 1 })),
    };

    const helpers = createAuditRouterHelpers({ auditService: mockAuditService });

    const req = {
      _auditContext: { action: 'UPDATE', module: 'credits', actor: { id: 1, name: 'Admin' } },
      user: { id: 1, name: 'Admin', role: 'admin' },
    };

    await helpers.logAudit(req, { entityId: '123', entityType: 'Loan' });

    assert.equal(mockAuditService.log.mock.callCount(), 1);

    const logCall = mockAuditService.log.mock.calls[0].arguments[0];
    assert.equal(logCall.action, 'UPDATE');
    assert.equal(logCall.module, 'credits');
    assert.equal(logCall.entityId, '123');
    assert.equal(logCall.entityType, 'Loan');
  });

  test('logAudit returns early if no auditService', async () => {
    const helpers = createAuditRouterHelpers({});

    const req = { _auditContext: { action: 'CREATE', module: 'test' } };

    await helpers.logAudit(req, {});

    // No error means it returned early as expected
  });

  test('logAudit returns early if no action in context', async () => {
    const mockAuditService = { log: mock.fn() };
    const helpers = createAuditRouterHelpers({ auditService: mockAuditService });

    const req = { _auditContext: { module: 'test' } };

    await helpers.logAudit(req, {});

    assert.equal(mockAuditService.log.mock.callCount(), 0);
  });
});

describe('Audit injection integration', () => {
  test('customer use cases accept auditService parameter', async () => {
    const { createCreateCustomer } = require('@/modules/customers/application/useCases');

    const mockCustomerRepository = {
      create: mock.fn((data) => Promise.resolve({ id: 1, ...data })),
    };

    const mockAuditService = {
      log: mock.fn(() => Promise.resolve({ id: 1 })),
    };

    // Should not throw when called with auditService
    const createCustomer = createCreateCustomer({
      customerRepository: mockCustomerRepository,
      auditService: mockAuditService,
    });

    assert.ok(typeof createCustomer === 'function');
  });

  test('associate use cases accept auditService parameter', async () => {
    const { createCreateAssociate } = require('@/modules/associates/application/useCases');

    const mockAssociateRepository = {
      create: mock.fn((data) => Promise.resolve({ id: 1, ...data })),
      findConflictingContact: mock.fn(() => Promise.resolve(null)),
    };

    const mockAuditService = {
      log: mock.fn(() => Promise.resolve({ id: 1 })),
    };

    const createAssociate = createCreateAssociate({
      associateRepository: mockAssociateRepository,
      auditService: mockAuditService,
    });

    assert.ok(typeof createAssociate === 'function');
  });

  test('credits use cases accept auditService parameter', async () => {
    const { createCreateLoan } = require('@/modules/credits/application/useCases');

    const mockLoanCreationService = {
      create: mock.fn((data) => Promise.resolve({ id: 1, ...data })),
    };

    const mockAuditService = {
      log: mock.fn(() => Promise.resolve({ id: 1 })),
    };

    const createLoan = createCreateLoan({
      loanCreationService: mockLoanCreationService,
      auditService: mockAuditService,
    });

    assert.ok(typeof createLoan === 'function');
  });
});
