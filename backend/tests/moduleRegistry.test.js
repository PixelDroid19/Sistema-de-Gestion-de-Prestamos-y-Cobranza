const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildModuleRegistry } = require('../src/modules');

test('buildModuleRegistry includes every modularized backend surface', () => {
  const registry = buildModuleRegistry();
  const byName = Object.fromEntries(registry.map((moduleRegistration) => [moduleRegistration.name, moduleRegistration.basePath]));

  assert.equal(byName.auth, '/api/auth');
  assert.equal(byName.customers, '/api/customers');
  assert.equal(byName.credits, '/api/loans');
  assert.equal(byName.payouts, '/api/payments');
  assert.equal(byName.agents, '/api/agents');
  assert.equal(byName.associates, '/api/associates');
  assert.equal(byName.reports, '/api/reports');
  assert.equal(byName.notifications, '/api/notifications');
  assert.equal(byName.users, '/api/users');
});

test('legacy route and controller wiring has been removed for every migrated surface', () => {
  const backendRoot = path.join(__dirname, '..');

  const removedFiles = [
    'src/controllers/authController.js',
    'src/controllers/agentController.js',
    'src/controllers/associateController.js',
    'src/controllers/customerController.js',
    'src/controllers/loanController.js',
    'src/controllers/notificationController.js',
    'src/controllers/paymentController.js',
    'src/controllers/reportController.js',
    'src/routes/auth.js',
    'src/routes/agent.js',
    'src/routes/associate.js',
    'src/routes/customer.js',
    'src/routes/loan.js',
    'src/routes/notification.js',
    'src/routes/payment.js',
    'src/routes/report.js',
  ];

  removedFiles.forEach((relativePath) => {
    assert.equal(fs.existsSync(path.join(backendRoot, relativePath)), false, `${relativePath} should be removed`);
  });
});
