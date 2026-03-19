const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthorizationError } = require('../src/utils/errorHandler');

const {
  createListPayments,
  createCreatePayment,
  createListPaymentsByLoan,
} = require('../src/modules/payouts/application/useCases');

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
