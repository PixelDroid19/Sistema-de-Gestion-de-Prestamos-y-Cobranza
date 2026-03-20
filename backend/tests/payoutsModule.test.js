const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthorizationError } = require('../src/utils/errorHandler');

const {
  createListPayments,
  createCreatePayment,
  createCreatePartialPayment,
  createCreateCapitalPayment,
  createAnnulInstallment,
  createListPaymentsByLoan,
} = require('../src/modules/payouts/application/useCases');
const { createPayoutsModule } = require('../src/modules/payouts');

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

  await assert.rejects(() => listPayments({ actor: { id: 4, role: 'agent' } }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    return true;
  });
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

test('createListPaymentsByLoan returns repository data for visible loans', async () => {
  const listPaymentsByLoan = createListPaymentsByLoan({
    loanAccessPolicy: {
      async findAuthorizedLoan({ actor, loanId }) {
        assert.deepEqual(actor, { id: 8, role: 'agent' });
        return { id: Number(loanId) };
      },
    },
    paymentRepository: {
      async listByLoan(loanId) {
        return [{ id: 1, loanId }];
      },
    },
  });

  const payments = await listPaymentsByLoan({ actor: { id: 8, role: 'agent' }, loanId: 8 });
  assert.deepEqual(payments, [{ id: 1, loanId: 8 }]);
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

  await assert.rejects(() => listPaymentsByLoan({ actor: { id: 8, role: 'agent' }, loanId: 999 }), (error) => {
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
  });
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

test('createAnnulInstallment uses mutation access policy and delegates to the service', async () => {
  let serviceInput;
  const annulInstallment = createAnnulInstallment({
    loanAccessPolicy: {
      async findAuthorizedMutationLoan({ actor, loanId }) {
        assert.deepEqual(actor, { id: 9, role: 'agent' });
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

  const result = await annulInstallment({ actor: { id: 9, role: 'agent' }, loanId: 12 });

  assert.equal(result.payment.id, 300);
  assert.deepEqual(serviceInput, {
    loanId: 12,
    actor: { id: 9, role: 'agent' },
    paymentDate: new Date('2026-03-21T00:00:00.000Z'),
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
