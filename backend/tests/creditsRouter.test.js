const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { loanValidation: runtimeLoanValidation } = require('../src/middleware/validation');
const { createListLoans, createUpdateLoanStatus, createDeleteLoan } = require('../src/modules/credits/application/useCases');
const { createCreditsRouter } = require('../src/modules/credits/presentation/router');
const { createAuthMiddleware } = require('../src/modules/shared/auth');
const { createLoanAccessPolicy } = require('../src/modules/shared/loanAccessPolicy');
const { globalErrorHandler } = require('../src/utils/errorHandler');
const { closeServer, listen, requestJson } = require('./helpers/http');

let activeServer;

afterEach(async () => {
  await closeServer(activeServer);
  activeServer = null;
});

const allowAuth = (user) => () => (req, res, next) => {
  req.user = user;
  next();
};

const noopLoanValidation = {
  create(req, res, next) {
    next();
  },
  simulate(req, res, next) {
    next();
  },
  updateStatus(req, res, next) {
    next();
  },
};

const unexpectedUseCase = (name) => async () => {
  throw new Error(`${name} should not be called`);
};

const createUseCases = (overrides) => ({
  listLoans: unexpectedUseCase('listLoans'),
  createSimulation: unexpectedUseCase('createSimulation'),
  listLoansByCustomer: unexpectedUseCase('listLoansByCustomer'),
  listLoansByAgent: unexpectedUseCase('listLoansByAgent'),
  createLoan: unexpectedUseCase('createLoan'),
  updateLoanStatus: unexpectedUseCase('updateLoanStatus'),
  assignAgent: unexpectedUseCase('assignAgent'),
  updateRecoveryStatus: unexpectedUseCase('updateRecoveryStatus'),
  deleteLoan: unexpectedUseCase('deleteLoan'),
  getLoanById: unexpectedUseCase('getLoanById'),
  ...overrides,
});

const createRuntimeApp = ({ actor, useCases, validation = runtimeLoanValidation }) => {
  const app = express();
  const authMiddleware = createAuthMiddleware({
    tokenService: {
      verify() {
        return actor;
      },
    },
  });

  app.use(express.json());
  app.use(createCreditsRouter({ authMiddleware, loanValidation: validation, useCases }));
  app.use(globalErrorHandler);

  return app;
};

test('createCreditsRouter serves create, list, and read contract responses', async () => {
  const calls = [];
  const listedLoans = [
    { id: 41, status: 'approved' },
    { id: 42, status: 'pending' },
  ];
  const createdLoan = {
    id: 43,
    status: 'pending',
    amount: 1500,
    financialSnapshot: {
      principal: 1500,
      totalAmount: 1800,
    },
  };
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 2, role: 'admin' }),
    loanValidation: noopLoanValidation,
    useCases: {
      async listLoans(input) {
        calls.push(['listLoans', input]);
        return listedLoans;
      },
      async createSimulation() {
        throw new Error('createSimulation should not be called');
      },
      async listLoansByCustomer() {
        throw new Error('listLoansByCustomer should not be called');
      },
      async listLoansByAgent() {
        throw new Error('listLoansByAgent should not be called');
      },
      async createLoan(input) {
        calls.push(['createLoan', input]);
        return createdLoan;
      },
      async updateLoanStatus() {
        throw new Error('updateLoanStatus should not be called');
      },
      async assignAgent() {
        throw new Error('assignAgent should not be called');
      },
      async updateRecoveryStatus() {
        throw new Error('updateRecoveryStatus should not be called');
      },
      async deleteLoan() {
        throw new Error('deleteLoan should not be called');
      },
      async getLoanById(input) {
        calls.push(['getLoanById', input]);
        return { id: Number(input.loanId), status: 'approved' };
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const createPayload = {
    customerId: 8,
    amount: 1500,
  };

  const listResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });
  const createResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
    body: createPayload,
  });
  const readResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/44',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.body, {
    success: true,
    count: 2,
    data: {
      loans: listedLoans,
    },
  });
  assert.equal(createResponse.statusCode, 201);
  assert.deepEqual(createResponse.body, {
    success: true,
    message: 'Loan application submitted successfully',
    data: {
      loan: createdLoan,
      financialSummary: createdLoan.financialSnapshot,
    },
  });
  assert.equal(readResponse.statusCode, 200);
  assert.deepEqual(readResponse.body, {
    success: true,
    data: {
      loan: {
        id: 44,
        status: 'approved',
      },
    },
  });
  assert.deepEqual(calls, [
    ['listLoans', { actor: { id: 2, role: 'admin' } }],
    ['createLoan', { actor: { id: 2, role: 'admin' }, payload: createPayload }],
    ['getLoanById', { actor: { id: 2, role: 'admin' }, loanId: '44' }],
  ]);
});

