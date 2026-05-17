const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Architectural lock for AGENTS.md Contract 2 (Amount-Based Rate Parameterization):
// "Existing loans must not be recalculated when future rate policies change.
//  Do not reintroduce manual rate mutation for an already-created loan."
//
// This guard ensures no new endpoint or use case is added that mutates a Loan's
// interestRate / ratePolicyId / policySnapshot AFTER creation. Only late-fee rate
// is allowed to be updated (separate admin-guarded operation), and it must not
// touch interestRate.

const repoRoot = path.resolve(__dirname, '..', '..');
const creditsRouterPath = path.join(repoRoot, 'backend/src/modules/credits/presentation/router.js');
const creditsUseCasesPath = path.join(repoRoot, 'backend/src/modules/credits/application/useCases.js');
const loanCreationPath = path.join(repoRoot, 'backend/src/modules/credits/infrastructure/loanCreation.js');

const readSource = (p) => fs.readFileSync(p, 'utf8');

test('credits router exposes no endpoint that mutates a loan interestRate after creation', () => {
  const source = readSource(creditsRouterPath);

  // Allowed mutation endpoints — anything else mutating loans is suspect.
  const allowedMutationPaths = [
    "router.patch('/:id/status'",
    "router.patch('/:id/recovery-status'",
    "router.patch('/:loanId/alerts/:alertId/status'",
    "router.patch('/:loanId/promises/:promiseId/status'",
    "router.patch('/:loanId/payments/:paymentId'",
    "router.patch('/:loanId/late-fee-rate'",
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
      `Unexpected loan-mutating endpoint detected: ${match}. If you are adding a new endpoint, confirm it does not mutate loan.interestRate, loan.ratePolicyId, or loan.policySnapshot, then extend the allowlist in this test.`,
    );
  }
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

test('loan creation persists policySnapshot and resolved interestRate from policy', () => {
  const source = readSource(loanCreationPath);
  assert.match(source, /policySnapshot/, 'loanCreation must persist policySnapshot');
  assert.match(source, /calculationProfileVersionId/, 'loanCreation must persist calculationProfileVersionId');
  // Confirms manual rate source is rejected at the creation boundary.
  assert.match(source, /rateSource/, 'loanCreation must enforce rateSource through policy resolver');
});
