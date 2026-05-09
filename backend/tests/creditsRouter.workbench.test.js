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

const allowAuth = (user) => () => (req, _res, next) => {
  req.user = user;
  next();
};

const unexpectedUseCase = (name) => async () => {
  throw new Error(`${name} should not be called`);
};

const noopLoanValidation = {
  create(_req, _res, next) { next(); },
  simulate(_req, _res, next) { next(); },
  updateStatus(_req, _res, next) { next(); },
  payoffQuote(_req, _res, next) { next(); },
  payoffExecute(_req, _res, next) { next(); },
};

const noopAttachmentUpload = {
  single() {
    return (_req, _res, next) => next();
  },
};

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(createCreditsRouter({
    authMiddleware: allowAuth({ id: 1, role: 'admin' }),
    attachmentUpload: noopAttachmentUpload,
    loanValidation: noopLoanValidation,
    paymentApplicationService: {},
    useCases: {
      createCreditCalculation: unexpectedUseCase('createCreditCalculation'),
      listLoans: unexpectedUseCase('listLoans'),
      createLoan: unexpectedUseCase('createLoan'),
    },
  }));
  app.use(globalErrorHandler);
  return app;
};

test('createCreditsRouter does not mount retired formula workbench routes', async () => {
  activeServer = await listen(createApp());

  const routes = [
    { method: 'GET', path: '/workbench/scopes' },
    { method: 'GET', path: '/workbench/graph?scope=credit-calculation' },
    { method: 'POST', path: '/workbench/graph', body: { scopeKey: 'credit-calculation', graph: { nodes: [], edges: [] } } },
    { method: 'POST', path: '/workbench/graph/validate', body: { scopeKey: 'credit-calculation', graph: { nodes: [], edges: [] } } },
    { method: 'POST', path: '/workbench/graph/calculations', body: { scopeKey: 'credit-calculation', graph: { nodes: [], edges: [] } } },
    { method: 'GET', path: '/workbench/graphs' },
    { method: 'GET', path: '/workbench/graphs/1' },
    { method: 'PATCH', path: '/workbench/graphs/1/status', body: { status: 'active' } },
    { method: 'DELETE', path: '/workbench/graphs/1' },
    { method: 'GET', path: '/workbench/variables' },
    { method: 'POST', path: '/workbench/variables', body: { name: 'riskTier' } },
  ];

  for (const route of routes) {
    const response = await requestJson(activeServer, {
      method: route.method,
      path: route.path,
      headers: { authorization: 'Bearer valid-token' },
      body: route.body,
    });

    assert.equal(response.statusCode, 404, `${route.method} ${route.path}`);
  }
});