test('createCreditsRouter serves assignment and recovery contract responses', async () => {
  const calls = [];
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    loanValidation: noopLoanValidation,
    useCases: {
      async listLoans() {
        throw new Error('listLoans should not be called');
      },
      async createSimulation() {
        throw new Error('createSimulation should not be called');
      },
      async listLoansByCustomer() {
        throw new Error('listLoansByCustomer should not be called');
      },
      async listLoansByAgent() {
        throw new Error('listLoansByAgent should not be called');
      },
      async createLoan() {
        throw new Error('createLoan should not be called');
      },
      async updateLoanStatus() {
        throw new Error('updateLoanStatus should not be called');
      },
      async assignAgent(input) {
        calls.push(['assignAgent', input]);
        return {
          id: Number(input.loanId),
          status: 'defaulted',
          recoveryStatus: 'assigned',
          agentId: input.agentId,
        };
      },
      async updateRecoveryStatus(input) {
        calls.push(['updateRecoveryStatus', input]);
        return {
          id: Number(input.loanId),
          status: 'defaulted',
          recoveryStatus: input.recoveryStatus,
          agentId: 9,
        };
      },
      async deleteLoan() {
        throw new Error('deleteLoan should not be called');
      },
      async getLoanById() {
        throw new Error('getLoanById should not be called');
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use(router);

  activeServer = await listen(app);

  const assignResponse = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/22/assign-agent',
    headers: { authorization: 'Bearer valid-token' },
    body: { agentId: 9 },
  });
  const recoveryResponse = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/22/recovery-status',
    headers: { authorization: 'Bearer valid-token' },
    body: { recoveryStatus: 'contacted' },
  });

  assert.equal(assignResponse.statusCode, 200);
  assert.deepEqual(assignResponse.body, {
    success: true,
    message: 'Agent assigned successfully',
    data: {
      loan: {
        id: 22,
        status: 'defaulted',
        recoveryStatus: 'assigned',
        agentId: 9,
      },
    },
  });
  assert.equal(recoveryResponse.statusCode, 200);
  assert.deepEqual(recoveryResponse.body, {
    success: true,
    message: 'Recovery status updated successfully',
    data: {
      loan: {
        id: 22,
        status: 'defaulted',
        recoveryStatus: 'contacted',
        agentId: 9,
      },
    },
  });
  assert.deepEqual(calls, [
    ['assignAgent', { actor: { id: 1, role: 'admin' }, loanId: '22', agentId: 9 }],
    ['updateRecoveryStatus', { actor: { id: 1, role: 'admin' }, loanId: '22', recoveryStatus: 'contacted' }],
  ]);
});

