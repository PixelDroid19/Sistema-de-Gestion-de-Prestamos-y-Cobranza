const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthorizationError } = require('@/utils/errorHandler');

const {
  createListPayments,
  createUpdatePaymentMetadata,
  createCreatePayment,
  createCreatePartialPayment,
  createCreateCapitalPayment,
  createAnnulInstallment,
  createListPaymentsByLoan,
  createListPaymentDocuments,
  createUploadPaymentDocument,
  createDownloadPaymentDocument,
} = require('@/modules/payouts/application/useCases');
const { createPayoutsModule } = require('@/modules/payouts');

test('createCreatePayment delegates actor-aware canonical payment application', async () => {
  let serviceInput;
  const createPayment = createCreatePayment({
    loanAccessPolicy: {
      async findAuthorizedLoan({ actor, loanId }) {
        assert.deepEqual(actor, { id: 12, role: 'customer' });
        return { id: Number(loanId) };
      },
    },
    paymentApplicationService: {
      async applyPayment(input) {
        serviceInput = input;
        return {
          payment: { id: 51, loanId: input.loanId, amount: input.amount, actorId: 12 },
          loan: { id: input.loanId },
          allocation: { remainingBalance: 0 },
        };
      },
    },
    clock: () => new Date('2026-03-19T00:00:00.000Z'),
  });

  const result = await createPayment({ actor: { id: 12, role: 'customer' }, loanId: 4, amount: 250 });

  assert.equal(result.payment.id, 51);
  assert.equal(result.payment.actorId, 12);
  assert.equal(result.allocation.remainingBalance, 0);
  assert.deepEqual(serviceInput, {
    loanId: 4,
    amount: 250,
    paymentDate: new Date('2026-03-19T00:00:00.000Z'),
    paymentMethod: undefined,
    actorId: 12,
    idempotencyKey: undefined,
  });
});

test('createListPayments only returns all payments to admins', async () => {
  const listPayments = createListPayments({
    paymentRepository: {
      async list() {
        return [{ id: 41 }];
      },
    },
  });

  const payments = await listPayments({ actor: { id: 1, role: 'admin' } });
  assert.deepEqual(payments, [{ id: 41 }]);
});

test('createListPayments rejects non-admin payment listing attempts', async () => {
  const listPayments = createListPayments({
    paymentRepository: {
      async list() {
        throw new Error('paymentRepository.list should not be called');
      },
    },
  });

  await assert.rejects(() => listPayments({ actor: { id: 4, role: 'customer' } }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    return true;
  });
});

test('createListPayments filters admin ledger rows by search and status', async () => {
  const listPayments = createListPayments({
    paymentRepository: {
      async list() {
        return [
          {
            id: 41,
            loanId: 8,
            status: 'completed',
            Loan: { Customer: { name: 'Ana Cliente', email: 'ana@example.com' } },
            paymentMetadata: { reference: 'REF-001' },
          },
          {
            id: 42,
            loanId: 9,
            status: 'pending',
            Loan: { Customer: { name: 'Carlos Cliente', email: 'carlos@example.com' } },
            paymentMetadata: { reference: 'REF-002' },
          },
        ];
      },
    },
  });

  const result = await listPayments({
    actor: { id: 1, role: 'admin' },
    filters: { search: 'ana', status: 'completed' },
    pagination: { page: 1, pageSize: 25, limit: 25, offset: 0 },
  });

  assert.deepEqual(result.pagination, {
    page: 1,
    pageSize: 25,
    totalItems: 1,
    totalPages: 1,
  });
  assert.deepEqual(result.items.map((payment) => payment.id), [41]);
});

