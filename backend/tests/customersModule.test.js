const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createListCustomers,
  createCreateCustomer,
  createListCustomerDocuments,
  createUploadCustomerDocument,
  createDownloadCustomerDocument,
} = require('../src/modules/customers/application/useCases');

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

test('createCreateCustomer delegates persistence to the repository', async () => {
  const createCustomer = createCreateCustomer({
    customerRepository: {
      async create(payload) {
        return { id: 10, ...payload };
      },
    },
  });

  const customer = await createCustomer({
    name: 'New Customer',
    email: 'new@example.com',
    phone: '+573001112244',
  });

  assert.equal(customer.id, 10);
  assert.equal(customer.email, 'new@example.com');
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
