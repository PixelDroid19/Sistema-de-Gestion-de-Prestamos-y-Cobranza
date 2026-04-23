const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createCreditsRouter } = require('@/modules/credits/presentation/router');
const { globalErrorHandler } = require('@/utils/errorHandler');
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
  listLoansByRecoveryAssignee: unexpectedUseCase('listLoansByRecoveryAssignee'),
  listRecoveryRoster: unexpectedUseCase('listRecoveryRoster'),
  createLoan: unexpectedUseCase('createLoan'),
  updateLoanStatus: unexpectedUseCase('updateLoanStatus'),
  assignRecoveryAssignee: unexpectedUseCase('assignRecoveryAssignee'),
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
  listDagWorkbenchScopes: unexpectedUseCase('listDagWorkbenchScopes'),
  loadDagWorkbenchGraph: unexpectedUseCase('loadDagWorkbenchGraph'),
  saveDagWorkbenchGraph: unexpectedUseCase('saveDagWorkbenchGraph'),
  validateDagWorkbenchGraph: unexpectedUseCase('validateDagWorkbenchGraph'),
  simulateDagWorkbenchGraph: unexpectedUseCase('simulateDagWorkbenchGraph'),
  getDagWorkbenchSummary: unexpectedUseCase('getDagWorkbenchSummary'),
  listDagWorkbenchGraphs: unexpectedUseCase('listDagWorkbenchGraphs'),
  getDagWorkbenchGraphDetails: unexpectedUseCase('getDagWorkbenchGraphDetails'),
  activateDagWorkbenchGraph: unexpectedUseCase('activateDagWorkbenchGraph'),
  deactivateDagWorkbenchGraph: unexpectedUseCase('deactivateDagWorkbenchGraph'),
  deleteDagWorkbenchGraph: unexpectedUseCase('deleteDagWorkbenchGraph'),
  getDagWorkbenchGraphHistory: unexpectedUseCase('getDagWorkbenchGraphHistory'),
  getDagWorkbenchGraphDiff: unexpectedUseCase('getDagWorkbenchGraphDiff'),
  restoreDagWorkbenchGraph: unexpectedUseCase('restoreDagWorkbenchGraph'),
  listDagVariables: unexpectedUseCase('listDagVariables'),
  createDagVariable: unexpectedUseCase('createDagVariable'),
  updateDagVariable: unexpectedUseCase('updateDagVariable'),
  deleteDagVariable: unexpectedUseCase('deleteDagVariable'),
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
  const scopes = [{
    key: 'credit-simulation',
    label: 'Simulacion de credito',
    defaultName: 'Formula base de simulacion de credito',
    helpers: [{ name: 'buildAmortizationSchedule' }],
    simulationInput: { amount: 1000, interestRate: 12, termMonths: 12, lateFeeMode: 'SIMPLE' },
    defaultGraph: graphVersion.graph,
  }];

  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async listDagWorkbenchScopes(input) {
        calls.push(['listDagWorkbenchScopes', input]);
        return { scopes };
      },
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
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const scopesResponse = await requestJson(activeServer, {
    method: 'GET',
    path: '/workbench/scopes',
    headers: { authorization: 'Bearer valid-token' },
  });
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

  assert.equal(scopesResponse.statusCode, 200);
  assert.equal(scopesResponse.body.data.scopes[0].key, 'credit-simulation');
  assert.equal(loadResponse.statusCode, 200);
  assert.equal(loadResponse.body.data.graph.version, 1);
  assert.equal(saveResponse.statusCode, 201);
  assert.equal(saveResponse.body.data.graph.version, 1);
  assert.equal(saveResponse.body.data.validation.valid, true);
  assert.equal(validateResponse.statusCode, 200);
  assert.equal(validateResponse.body.data.validation.valid, true);
  assert.equal(simulateResponse.statusCode, 200);
  assert.equal(simulateResponse.body.data.simulation.summary.totalPayable, 1012);
  assert.equal(summaryResponse.statusCode, 200);
  assert.equal(summaryResponse.body.data.summary.latestSimulation.selectedSource, 'legacy');
  assert.deepEqual(calls, [
    ['listDagWorkbenchScopes', { actor: { id: 1, role: 'admin' } }],
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
  app.use(globalErrorHandler);
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

test('createCreditsRouter returns 403 for scope catalog when the DAG workbench is disabled', async () => {
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async listDagWorkbenchScopes() {
        const error = new Error('DAG workbench is not enabled');
        error.statusCode = 403;
        throw error;
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/workbench/scopes',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.success, false);
  assert.match(response.body.error.message, /workbench is not enabled/i);
});

// ── Variable Registry Integration Tests ──

test('createCreditsRouter lists variables with filters and pagination', async () => {
  const variables = [
    { id: 1, name: 'rate', type: 'percent', source: 'system_core', status: 'active' },
    { id: 2, name: 'score', type: 'integer', source: 'bureau_api', status: 'active' },
  ];

  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async listDagVariables({ filters, pagination }) {
        return {
          items: variables.filter((v) => {
            if (filters.type && v.type !== filters.type) return false;
            if (filters.source && v.source !== filters.source) return false;
            if (filters.status && v.status !== filters.status) return false;
            return true;
          }),
          pagination: { totalItems: variables.length, totalPages: 1, currentPage: pagination?.page || 1, pageSize: pagination?.pageSize || 20 },
        };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/workbench/variables?type=percent&source=system_core&status=active',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.variables.length, 1);
  assert.equal(response.body.data.variables[0].name, 'rate');
  assert.equal(response.body.data.pagination.totalItems, 2);
});

test('createCreditsRouter creates a variable and returns 201', async () => {
  const created = { id: 3, name: 'fee', type: 'currency', source: 'app_data', status: 'active' };

  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async createDagVariable({ actor, payload }) {
        return { ...created, createdByUserId: actor.id };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/workbench/variables',
    headers: { authorization: 'Bearer valid-token' },
    body: { name: 'fee', type: 'currency', source: 'app_data' },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.variable.name, 'fee');
});

test('createCreditsRouter rejects duplicate variable name with 409', async () => {
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async createDagVariable() {
        const error = new Error('Variable name already exists');
        error.statusCode = 409;
        throw error;
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'POST',
    path: '/workbench/variables',
    headers: { authorization: 'Bearer valid-token' },
    body: { name: 'rate', type: 'percent', source: 'system_core' },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.success, false);
  assert.match(response.body.error.message, /already exists/i);
});

test('createCreditsRouter updates a variable', async () => {
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async updateDagVariable({ id, payload }) {
        return { id, name: 'updatedRate', ...payload };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/workbench/variables/1',
    headers: { authorization: 'Bearer valid-token' },
    body: { status: 'deprecated' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.variable.status, 'deprecated');
});

test('createCreditsRouter deletes a variable', async () => {
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async deleteDagVariable() {
        return { deleted: true };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'DELETE',
    path: '/workbench/variables/1',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
});

// ── Activation atomicity ──

test('createCreditsRouter activates a graph version atomically', async () => {
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async activateDagWorkbenchGraph({ actor, graphId }) {
        return {
          graph: {
            id: graphId,
            scopeKey: 'credit-simulation',
            version: 2,
            status: 'active',
            name: 'V2',
          },
        };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/workbench/graphs/2/status',
    headers: { authorization: 'Bearer valid-token' },
    body: { status: 'active' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.graph.status, 'active');
});

test('createCreditsRouter rejects invalid status in graph activation', async () => {
  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases(),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'PATCH',
    path: '/workbench/graphs/2/status',
    headers: { authorization: 'Bearer valid-token' },
    body: { status: 'invalid' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.error.message, /Invalid status/i);
});

test('createCreditsRouter diff endpoint returns structured deltas', async () => {
  const diff = {
    previousGraph: {
      nodes: [{ id: 'n1', kind: 'formula', formula: 'Score > 700', outputVar: 'tier' }],
      edges: [],
    },
    newGraph: {
      nodes: [
        { id: 'n1', kind: 'formula', formula: 'Score > 750', outputVar: 'tier' },
        { id: 'n2', kind: 'formula', formula: '0.05', outputVar: 'rate2' },
      ],
      edges: [],
    },
    impactedVariables: ['tier', 'rate2', 'Score'],
    deltas: [
      { nodeId: 'n1', change: 'modified', oldFormula: 'Score > 700', newFormula: 'Score > 750', oldOutputVar: 'tier', newOutputVar: 'tier' },
      { nodeId: 'n2', change: 'added', newFormula: '0.05', newOutputVar: 'rate2' },
    ],
  };

  const router = createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    useCases: createUseCases({
      async getDagWorkbenchGraphDiff({ actor, graphId, compareToVersionId }) {
        return { diff };
      },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  app.use(globalErrorHandler);
  activeServer = await listen(app);

  const response = await requestJson(activeServer, {
    method: 'GET',
    path: '/workbench/graphs/2/diff?compareToVersionId=1',
    headers: { authorization: 'Bearer valid-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data.diff.deltas));
  assert.equal(response.body.data.diff.deltas.length, 2);
  assert.equal(response.body.data.diff.deltas[0].change, 'modified');
  assert.equal(response.body.data.diff.deltas[1].change, 'added');
  assert.ok(response.body.data.diff.impactedVariables.includes('tier'));
  assert.ok(response.body.data.diff.impactedVariables.includes('rate2'));
});