test('createUpdatePaymentMetadata keeps payment method and nested metadata aligned', async () => {
  let updatedPayload;
  const updatePaymentMetadata = createUpdatePaymentMetadata({
    paymentRepository: {
      async findById(id) {
        assert.equal(id, 51);
        return {
          id,
          loanId: 8,
          status: 'completed',
          paymentDate: new Date('2026-03-01T00:00:00.000Z'),
          paymentMethod: 'cash',
          paymentMetadata: {
            method: 'cash',
            reference: 'REF-OLD',
            observation: 'Old note',
          },
        };
      },
      async update(_payment, payload) {
        updatedPayload = payload;
        return payload;
      },
    },
    loanAccessPolicy: {
      async findAuthorizedMutationLoan({ actor, loanId }) {
        assert.deepEqual(actor, { id: 3, role: 'admin' });
        assert.equal(loanId, 8);
        return { id: 8 };
      },
    },
  });

  const result = await updatePaymentMetadata({
    actor: { id: 3, role: 'admin' },
    paymentId: 51,
    payload: {
      paymentMethod: 'transfer',
      paymentMetadata: {
        reference: 'REF-NEW',
      },
      observation: 'Updated note',
    },
  });

  assert.deepEqual(updatedPayload, {
    paymentDate: new Date('2026-03-01T00:00:00.000Z'),
    paymentMethod: 'transfer',
    paymentMetadata: {
      method: 'transfer',
      reference: 'REF-NEW',
      observation: 'Updated note',
    },
  });
  assert.deepEqual(result, updatedPayload);
});

test('createCreatePayment stops hidden loan payments before persistence', async () => {
  const createPayment = createCreatePayment({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        throw new AuthorizationError('You do not have access to this loan');
      },
    },
    paymentApplicationService: {
      async applyPayment() {
        throw new Error('applyPayment should not be called');
      },
    },
  });

  await assert.rejects(() => createPayment({ actor: { id: 4, role: 'customer' }, loanId: 99, amount: 250 }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    return true;
  });
});

test('createCreatePayment rejects non-customer payment creation attempts', async () => {
  const createPayment = createCreatePayment({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        throw new Error('findAuthorizedLoan should not be called');
      },
    },
    paymentApplicationService: {
      async applyPayment() {
        throw new Error('applyPayment should not be called');
      },
    },
  });

  await assert.rejects(() => createPayment({ actor: { id: 8, role: 'admin' }, loanId: 4, amount: 250 }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    return true;
  });
});

test('createListPaymentsByLoan returns payments plus canonical loan context for visible loans', async () => {
  const listPaymentsByLoan = createListPaymentsByLoan({
    loanAccessPolicy: {
      async findAuthorizedLoan({ actor, loanId }) {
        assert.deepEqual(actor, { id: 8, role: 'admin' });
        return {
          id: Number(loanId),
          status: 'approved',
          amount: 1000,
          interestRate: 12,
          termMonths: 12,
          startDate: '2026-01-01',
          financialSnapshot: {
            installmentAmount: 120,
            outstandingBalance: 700,
            outstandingPrincipal: 650,
          },
        };
      },
    },
    loanViewService: {
      getCanonicalLoanView(loan) {
        return {
          schedule: [],
          snapshot: loan.financialSnapshot,
        };
      },
    },
    paymentRepository: {
      async listByLoan(loanId) {
        return [{ id: 1, loanId }];
      },
    },
  });

  const result = await listPaymentsByLoan({ actor: { id: 8, role: 'admin' }, loanId: 8 });
  assert.deepEqual(result, {
    payments: [{ id: 1, loanId: 8 }],
    loan: {
      id: 8,
      status: 'approved',
      amount: 1000,
      interestRate: 12,
      termMonths: 12,
      startDate: '2026-01-01',
      financialSnapshot: {
        installmentAmount: 120,
        outstandingBalance: 700,
        outstandingPrincipal: 650,
      },
      paymentContext: {
        isPayable: true,
        allowedPaymentTypes: ['installment', 'partial', 'capital'],
        snapshot: {
          installmentAmount: 120,
          outstandingBalance: 700,
          outstandingPrincipal: 650,
        },
        payoffEligibility: { allowed: true, denialReasons: [] },
        capitalEligibility: { allowed: true, denialReasons: [] },
      },
    },
  });
});

