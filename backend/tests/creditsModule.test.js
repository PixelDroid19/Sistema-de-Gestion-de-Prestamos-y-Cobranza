const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createListLoans,
  createCreateSimulation,
  createAssignAgent,
  createUpdateLoanStatus,
  createUpdateRecoveryStatus,
  createDeleteLoan,
} = require('../src/modules/credits/application/useCases');
const { AuthorizationError } = require('../src/utils/errorHandler');

test('createListLoans scopes repository results through the shared access policy', async () => {
  let filterCall;
  const listLoans = createListLoans({
    loanRepository: {
      async list() {
        return [
          { id: 41, customerId: 7, agentId: 9 },
          { id: 42, customerId: 99, agentId: 11 },
        ];
      },
    },
    loanAccessPolicy: {
      filterVisibleLoans(input) {
        filterCall = input;
        return [input.loans[0]];
      },
    },
  });

  const loans = await listLoans({ actor: { id: 9, role: 'agent' } });

  assert.equal(filterCall.actor.id, 9);
  assert.equal(loans.length, 1);
  assert.equal(loans[0].id, 41);
});

test('createCreateSimulation returns canonical preview data from the domain service', async () => {
  const createSimulation = createCreateSimulation({
    creditDomainService: {
      simulate(input) {
        return {
          lateFeeMode: 'NONE',
          schedule: [{ installmentNumber: 1 }],
          summary: { amount: input.amount },
        };
      },
    },
  });

  const simulation = await createSimulation({ amount: 12000, interestRate: 12, termMonths: 12 });

  assert.equal(simulation.lateFeeMode, 'NONE');
  assert.equal(simulation.summary.amount, 12000);
});

test('createAssignAgent updates the loan and emits a notification payload', async () => {
  let sentNotification;
  const assignAgent = createAssignAgent({
    loanRepository: {
      async findById() {
        return {
          id: 22,
          amount: 8000,
          status: 'defaulted',
          recoveryStatus: 'pending',
          agentId: null,
          customerId: 7,
          Customer: { name: 'Ana Customer', email: 'ana@example.com' },
        };
      },
      async save(loan) {
        return loan;
      },
    },
    agentRepository: {
      async findById() {
        return { id: 9, email: 'agent@example.com' };
      },
    },
    userRepository: {
      async findAgentUserByEmail() {
        return { id: 99, role: 'agent' };
      },
    },
    notificationPort: {
      async sendAssignment(userId, payload) {
        sentNotification = { userId, payload };
      },
    },
  });

  const loan = await assignAgent({ actor: { id: 1, role: 'admin' }, loanId: 22, agentId: 9 });

  assert.equal(loan.agentId, 9);
  assert.equal(loan.recoveryStatus, 'assigned');
  assert.equal(sentNotification.userId, 99);
  assert.equal(sentNotification.payload.loanId, 22);
});

test('createUpdateLoanStatus moves defaulted loans into pending recovery', async () => {
  const updateLoanStatus = createUpdateLoanStatus({
    loanRepository: {
      async save(loan) {
        return loan;
      },
    },
    loanAccessPolicy: {
      async findAuthorizedMutationLoan() {
        return {
          id: 32,
          status: 'approved',
          recoveryStatus: null,
          customerId: 4,
          termMonths: 12,
        };
      },
    },
  });

  const updatedLoan = await updateLoanStatus({
    actor: { id: 1, role: 'admin' },
    loanId: 32,
    status: 'defaulted',
  });

  assert.equal(updatedLoan.status, 'defaulted');
  assert.equal(updatedLoan.recoveryStatus, 'pending');
});

test('createUpdateLoanStatus rejects unassigned agent mutation attempts through shared policy', async () => {
  const updateLoanStatus = createUpdateLoanStatus({
    loanRepository: {
      async save(loan) {
        return loan;
      },
    },
    loanAccessPolicy: {
      async findAuthorizedMutationLoan() {
        throw new AuthorizationError('You can only update loans assigned to you');
      },
    },
  });

  await assert.rejects(() => updateLoanStatus({
    actor: { id: 8, role: 'agent' },
    loanId: 55,
    status: 'approved',
  }), AuthorizationError);
});

test('createUpdateRecoveryStatus lets an assigned agent progress recovery', async () => {
  const updateRecoveryStatus = createUpdateRecoveryStatus({
    loanAccessPolicy: {
      async findAuthorizedMutationLoan({ actor, loanId }) {
        assert.equal(actor.id, 9);
        assert.equal(loanId, 32);
        return {
          id: 32,
          status: 'defaulted',
          recoveryStatus: 'assigned',
          agentId: 9,
          async save() {
            return this;
          },
        };
      },
    },
    recoveryStatusGuard: {
      assertCanTransition({ loan, nextRecoveryStatus }) {
        assert.equal(loan.status, 'defaulted');
        assert.equal(nextRecoveryStatus, 'in_progress');
      },
    },
    loanRepository: {
      async save(loan) {
        return loan.save();
      },
    },
  });

  const updatedLoan = await updateRecoveryStatus({
    actor: { id: 9, role: 'agent' },
    loanId: 32,
    recoveryStatus: 'in_progress',
  });

  assert.equal(updatedLoan.recoveryStatus, 'in_progress');
});

test('createDeleteLoan rejects deletion of a foreign rejected loan before destroy', async () => {
  let destroyed = false;
  const deleteLoan = createDeleteLoan({
    loanRepository: {
      async destroy() {
        destroyed = true;
      },
    },
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        throw new AuthorizationError('You can only access loans assigned to you');
      },
    },
  });

  await assert.rejects(() => deleteLoan({
    actor: { id: 12, role: 'agent' },
    loanId: 88,
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'You can only access loans assigned to you');
    return true;
  });

  assert.equal(destroyed, false);
});

test('createDeleteLoan deletes an authorized rejected loan', async () => {
  let destroyedLoan = null;
  const rejectedLoan = { id: 77, status: 'rejected', customerId: 7, agentId: 9 };
  const deleteLoan = createDeleteLoan({
    loanRepository: {
      async destroy(loan) {
        destroyedLoan = loan;
      },
    },
    loanAccessPolicy: {
      async findAuthorizedLoan({ actor, loanId }) {
        assert.equal(actor.id, 7);
        assert.equal(actor.role, 'customer');
        assert.equal(loanId, 77);
        return rejectedLoan;
      },
    },
  });

  await deleteLoan({
    actor: { id: 7, role: 'customer' },
    loanId: 77,
  });

  assert.equal(destroyedLoan, rejectedLoan);
});
