const test = require('node:test');
const assert = require('node:assert/strict');

const { createCreditsComposition } = require('@/modules/credits/composition');
const { createCreditsPublicPorts } = require('@/modules/credits/public');

const PUBLIC_CREDIT_PORT_KEYS = [
  'alertRepository',
  'attachmentStorage',
  'loanAccessPolicy',
  'loanViewService',
  'paymentApplicationService',
  'promiseRepository',
].sort();

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
      loanCreationService: {},
      notificationPort: {},
    },
    loanAccessPolicy,
    loanViewService,
    paymentApplicationService,
  });

  const ports = createCreditsPublicPorts({ composition });

  assert.equal(ports.loanAccessPolicy, loanAccessPolicy);
  assert.equal(ports.loanViewService, loanViewService);
  assert.equal(ports.paymentApplicationService, paymentApplicationService);
  assert.deepEqual(Object.keys(ports).sort(), PUBLIC_CREDIT_PORT_KEYS);
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
      loanCreationService: {},
      notificationPort: {},
    },
    loanAccessPolicy,
    loanViewService,
    paymentApplicationService,
  });

  assert.equal(registeredName, 'credits');
  assert.equal(registeredPorts.loanAccessPolicy, loanAccessPolicy);
  assert.equal(registeredPorts.loanViewService, loanViewService);
  assert.equal(registeredPorts.paymentApplicationService, paymentApplicationService);
  assert.deepEqual(Object.keys(registeredPorts).sort(), PUBLIC_CREDIT_PORT_KEYS);
  assert.equal(composition.loanAccessPolicy, loanAccessPolicy);
});

test('createCreditsComposition only exposes runtime internals on the composition object', () => {
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
      loanCreationService: {},
      notificationPort: {},
    },
    loanAccessPolicy: { filterVisibleLoans() {} },
    loanViewService: { getCanonicalLoanView() { return { schedule: [], snapshot: {} }; } },
    paymentApplicationService: { applyPayment() {} },
  });

  const publicPorts = createCreditsPublicPorts({ composition });
  assert.deepEqual(Object.keys(publicPorts).sort(), PUBLIC_CREDIT_PORT_KEYS);
  assert.equal(composition.paymentRouter, undefined);
});

test('createCreditsPublicPorts filters ports already registered in the shared runtime', () => {
  const runtimePorts = {
    loanAccessPolicy: { filterVisibleLoans() {} },
    loanViewService: { getCanonicalLoanView() { return { schedule: [], snapshot: {} }; } },
    paymentApplicationService: { applyPayment() {} },
    attachmentStorage: {},
    alertRepository: {},
    promiseRepository: {},
    internalOnlyPort: {},
  };

  const ports = createCreditsPublicPorts({
    sharedRuntime: {
      getModulePorts(name) {
        assert.equal(name, 'credits');
        return runtimePorts;
      },
    },
  });

  assert.equal(ports.loanAccessPolicy, runtimePorts.loanAccessPolicy);
  assert.equal(ports.internalOnlyPort, undefined);
  assert.deepEqual(Object.keys(ports).sort(), PUBLIC_CREDIT_PORT_KEYS);
});