test('createListPaymentsByLoan returns paginated payments plus canonical loan context for visible loans', async () => {
  const listPaymentsByLoan = createListPaymentsByLoan({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return {
          id: 8,
          status: 'approved',
          amount: 1000,
          interestRate: 12,
          termMonths: 12,
          startDate: '2026-01-01',
          financialSnapshot: {
            installmentAmount: 120,
            outstandingBalance: 700,
            outstandingPrincipal: 650,
          },
        };
      },
    },
    loanViewService: {
      getCanonicalLoanView(loan) {
        return {
          schedule: [],
          snapshot: loan.financialSnapshot,
        };
      },
    },
    paymentRepository: {
      async listPageByLoan() {
        return {
          items: [{ id: 2, loanId: 8 }],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        };
      },
    },
  });

  const result = await listPaymentsByLoan({ actor: { id: 8, role: 'admin' }, loanId: 8, pagination: { page: 1, pageSize: 25 } });
  assert.deepEqual(result, {
    items: [{ id: 2, loanId: 8 }],
    pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    loan: {
      id: 8,
      status: 'approved',
      amount: 1000,
      interestRate: 12,
      termMonths: 12,
      startDate: '2026-01-01',
      financialSnapshot: {
        installmentAmount: 120,
        outstandingBalance: 700,
        outstandingPrincipal: 650,
      },
      paymentContext: {
        isPayable: true,
        allowedPaymentTypes: ['installment', 'partial', 'capital'],
        snapshot: {
          installmentAmount: 120,
          outstandingBalance: 700,
          outstandingPrincipal: 650,
        },
        payoffEligibility: { allowed: true, denialReasons: [] },
        capitalEligibility: { allowed: true, denialReasons: [] },
      },
    },
  });
});

test('createListPaymentsByLoan strips ORM internals so paginated history stays JSON serializable', async () => {
  const circularInclude = [];
  const loanRecord = {
    id: 19,
    customerId: 34,
    status: 'approved',
    amount: 6400,
    interestRate: 2.5,
    termMonths: 6,
    startDate: '2026-03-21T20:23:06.495Z',
    emiSchedule: [{
      dueDate: '2026-04-21T20:23:06.495Z',
      scheduledPayment: 1074.46,
      installmentNumber: 1,
      remainingInterest: 13.33,
      remainingPrincipal: 1061.13,
    }],
    financialSnapshot: {
      installmentAmount: 1074.46,
      outstandingBalance: 6446.74,
      outstandingInterest: 46.74,
      outstandingPrincipal: 6400,
    },
    Customer: { id: 34, name: 'Browser QA Customer' },
    _options: { include: circularInclude },
    toJSON() {
      return {
        id: this.id,
        customerId: this.customerId,
        status: this.status,
        amount: this.amount,
        interestRate: this.interestRate,
        termMonths: this.termMonths,
        startDate: this.startDate,
        emiSchedule: this.emiSchedule,
        financialSnapshot: this.financialSnapshot,
        Customer: this.Customer,
      };
    },
  };
  circularInclude.push({ parent: loanRecord._options });

  const listPaymentsByLoan = createListPaymentsByLoan({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return loanRecord;
      },
    },
    loanViewService: {
      getCanonicalLoanView(loan) {
        return {
          schedule: loan.emiSchedule,
          snapshot: loan.financialSnapshot,
        };
      },
    },
    paymentRepository: {
      async listPageByLoan() {
        return {
          items: [{ id: 3, loanId: 19, amount: 100 }],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        };
      },
    },
  });

  const result = await listPaymentsByLoan({ actor: { id: 8, role: 'admin' }, loanId: 19, pagination: { page: 1, pageSize: 25 } });

  assert.equal(result.loan.id, 19);
  assert.equal(result.loan.Customer.name, 'Browser QA Customer');
  assert.equal(Object.hasOwn(result.loan, '_options'), false);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('createListPaymentsByLoan rejects history lookup for hidden loans', async () => {
  const listPaymentsByLoan = createListPaymentsByLoan({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        throw new AuthorizationError('You do not have access to this loan');
      },
    },
    paymentRepository: {
      async listByLoan() {
        throw new Error('listByLoan should not be called');
      },
    },
  });

  await assert.rejects(() => listPaymentsByLoan({ actor: { id: 8, role: 'admin' }, loanId: 999 }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    return true;
  });
});

