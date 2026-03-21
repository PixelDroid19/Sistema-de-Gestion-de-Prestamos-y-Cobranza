const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createCreditsRouter } = require('../src/modules/credits/presentation/router');
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

const noopAttachmentUpload = {
  single() {
    return (req, res, next) => next();
  },
};

const noopLoanValidation = {
  create(req, res, next) { next(); },
  simulate(req, res, next) { next(); },
  updateStatus(req, res, next) { next(); },
  payoffQuote(req, res, next) { next(); },
  payoffExecute(req, res, next) { next(); },
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
  listLoanAttachments: unexpectedUseCase('listLoanAttachments'),
  createLoanAttachment: unexpectedUseCase('createLoanAttachment'),
  downloadLoanAttachment: unexpectedUseCase('downloadLoanAttachment'),
  listLoanAlerts: unexpectedUseCase('listLoanAlerts'),
  getPaymentCalendar: unexpectedUseCase('getPaymentCalendar'),
  getPayoffQuote: unexpectedUseCase('getPayoffQuote'),
  executePayoff: unexpectedUseCase('executePayoff'),
  listPromisesToPay: unexpectedUseCase('listPromisesToPay'),
  createPromiseToPay: unexpectedUseCase('createPromiseToPay'),
  createLoanFollowUp: unexpectedUseCase('createLoanFollowUp'),
  updateLoanAlertStatus: unexpectedUseCase('updateLoanAlertStatus'),
  updatePromiseToPayStatus: unexpectedUseCase('updatePromiseToPayStatus'),
  downloadPromiseToPay: unexpectedUseCase('downloadPromiseToPay'),
  loadDagWorkbenchGraph: unexpectedUseCase('loadDagWorkbenchGraph'),
  saveDagWorkbenchGraph: unexpectedUseCase('saveDagWorkbenchGraph'),
  validateDagWorkbenchGraph: unexpectedUseCase('validateDagWorkbenchGraph'),
  simulateDagWorkbenchGraph: unexpectedUseCase('simulateDagWorkbenchGraph'),
  getDagWorkbenchSummary: unexpectedUseCase('getDagWorkbenchSummary'),
  ...overrides,
});

