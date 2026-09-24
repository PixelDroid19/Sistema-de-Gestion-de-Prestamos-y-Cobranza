const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Existing loans never change when rate policies change. The explicit admin
// origination correction is the only path allowed to replace agreed terms;
// its behavior and payment-history guards are covered by loanCorrection.test.js.

const repoRoot = path.resolve(__dirname, '..', '..');
const creditsRouterPath = path.join(repoRoot, 'backend/src/modules/credits/presentation/router.js');
const creditsUseCasesPath = path.join(repoRoot, 'backend/src/modules/credits/application/useCases.js');
const loanCreationPath = path.join(repoRoot, 'backend/src/modules/credits/infrastructure/loanCreation.js');

const readSource = (p) => fs.readFileSync(p, 'utf8');

test('credits router exposes only reviewed loan mutation endpoints', () => {
  const source = readSource(creditsRouterPath);

  // Allowed mutation endpoints — anything else mutating loans is suspect.
  const allowedMutationPaths = [
    "router.patch('/:id/status'",
    "router.patch('/:id/recovery-status'",
    "router.patch('/:loanId/alerts/:alertId/status'",
    "router.patch('/:loanId/promises/:promiseId/status'",
    "router.patch('/:loanId/payments/:paymentId'",
    "router.patch('/:loanId/late-fee-rate'",
    "router.patch('/:id/origination'",
    "router.delete('/:id'",
  ];

  // Make sure every PATCH/PUT/DELETE in the file is on the allowlist. This forces
  // anyone adding a new mutation route to either extend the allowlist (and think
  // about whether they're violating the rate-freeze contract) or rework.
  const mutationRegex = /router\.(patch|put|delete)\(\s*['"][^'"]+['"]/g;
  const matches = source.match(mutationRegex) || [];
  for (const match of matches) {
    const normalized = match.replace(/router\.(patch|put|delete)\(\s*/, (full, verb) => `router.${verb}(`).replace(/\s+/g, '');
    const isAllowed = allowedMutationPaths.some((allowed) => normalized.startsWith(allowed.replace(/\s+/g, '')));
    assert.ok(
      isAllowed,
      `Unexpected loan-mutating endpoint detected: ${match}. Review its effect on persisted loan terms and payment history before extending the allowlist.`,
    );
  }
});

test('origination correction is explicitly restricted to administrators', () => {
  const source = readSource(creditsRouterPath);
  assert.match(source, /router\.patch\('\/:id\/origination', authMiddleware\(\['admin'\]\)/);
});

test('credits use cases expose no operation that overwrites a persisted loan interestRate', () => {
  const source = readSource(creditsUseCasesPath);
  const forbiddenPatterns = [
    /loan\.update\([^)]*interestRate/,
    /loan\.update\([^)]*ratePolicyId/,
    /loan\.update\([^)]*policySnapshot/,
    /updateLoanInterestRate/,
    /setLoanInterestRate/,
    /overrideLoanRate/,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `Credits use cases must not mutate persisted rate data (matched ${pattern}). Rates are frozen at creation via loanCreation.js policySnapshot.`,
    );
  }
});

test('loan creation persists policySnapshot and resolved interestRate at origination', () => {
  const source = readSource(loanCreationPath);
  assert.match(source, /policySnapshot/, 'loanCreation must persist policySnapshot');
  assert.match(source, /calculationProfileVersionId/, 'loanCreation must persist calculationProfileVersionId');
  // Both configured and agreed rates are frozen at the creation boundary.
  assert.match(source, /rateSource/, 'loanCreation must enforce rateSource through policy resolver');
});