test('createCreditsRouter GET / scopes loans to the authenticated customer at runtime', async () => {
  const loanRepository = {
    async list() {
      return [
        { id: 41, customerId: 7, agentId: 9, status: 'approved' },
        { id: 42, customerId: 99, agentId: 7, status: 'pending' },
        { id: 43, customerId: 7, agentId: 11, status: 'defaulted' },
      ];
    },
    async findById() {
      return null;
    },
  };
  const loanAccessPolicy = createLoanAccessPolicy({ loanRepository });
  const app = createRuntimeApp({
    actor: { id: 7, role: 'customer' },
    useCases: createUseCases({
      listLoans: createListLoans({ loanRepository, loanAccessPolicy }),
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    count: 2,
    data: {
      loans: [
        { id: 41, customerId: 7, agentId: 9, status: 'approved' },
        { id: 43, customerId: 7, agentId: 11, status: 'defaulted' },
      ],
    },
  });
});

test('createCreditsRouter GET / returns all loans to admins at runtime', async () => {
  const loanRepository = {
    async list() {
      return [
        { id: 51, customerId: 7, agentId: 9, status: 'approved' },
        { id: 52, customerId: 99, agentId: 7, status: 'pending' },
        { id: 53, customerId: 18, agentId: null, status: 'defaulted' },
      ];
    },
    async findById() {
      return null;
    },
  };
  const loanAccessPolicy = createLoanAccessPolicy({ loanRepository });
  const app = createRuntimeApp({
    actor: { id: 1, role: 'admin' },
    useCases: createUseCases({
      listLoans: createListLoans({ loanRepository, loanAccessPolicy }),
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    count: 3,
    data: {
      loans: [
        { id: 51, customerId: 7, agentId: 9, status: 'approved' },
        { id: 52, customerId: 99, agentId: 7, status: 'pending' },
        { id: 53, customerId: 18, agentId: null, status: 'defaulted' },
      ],
    },
  });
});

test('createCreditsRouter PATCH /:id/status lets an assigned agent mutate loan status at runtime', async () => {
  const loanRepository = {
    async list() {
      throw new Error('list should not be called');
    },
    async findById(loanId) {
      return {
        id: Number(loanId),
        customerId: 4,
        agentId: 9,
        status: 'approved',
        recoveryStatus: null,
        termMonths: 12,
      };
    },
    async save(loan) {
      return loan;
    },
  };
  const loanAccessPolicy = createLoanAccessPolicy({ loanRepository });
  const app = createRuntimeApp({
    actor: { id: 9, role: 'agent' },
    useCases: createUseCases({
      updateLoanStatus: createUpdateLoanStatus({ loanRepository, loanAccessPolicy }),
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/32/status',
    headers: { authorization: 'Bearer valid-token' },
    body: { status: 'defaulted' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    message: 'Loan status updated to defaulted',
    data: {
      loan: {
        id: 32,
        customerId: 4,
        agentId: 9,
        status: 'defaulted',
        recoveryStatus: 'pending',
        termMonths: 12,
      },
    },
  });
});

test('createCreditsRouter DELETE /:id blocks an unassigned agent from deleting a foreign rejected loan at runtime', async () => {
  let destroyCalled = false;
  const loanRepository = {
    async findById(loanId) {
      return {
        id: Number(loanId),
        customerId: 4,
        agentId: 21,
        status: 'rejected',
      };
    },
    async destroy() {
      destroyCalled = true;
    },
  };
  const loanAccessPolicy = createLoanAccessPolicy({ loanRepository });
  const app = createRuntimeApp({
    actor: { id: 9, role: 'agent' },
    useCases: createUseCases({
      deleteLoan: createDeleteLoan({ loanRepository, loanAccessPolicy }),
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/77',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.message, 'You can only access loans assigned to you');
  assert.equal(destroyCalled, false);
});

test('createCreditsRouter DELETE /:id lets an owner delete their rejected loan at runtime', async () => {
  let destroyedLoan = null;
  const loanRepository = {
    async findById(loanId) {
      return {
        id: Number(loanId),
        customerId: 7,
        agentId: null,
        status: 'rejected',
      };
    },
    async destroy(loan) {
      destroyedLoan = loan;
    },
  };
  const loanAccessPolicy = createLoanAccessPolicy({ loanRepository });
  const app = createRuntimeApp({
    actor: { id: 7, role: 'customer' },
    useCases: createUseCases({
      deleteLoan: createDeleteLoan({ loanRepository, loanAccessPolicy }),
    }),
  });

  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/81',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    message: 'Loan deleted successfully',
  });
  assert.deepEqual(destroyedLoan, {
    id: 81,
    customerId: 7,
    agentId: null,
    status: 'rejected',
  });
});
