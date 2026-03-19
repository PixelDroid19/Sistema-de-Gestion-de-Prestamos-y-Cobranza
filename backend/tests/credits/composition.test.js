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
  const composition = createCreditsComposition({
    infrastructure: {
      loanRepository: {},
      customerRepository: {},
      agentRepository: {},
      userRepository: {},
      creditDomainService: {},
      loanCreationService: {},
      notificationPort: {},
    },
    loanAccessPolicy,
    loanViewService,
  });

  const ports = createCreditsPublicPorts({ composition });

  assert.equal(ports.loanAccessPolicy, loanAccessPolicy);
  assert.equal(ports.loanViewService, loanViewService);
});