test('createCreditsRouter serves DAG workbench contracts behind the existing loans boundary', async () => {
  const calls = [];
  const graphVersion = {
    id: 'personal-loan:v1',
    scopeKey: 'personal-loan',
    version: 1,
    name: 'Personal Loan',
    graph: { nodes: [{ id: 'amount', kind: 'input' }], edges: [] },
    graphSummary: { nodeCount: 1, edgeCount: 0, outputCount: 0 },
  };
  const validation = { valid: true, errors: [], warnings: [], summary: graphVersion.graphSummary };
  const simulation = {
    lateFeeMode: 'NONE',
    summary: { totalPayable: 1012 },
    schedule: [{ installmentNumber: 1, scheduledPayment: 84.33 }],
  };

  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async loadDagWorkbenchGraph(input) {
        calls.push(['loadDagWorkbenchGraph', input]);
        return { graphVersion };
      },
      async saveDagWorkbenchGraph(input) {
        calls.push(['saveDagWorkbenchGraph', input]);
        return { graphVersion, validation };
      },
      async validateDagWorkbenchGraph(input) {
        calls.push(['validateDagWorkbenchGraph', input]);
        return validation;
      },
      async simulateDagWorkbenchGraph(input) {
        calls.push(['simulateDagWorkbenchGraph', input]);
        return {
          graphVersion,
          validation,
          simulation,
          summary: {
            latestGraph: graphVersion,
            latestSimulation: { selectedSource: 'legacy' },
          },
        };
      },
      async getDagWorkbenchSummary(input) {
        calls.push(['getDagWorkbenchSummary', input]);
        return {
          latestGraph: graphVersion,
          latestSimulation: { selectedSource: 'legacy' },
        };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const loadResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/workbench/graph?scope=personal-loan',
    headers: { authorization: 'Bearer valid-token' },
  });
  const saveResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/workbench/graph',
    headers: { authorization: 'Bearer valid-token' },
    body: { scopeKey: 'personal-loan', name: 'Personal Loan', graph: graphVersion.graph },
  });
  const validateResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/workbench/graph/validate',
    headers: { authorization: 'Bearer valid-token' },
    body: { scopeKey: 'personal-loan', graph: graphVersion.graph },
  });
  const simulateResponse = await requestJson(activeServer, {
    method: 'POST',
    path: '/workbench/graph/simulations',
    headers: { authorization: 'Bearer valid-token' },
    body: { scopeKey: 'personal-loan', graph: graphVersion.graph, simulationInput: { amount: 1000, interestRate: 12, termMonths: 12 } },
  });
  const summaryResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/workbench/graph/summary?scope=personal-loan',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(loadResponse.statusCode, 200);
  assert.equal(loadResponse.body.data.graph.version, 1);
  assert.equal(saveResponse.statusCode, 201);
  assert.equal(saveResponse.body.data.graph.validation.valid, true);
  assert.equal(validateResponse.statusCode, 200);
  assert.equal(validateResponse.body.data.validation.valid, true);
  assert.equal(simulateResponse.statusCode, 200);
  assert.equal(simulateResponse.body.data.simulation.summary.totalPayable, 1012);
  assert.equal(summaryResponse.statusCode, 200);
  assert.equal(summaryResponse.body.data.summary.latestSimulation.selectedSource, 'legacy');
  assert.deepEqual(calls, [
    ['loadDagWorkbenchGraph', { actor: { id: 1, role: 'admin' }, scopeKey: 'personal-loan' }],
    ['saveDagWorkbenchGraph', { actor: { id: 1, role: 'admin' }, scopeKey: 'personal-loan', name: 'Personal Loan', graph: graphVersion.graph }],
    ['validateDagWorkbenchGraph', { actor: { id: 1, role: 'admin' }, scopeKey: 'personal-loan', graph: graphVersion.graph }],
    ['simulateDagWorkbenchGraph', { actor: { id: 1, role: 'admin' }, scopeKey: 'personal-loan', graph: graphVersion.graph, simulationInput: { amount: 1000, interestRate: 12, termMonths: 12 } }],
    ['getDagWorkbenchSummary', { actor: { id: 1, role: 'admin' }, scopeKey: 'personal-loan' }],
  ]);
});

test('createCreditsRouter preserves fallback metadata in DAG workbench simulation responses', async () => {
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async simulateDagWorkbenchGraph() {
        return {
          graphVersion: {
            id: 'personal-loan:v2',
            scopeKey: 'personal-loan',
            version: 2,
            name: 'Personal Loan',
            graph: { nodes: [{ id: 'amount', kind: 'input' }], edges: [] },
            graphSummary: { nodeCount: 1, edgeCount: 0, outputCount: 0 },
          },
          validation: { valid: true, errors: [], warnings: [], summary: { nodeCount: 1, edgeCount: 0, outputCount: 0 } },
          simulation: { summary: { totalPayable: 1012 }, schedule: [{ installmentNumber: 1, scheduledPayment: 84.33 }] },
          summary: {
            latestGraph: { id: 'personal-loan:v2', scopeKey: 'personal-loan', version: 2, name: 'Personal Loan' },
            latestSimulation: {
              selectedSource: 'legacy',
              fallbackReason: 'parity_mismatch',
              parity: { passed: false, mismatches: [{ field: 'summary.totalPayable' }] },
            },
          },
        };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/workbench/graph/simulations',
    headers: { authorization: 'Bearer valid-token' },
    body: { scopeKey: 'personal-loan', graph: { nodes: [{ id: 'amount', kind: 'input' }], edges: [] }, simulationInput: { amount: 1000 } },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.summary.latestSimulation.selectedSource, 'legacy');
  assert.equal(response.body.data.summary.latestSimulation.fallbackReason, 'parity_mismatch');
  assert.equal(response.body.data.summary.latestSimulation.parity.passed, false);
});
