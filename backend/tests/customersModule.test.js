const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

const {
  createListCustomers,
  createCreateCustomer,
  createListCustomerDocuments,
  createUploadCustomerDocument,
  createDownloadCustomerDocument,
  createRestoreCustomer,
} = require('@/modules/customers/application/useCases');

test('createListCustomers returns repository results in descending business order', async () => {
  const listCustomers = createListCustomers({
    customerRepository: {
      async list() {
        return [{ id: 4 }, { id: 3 }];
      },
    },
  });

  const customers = await listCustomers();
  assert.deepEqual(customers, [{ id: 4 }, { id: 3 }]);
});

test('createListCustomers preserves repository pagination results', async () => {
  const listCustomers = createListCustomers({
    customerRepository: {
      async listPage() {
        return {
          items: [{ id: 4 }, { id: 3 }],
          pagination: { page: 2, pageSize: 2, totalItems: 5, totalPages: 3 },
        };
      },
    },
  });

  const result = await listCustomers({ pagination: { page: 2, pageSize: 2 } });

  assert.deepEqual(result, {
    items: [{ id: 4 }, { id: 3 }],
    pagination: { page: 2, pageSize: 2, totalItems: 5, totalPages: 3 },
  });
});

test('createListCustomers enriches rows with linked loan summary fields when available', async () => {
  const listCustomers = createListCustomers({
    customerRepository: {
      async list() {
        return [
          { id: 7, name: 'Ana Customer' },
          { id: 8, name: 'Luis Customer' },
        ];
      },
      async attachLoanSummaries(customers) {
        return customers.map((customer) => ({
          ...customer,
          loanCount: customer.id === 7 ? 2 : 0,
          activeLoans: customer.id === 7 ? 1 : 0,
          loanSummary: {
            totalLoans: customer.id === 7 ? 2 : 0,
            activeLoans: customer.id === 7 ? 1 : 0,
            totalOutstandingBalance: customer.id === 7 ? 450 : 0,
            latestLoanId: customer.id === 7 ? 91 : null,
            latestLoanStatus: customer.id === 7 ? 'approved' : null,
          },
        }))
      },
    },
  });

  const customers = await listCustomers();

  assert.deepEqual(customers, [
    {
      id: 7,
      name: 'Ana Customer',
      loanCount: 2,
      activeLoans: 1,
      loanSummary: {
        totalLoans: 2,
        activeLoans: 1,
        totalOutstandingBalance: 450,
        latestLoanId: 91,
        latestLoanStatus: 'approved',
      },
    },
    {
      id: 8,
      name: 'Luis Customer',
      loanCount: 0,
      activeLoans: 0,
      loanSummary: {
        totalLoans: 0,
        activeLoans: 0,
        totalOutstandingBalance: 0,
        latestLoanId: null,
        latestLoanStatus: null,
      },
    },
  ]);
});

test('createCreateCustomer delegates persistence to the repository', async () => {
  const createCustomer = createCreateCustomer({
    customerRepository: {
      async create(payload) {
        return { id: 10, ...payload };
      },
    },
  });

  const customer = await createCustomer({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'New Customer',
      email: 'new@example.com',
      phone: '+573001112244',
    },
  });

  assert.equal(customer.id, 10);
  assert.equal(customer.email, 'new@example.com');
});

test('createCreateCustomer repairs customer id sequence drift and retries once on primary-key conflict', async () => {
  const attempts = [];
  let syncCalls = 0;
  const createCustomer = createCreateCustomer({
    customerRepository: {
      async create(payload) {
        attempts.push(payload.email);

        if (attempts.length === 1) {
          const error = new Error('duplicate key value violates unique constraint "Customers_pkey"');
          error.name = 'SequelizeUniqueConstraintError';
          error.parent = { constraint: 'Customers_pkey' };
          throw error;
        }

        return { id: 37, ...payload };
      },
      async syncPrimaryKeySequence() {
        syncCalls += 1;
      },
    },
  });

  const customer = await createCustomer({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'Recovered Customer',
      email: 'recovered@example.com',
      phone: '+573001112288',
    },
  });

  assert.equal(syncCalls, 1);
  assert.deepEqual(attempts, ['recovered@example.com', 'recovered@example.com']);
  assert.equal(customer.id, 37);
});

test('createCreateCustomer does not retry non-primary-key unique conflicts', async () => {
  let syncCalls = 0;
  const createCustomer = createCreateCustomer({
    customerRepository: {
      async create() {
        const error = new Error('duplicate key value violates unique constraint "Customers_email_key"');
        error.name = 'SequelizeUniqueConstraintError';
        error.parent = { constraint: 'Customers_email_key' };
        error.errors = [{ path: 'email', message: 'email must be unique', value: 'dup@example.com' }];
        throw error;
      },
      async syncPrimaryKeySequence() {
        syncCalls += 1;
      },
    },
  });

  await assert.rejects(() => createCustomer({
    actor: { id: 1, role: 'admin' },
    payload: {
      name: 'Duplicate Email',
      email: 'dup@example.com',
      phone: '+573001112299',
    },
  }), (error) => {
    assert.equal(error.name, 'SequelizeUniqueConstraintError');
    return true;
  });

  assert.equal(syncCalls, 0);
});

