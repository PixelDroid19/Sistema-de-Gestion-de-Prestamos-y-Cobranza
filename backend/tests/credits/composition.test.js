const test = require('node:test');
const assert = require('node:assert/strict');

const { createCreditsComposition } = require('../../src/modules/credits/composition');
const { createCreditsPublicPorts } = require('../../src/modules/credits/public');

test('createCreditsPublicPorts reuses an existing credits composition seam', () => {
  const loanAccessPolicy = { filterVisibleLoans() {} };
  const loanViewService = {
    getCanonicalLoanView() {
      return { schedule: [], snapshot: {} };
    },
    getSnapshot() {
      return { outstandingBalance: 0 };
    },
  };
  const paymentApplicationService = {
    applyPayment() {},
    applyPartialPayment() {},
    applyCapitalPayment() {},
    applyPayoff() {},
    annulInstallment() {},
  };
  const dagWorkbenchService = { loadGraph() {}, saveGraph() {} };
  const composition = createCreditsComposition({
    infrastructure: {
      loanRepository: {},
      customerRepository: {},
      recoveryAssignmentRepository: {},
      userRepository: {},
      attachmentRepository: {},
      alertRepository: {},
      promiseRepository: {},
      paymentRepository: {},
      attachmentStorage: {},
      creditDomainService: {},
      dagGraphRepository: {},
      dagSimulationSummaryRepository: {},
      loanCreationService: {},
      notificationPort: {},
    },
    loanAccessPolicy,
    loanViewService,
    paymentApplicationService,
    dagWorkbenchService,
  });

  const ports = createCreditsPublicPorts({ composition });

  assert.equal(ports.loanAccessPolicy, loanAccessPolicy);
  assert.equal(ports.loanViewService, loanViewService);
  assert.equal(ports.paymentApplicationService, paymentApplicationService);
  assert.equal(ports.dagWorkbenchService, dagWorkbenchService);
});

test('createCreditsComposition registers its public ports in the shared runtime', () => {
  let registeredName;
  let registeredPorts;
  const sharedRuntime = {
    registerModulePorts(name, ports) {
      registeredName = name;
      registeredPorts = ports;
      return ports;
    },
  };
  const loanAccessPolicy = { filterVisibleLoans() {} };
  const loanViewService = {
    getCanonicalLoanView() {
      return { schedule: [], snapshot: {} };
    },
  };
  const paymentApplicationService = {
    applyPayment() {},
    applyPartialPayment() {},
    applyCapitalPayment() {},
    applyPayoff() {},
    annulInstallment() {},
  };
  const dagWorkbenchService = { loadGraph() {} };

  const composition = createCreditsComposition({
    sharedRuntime,
    infrastructure: {
      loanRepository: {},
      customerRepository: {},
      recoveryAssignmentRepository: {},
      userRepository: {},
      attachmentRepository: {},
      alertRepository: {},
      promiseRepository: {},
      paymentRepository: {},
      attachmentStorage: {},
      creditDomainService: {},
      dagGraphRepository: {},
      dagSimulationSummaryRepository: {},
      loanCreationService: {},
      notificationPort: {},
    },
    loanAccessPolicy,
    loanViewService,
    paymentApplicationService,
    dagWorkbenchService,
  });

  assert.equal(registeredName, 'credits');
  assert.equal(registeredPorts.loanAccessPolicy, loanAccessPolicy);
  assert.equal(registeredPorts.loanViewService, loanViewService);
  assert.equal(registeredPorts.paymentApplicationService, paymentApplicationService);
  assert.equal(registeredPorts.dagWorkbenchService, dagWorkbenchService);
  assert.equal(composition.loanAccessPolicy, loanAccessPolicy);
});

test('createCreditsComposition keeps a credits-local DAG config on the composition seam', () => {
  const dagConfig = {
    mode: 'shadow',
    parityTolerance: 0.01,
    workbenchEnabled: false,
    workbenchScopes: [],
    isScopeEnabled() {
      return true;
    },
  };
  const composition = createCreditsComposition({
    dagConfig,
    infrastructure: {
      loanRepository: {},
      customerRepository: {},
      recoveryAssignmentRepository: {},
      userRepository: {},
      attachmentRepository: {},
      alertRepository: {},
      promiseRepository: {},
      paymentRepository: {},
      attachmentStorage: {},
      creditDomainService: {},
      dagGraphRepository: {},
      dagSimulationSummaryRepository: {},
      loanCreationService: {},
      notificationPort: {},
    },
    loanAccessPolicy: { filterVisibleLoans() {} },
    loanViewService: { getCanonicalLoanView() { return { schedule: [], snapshot: {} }; } },
    paymentApplicationService: { applyPayment() {} },
  });

  assert.equal(composition.creditsDagConfig, dagConfig);
  assert.equal(composition.creditsDagConfig.mode, 'shadow');
  assert.equal(composition.creditsDagConfig.parityTolerance, 0.01);
  assert.equal(composition.creditsDagConfig.workbenchEnabled, false);
});

test('createCreditsPublicPorts prefers ports already registered in the shared runtime', () => {
  const runtimePorts = {
    loanAccessPolicy: { filterVisibleLoans() {} },
    loanViewService: { getCanonicalLoanView() { return { schedule: [], snapshot: {} }; } },
    paymentApplicationService: { applyPayment() {} },
    dagWorkbenchService: { loadGraph() {} },
  };

  const ports = createCreditsPublicPorts({
    sharedRuntime: {
      getModulePorts(name) {
        assert.equal(name, 'credits');
        return runtimePorts;
      },
    },
  });

  assert.equal(ports, runtimePorts);
});
