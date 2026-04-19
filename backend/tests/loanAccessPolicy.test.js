const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthorizationError, NotFoundError } = require('@/utils/errorHandler');
const { createLoanAccessPolicy, isLoanVisibleToActor, isLoanMutableByActor, canActorViewAttachment } = require('@/modules/shared/loanAccessPolicy');

test('isLoanVisibleToActor supports admin and customer visibility under the three-role model', () => {
  const loan = { id: 18, customerId: 7 };

  assert.equal(isLoanVisibleToActor({ actor: { id: 1, role: 'admin' }, loan }), true);
  assert.equal(isLoanVisibleToActor({ actor: { id: 7, role: 'customer' }, loan }), true);
  assert.equal(isLoanVisibleToActor({ actor: { id: 99, role: 'customer' }, loan }), false);
});

test('createLoanAccessPolicy finds only authorized loans', async () => {
  const loanAccessPolicy = createLoanAccessPolicy({
    loanRepository: {
      async findById(loanId) {
        return { id: Number(loanId), customerId: 7 };
      },
    },
  });

  const loan = await loanAccessPolicy.findAuthorizedLoan({
    actor: { id: 1, role: 'admin' },
    loanId: 18,
  });

  assert.equal(loan.id, 18);

  await assert.rejects(() => loanAccessPolicy.findAuthorizedLoan({
    actor: { id: 2, role: 'customer' },
    loanId: 18,
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    return true;
  });
});

test('createLoanAccessPolicy raises not found for missing loans', async () => {
  const loanAccessPolicy = createLoanAccessPolicy({
    loanRepository: {
      async findById() {
        return null;
      },
    },
  });

  await assert.rejects(() => loanAccessPolicy.findAuthorizedLoan({
    actor: { id: 1, role: 'admin' },
    loanId: 999,
  }), (error) => {
    assert.ok(error instanceof NotFoundError);
    return true;
  });
});

test('createLoanAccessPolicy filters visible loans for list responses', async () => {
  const loanAccessPolicy = createLoanAccessPolicy({
    loanRepository: {
      async findById() {
        return null;
      },
    },
  });

  const loans = loanAccessPolicy.filterVisibleLoans({
    actor: { id: 1, role: 'admin' },
    loans: [
      { id: 1, customerId: 7 },
      { id: 2, customerId: 7 },
      { id: 3, customerId: 99 },
    ],
  });

  assert.deepEqual(loans, [
    { id: 1, customerId: 7 },
    { id: 2, customerId: 7 },
    { id: 3, customerId: 99 },
  ]);
});

test('isLoanMutableByActor only allows admins', () => {
  const loan = { id: 18, customerId: 7 };

  assert.equal(isLoanMutableByActor({ actor: { id: 1, role: 'admin' }, loan }), true);
  assert.equal(isLoanMutableByActor({ actor: { id: 7, role: 'customer' }, loan }), false);
  assert.equal(isLoanMutableByActor({ actor: { id: 40, role: 'socio', associateId: 22 }, loan }), false);
});

test('isLoanVisibleToActor supports socio visibility through associate ownership', () => {
  const loan = { id: 18, customerId: 7, associateId: 22 };

  assert.equal(isLoanVisibleToActor({ actor: { id: 40, role: 'socio', associateId: 22 }, loan }), true);
  assert.equal(isLoanVisibleToActor({ actor: { id: 41, role: 'socio', associateId: 99 }, loan }), false);
});

test('canActorViewAttachment blocks customers from internal-only files and allows socio-linked loans', () => {
  const loan = { id: 18, customerId: 7, associateId: 22 };

  assert.equal(canActorViewAttachment({ actor: { id: 7, role: 'customer' }, loan, attachment: { customerVisible: true } }), true);
  assert.equal(canActorViewAttachment({ actor: { id: 7, role: 'customer' }, loan, attachment: { customerVisible: false } }), false);
  assert.equal(canActorViewAttachment({ actor: { id: 40, role: 'socio', associateId: 22 }, loan, attachment: { customerVisible: false } }), true);
});

test('createLoanAccessPolicy rejects loan mutation for non-admin actors', async () => {
  const loanAccessPolicy = createLoanAccessPolicy({
    loanRepository: {
      async findById(loanId) {
        return { id: Number(loanId), customerId: 7 };
      },
    },
  });

  await assert.rejects(() => loanAccessPolicy.findAuthorizedMutationLoan({
    actor: { id: 9, role: 'customer' },
    loanId: 18,
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'You do not have permission to update this loan');
    return true;
  });
});

test('unsupported role agent has no loan access - agent role is fully rejected', () => {
  const loan = { id: 18, customerId: 7, associateId: 22 };

  // Agent is no longer a supported role - normalizeApplicationRole returns null for agent
  // This means agent actors should have no visibility or mutation access
  assert.equal(isLoanVisibleToActor({ actor: { id: 99, role: 'agent' }, loan }), false);
  assert.equal(isLoanMutableByActor({ actor: { id: 99, role: 'agent' }, loan }), false);
});