test('createCreatePartialPayment allows admins and delegates partial applications', async () => {
  let serviceInput;
  const createPartialPayment = createCreatePartialPayment({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return { id: 5 };
      },
    },
    paymentApplicationService: {
      async applyPartialPayment(input) {
        serviceInput = input;
        return { payment: { id: 101 }, allocation: { remainingBalance: 10 }, loan: { id: 5 } };
      },
    },
    clock: () => new Date('2026-03-20T00:00:00.000Z'),
  });

  const result = await createPartialPayment({ actor: { id: 1, role: 'admin' }, loanId: 5, amount: 80 });

  assert.equal(result.payment.id, 101);
  assert.deepEqual(serviceInput, {
    loanId: 5,
    amount: 80,
    paymentDate: new Date('2026-03-20T00:00:00.000Z'),
    paymentMethod: undefined,
    actorId: 1,
    idempotencyKey: undefined,
  });
});

test('createCreatePartialPayment rejects customer self-service partial payments', async () => {
  const createPartialPayment = createCreatePartialPayment({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        throw new Error('findAuthorizedLoan should not be called');
      },
    },
    paymentApplicationService: {
      async applyPartialPayment() {
        throw new Error('applyPartialPayment should not be called');
      },
    },
  });

  await assert.rejects(
    () => createPartialPayment({ actor: { id: 7, role: 'customer' }, loanId: 5, amount: 80 }),
    /Only admins can create partial payments/,
  );
});

test('createCreateCapitalPayment only allows admins', async () => {
  const createCapitalPayment = createCreateCapitalPayment({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        throw new Error('findAuthorizedLoan should not be called');
      },
    },
    paymentApplicationService: {
      async applyCapitalPayment() {
        throw new Error('applyCapitalPayment should not be called');
      },
    },
  });

  await assert.rejects(() => createCapitalPayment({ actor: { id: 2, role: 'customer' }, loanId: 5, amount: 80 }), AuthorizationError);
});

test('createCreateCapitalPayment delegates payment method to capital applications', async () => {
  let serviceInput;
  const createCapitalPayment = createCreateCapitalPayment({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return { id: 5 };
      },
    },
    paymentApplicationService: {
      async applyCapitalPayment(input) {
        serviceInput = input;
        return { payment: { id: 102 }, allocation: { remainingBalance: 10 }, loan: { id: 5 } };
      },
    },
    clock: () => new Date('2026-03-20T00:00:00.000Z'),
  });

  const result = await createCapitalPayment({
    actor: { id: 1, role: 'admin' },
    loanId: 5,
    amount: 80,
    paymentMethod: 'transfer',
    strategy: 'REDUCE_QUOTA',
  });

  assert.equal(result.payment.id, 102);
  assert.deepEqual(serviceInput, {
    loanId: 5,
    amount: 80,
    paymentDate: new Date('2026-03-20T00:00:00.000Z'),
    paymentMethod: 'transfer',
    strategy: 'REDUCE_QUOTA',
    actorId: 1,
    idempotencyKey: undefined,
  });
});