test('createListCustomerDocuments hides internal documents from customer actors', async () => {
  const listCustomerDocuments = createListCustomerDocuments({
    customerRepository: {
      async findById() {
        return { id: 7 };
      },
      async listDocuments() {
        return [
          { id: 1, customerVisible: true },
          { id: 2, customerVisible: false },
        ];
      },
    },
  });

  const documents = await listCustomerDocuments({ actor: { id: 7, role: 'customer' }, customerId: 7 });
  assert.deepEqual(documents, [{ id: 1, customerVisible: true }]);
});

test('createUploadCustomerDocument persists customer-owned attachment metadata', async () => {
  let createdPayload;
  const uploadCustomerDocument = createUploadCustomerDocument({
    customerRepository: {
      async findById() {
        return { id: 7 };
      },
      async createDocument(payload) {
        createdPayload = payload;
        return { id: 9, ...payload };
      },
    },
    attachmentStorage: {
      toRelativePath() {
        return 'customer-doc.pdf';
      },
      async deleteByAbsolutePath() {},
    },
  });

  const document = await uploadCustomerDocument({
    actor: { id: 2, role: 'admin' },
    customerId: 7,
    file: {
      path: '/tmp/customer-doc.pdf',
      filename: 'customer-doc.pdf',
      originalname: 'Customer Doc.pdf',
      mimetype: 'application/pdf',
      size: 2048,
    },
    metadata: { customerVisible: 'true', category: 'id', description: 'Customer ID' },
  });

  assert.equal(document.id, 9);
  assert.equal(createdPayload.customerId, 7);
  assert.equal(createdPayload.customerVisible, true);
});

test('createDownloadCustomerDocument blocks customers from internal documents', async () => {
  const downloadCustomerDocument = createDownloadCustomerDocument({
    customerRepository: {
      async findById() {
        return { id: 7 };
      },
      async findDocument() {
        return { id: 10, customerVisible: false, storagePath: 'internal.pdf' };
      },
    },
    attachmentStorage: {
      async assertExists() {},
      resolveAbsolutePath(storagePath) {
        return storagePath;
      },
    },
  });

  await assert.rejects(() => downloadCustomerDocument({ actor: { id: 7, role: 'customer' }, customerId: 7, documentId: 10 }));
});

test('createRestoreCustomer restores a soft-deleted customer', async () => {
  const restoreCustomer = createRestoreCustomer({
    customerRepository: {
      async findByIdIncludingDeleted(id) {
        return { id, name: 'Test Customer', email: 'test@example.com', deletedAt: new Date() };
      },
      async restore(id) {
        return 1;
      },
      async findById(id) {
        return { id, name: 'Test Customer', email: 'test@example.com', deletedAt: null };
      },
    },
  });

  const customer = await restoreCustomer({ actor: { id: 1, role: 'admin' }, customerId: 5 });
  assert.equal(customer.id, 5);
  assert.equal(customer.deletedAt, null);
});

test('createRestoreCustomer emits a single restore audit entry when audit is enabled', async () => {
  const mockAuditService = {
    log: mock.fn(() => Promise.resolve({ id: 1 })),
  };

  const restoreCustomer = createRestoreCustomer({
    customerRepository: {
      async findByIdIncludingDeleted(id) {
        return { id, name: 'Test Customer', email: 'test@example.com', deletedAt: new Date() };
      },
      async restore() {
        return 1;
      },
      async findById(id) {
        return { id, name: 'Test Customer', email: 'test@example.com', deletedAt: null };
      },
    },
    auditService: mockAuditService,
  });

  await restoreCustomer({ actor: { id: 1, name: 'Admin', role: 'admin' }, customerId: 5 });

  assert.equal(mockAuditService.log.mock.callCount(), 1);
  const logCall = mockAuditService.log.mock.calls[0].arguments[0];
  assert.equal(logCall.action, 'RESTORE');
  assert.equal(logCall.module, 'customers');
  assert.equal(logCall.entityId, '5');
  assert.equal(logCall.entityType, 'Customer');
});

test('createRestoreCustomer throws NotFoundError for non-existent customer', async () => {
  const restoreCustomer = createRestoreCustomer({
    customerRepository: {
      async findByIdIncludingDeleted() {
        return null;
      },
    },
  });

  await assert.rejects(() => restoreCustomer({ actor: { id: 1, role: 'admin' }, customerId: 999 }), (error) => {
    assert.equal(error.name, 'NotFoundError');
    return true;
  });
});

test('createRestoreCustomer throws AuthorizationError for non-admin actor', async () => {
  const restoreCustomer = createRestoreCustomer({
    customerRepository: {
      async findByIdIncludingDeleted() {
        return { id: 5, deletedAt: new Date() };
      },
    },
  });

  await assert.rejects(() => restoreCustomer({ actor: { id: 2, role: 'customer' }, customerId: 5 }), (error) => {
    assert.equal(error.name, 'AuthorizationError');
    return true;
  });
});

test('createRestoreCustomer throws ValidationError for customer that is not deleted', async () => {
  const restoreCustomer = createRestoreCustomer({
    customerRepository: {
      async findByIdIncludingDeleted(id) {
        return { id, name: 'Test Customer', deletedAt: null };
      },
    },
  });

  await assert.rejects(() => restoreCustomer({ actor: { id: 1, role: 'admin' }, customerId: 5 }), (error) => {
    assert.equal(error.name, 'ValidationError');
    return true;
  });
});