test('createAnnulInstallment uses mutation access policy and delegates to the service', async () => {
  let serviceInput;
  const annulInstallment = createAnnulInstallment({
    loanAccessPolicy: {
      async findAuthorizedMutationLoan({ actor, loanId }) {
        assert.deepEqual(actor, { id: 9, role: 'admin' });
        return { id: Number(loanId) };
      },
    },
    paymentApplicationService: {
      async annulInstallment(input) {
        serviceInput = input;
        return { payment: { id: 300 }, annulment: { installmentNumber: 1 }, loan: { id: input.loanId } };
      },
    },
    clock: () => new Date('2026-03-21T00:00:00.000Z'),
  });

  const result = await annulInstallment({ actor: { id: 9, role: 'admin' }, loanId: 12, installmentNumber: 2 });

  assert.equal(result.payment.id, 300);
  assert.deepEqual(serviceInput, {
    loanId: 12,
    actor: { id: 9, role: 'admin' },
    reason: undefined,
    installmentNumber: 2,
    paymentDate: new Date('2026-03-21T00:00:00.000Z'),
    idempotencyKey: undefined,
  });
});

test('createPayoutsModule consumes shared auth and shared credits public ports', () => {
  let requestedModuleName;
  const sharedPaymentApplicationService = {
    applyPayment() {},
    applyPartialPayment() {},
    applyCapitalPayment() {},
    annulInstallment() {},
  };

  const moduleRegistration = createPayoutsModule({
    sharedRuntime: {
      authContext: {
        tokenService: { sign() {}, verify() {} },
        authMiddleware() {
          return (req, res, next) => next();
        },
      },
      getModulePorts(name) {
        requestedModuleName = name;
        if (name === 'credits') {
          return {
            loanAccessPolicy: { findAuthorizedLoan() {}, findAuthorizedMutationLoan() {} },
            loanViewService: { getCanonicalLoanView() { return { schedule: [], snapshot: {} }; } },
            paymentApplicationService: sharedPaymentApplicationService,
          };
        }
        return null;
      },
    },
  });

  assert.equal(requestedModuleName, 'credits');
  assert.equal(moduleRegistration.basePath, '/api/payments');
});

test('payment document use cases enforce loan access and customer visibility', async () => {
  const paymentRepository = {
    async findById() {
      return { id: 51, loanId: 9 };
    },
    async listDocuments() {
      return [
        { id: 1, customerVisible: true, originalName: 'visible.pdf' },
        { id: 2, customerVisible: false, originalName: 'internal.pdf' },
      ];
    },
    async createDocument(payload) {
      return { id: 3, ...payload };
    },
    async findDocument() {
      return { id: 1, paymentId: 51, customerVisible: true, storagePath: 'visible.pdf', originalName: 'visible.pdf' };
    },
  };
  const loanAccessPolicy = {
    async findAuthorizedLoan() {
      return { id: 9 };
    },
    async findAuthorizedMutationLoan() {
      return { id: 9 };
    },
  };

  const documents = await createListPaymentDocuments({ paymentRepository, loanAccessPolicy })({ actor: { id: 7, role: 'customer' }, paymentId: 51 });
  assert.equal(documents.length, 1);

  const uploadResult = await createUploadPaymentDocument({
    paymentRepository,
    loanAccessPolicy,
    attachmentStorage: {
      toRelativePath() { return 'payment-proof.pdf'; },
      async deleteByAbsolutePath() {},
    },
  })({
    actor: { id: 1, role: 'admin' },
    paymentId: 51,
    file: { path: '/tmp/payment-proof.pdf', filename: 'payment-proof.pdf', originalname: 'Payment Proof.pdf', mimetype: 'application/pdf', size: 123 },
    metadata: { customerVisible: 'true' },
  });
  assert.equal(uploadResult.paymentId, 51);

  const downloadResult = await createDownloadPaymentDocument({
    paymentRepository,
    loanAccessPolicy,
    attachmentStorage: {
      async assertExists() {},
      resolveAbsolutePath() { return '/tmp/payment-proof.pdf'; },
    },
  })({ actor: { id: 1, role: 'admin' }, paymentId: 51, documentId: 1 });
  assert.equal(downloadResult.document.id, 1);
});
