# Late-fee Policy and Overdue Payoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make late-fee policy maintenance usable and allow overdue credits to be paid in full with penalties included.

**Architecture:** Keep policy replacement inside the configuration use-case transaction and reuse the existing update endpoint for editing. Separate payoff eligibility from capital-payment eligibility, extend the canonical payoff quote with the existing installment late-fee calculator, and persist the quote breakdown unchanged through payment execution.

**Tech Stack:** Node.js/Express/CommonJS, Sequelize, React/TypeScript, TanStack Query, Vitest/Testing Library, Node test runner, Railway.

## Global Constraints

- One active operational late-fee policy applies to new credits; existing credit snapshots do not change.
- Overdue installments block capital-only prepayments but not total payoff.
- No new dependencies and no database migration.
- All user-facing copy uses the existing terminology layer.

---

### Task 1: Atomic late-fee policy replacement

**Files:**
- Modify: `backend/src/modules/config/application/useCases.js`
- Test: `backend/tests/configModule.test.js`

**Interfaces:**
- Consumes: `configRepository.withTransaction(callback)` and late-fee category entries.
- Produces: `createLateFeePolicy(payload)` that archives active policies before creating the replacement in one transaction.

- [ ] **Step 1: Write the failing test**

Add a test that starts with an active medium-priority policy, creates another active policy, and expects the repository to update the old entry to `isActive: false` and create the new entry within the same transaction.

- [ ] **Step 2: Verify RED**

Run: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/configModule.test.js`

Expected: failure with the current same-priority conflict.

- [ ] **Step 3: Implement replacement**

Within the existing create transaction, list active late-fee entries and archive them before duplicate-priority validation and creation. Keep duplicate key/label validation and do not delete historical entries.

- [ ] **Step 4: Verify GREEN**

Run the Task 1 command and expect all tests to pass.

### Task 2: Create and edit policy interface

**Files:**
- Modify: `frontend/src/components/settings/LateFeePoliciesTab.tsx`
- Modify: `frontend/src/components/settings/settingsHelpers.ts`
- Modify: `frontend/src/i18n/terminology.ts`
- Test: `frontend/src/components/__tests__/Settings.behavior.test.tsx`

**Interfaces:**
- Consumes: existing `createLateFeePolicy.mutateAsync` and `updateLateFeePolicy.mutateAsync`.
- Produces: one create/edit modal whose update payload is `{ id, label, annualEffectiveRate, lateFeeMode }`.

- [ ] **Step 1: Write failing UI tests**

Replace the hidden-priority conflict assertion with tests that open Edit, preload the current values, submit an update, and create a replacement without client-side priority rejection.

- [ ] **Step 2: Verify RED**

Run: `cd frontend && npm run test -- --run src/components/__tests__/Settings.behavior.test.tsx`

Expected: edit action is missing and replacement mutation is not called.

- [ ] **Step 3: Implement modal state and copy**

Track the selected policy, preload its draft, route submit to create or update, add the Edit row action, and explain replacement semantics in the create modal. Remove client validation that compares hidden priorities.

- [ ] **Step 4: Verify GREEN**

Run the Task 2 command and expect all tests to pass.

### Task 3: Overdue payoff eligibility and quote

**Files:**
- Modify: `backend/src/modules/credits/application/paymentEligibility.js`
- Modify: `backend/src/modules/credits/application/loanFinancials.js`
- Test: `backend/tests/creditDomain.test.js`

**Interfaces:**
- Consumes: `calculateLateFee` and the loan schedule.
- Produces: `buildPayoffQuote()` with `breakdown.lateFee` and payoff eligibility that permits overdue installments.

- [ ] **Step 1: Write failing domain tests**

Assert that overdue payoff eligibility is allowed and that a quote includes the sum of per-installment late fees while retaining overdue principal and interest buckets.

- [ ] **Step 2: Verify RED**

Run: `cd backend && NODE_ENV=test node --require module-alias/register --test tests/creditDomain.test.js`

Expected: payoff remains denied or `breakdown.lateFee` is absent.

- [ ] **Step 3: Implement eligibility and quote**

Remove only `OVERDUE_UNPAID_INSTALLMENTS` from payoff eligibility. Compute late fees using the same mode, annual rate, date-only day count and overdue-base rule used by installment quotes.

- [ ] **Step 4: Verify GREEN**

Run the Task 3 command and expect all tests to pass.

### Task 4: Persist and present overdue payoff

**Files:**
- Modify: `backend/src/modules/credits/application/paymentApplicationService.js`
- Modify: `frontend/src/components/CreditDetails.tsx`
- Modify: `frontend/src/i18n/terminology.ts`
- Test: `backend/tests/paymentApplicationService.test.js`
- Test: `frontend/src/components/__tests__/CreditDetails.behavior.test.tsx`

**Interfaces:**
- Consumes: payoff quote with `breakdown.lateFee`.
- Produces: payoff payment with `penaltyApplied`, a `late_fee` allocation bucket, and an enabled frontend action for overdue credit.

- [ ] **Step 1: Write failing execution and UI tests**

Assert that `applyPayoff` closes an overdue loan, persists a payment whose allocations sum to the quoted amount, and that CreditDetails enables Pago total and shows the late-fee line.

- [ ] **Step 2: Verify RED**

Run the focused backend and frontend test files and expect failures on the old denial/missing penalty.

- [ ] **Step 3: Implement persistence and presentation**

Add `late_fee` to the allocation breakdown, set `penaltyApplied`, keep principal and interest fields unchanged, and render the penalty in the existing payoff confirmation summary.

- [ ] **Step 4: Verify GREEN**

Run the Task 4 focused commands and expect all tests to pass.

### Task 5: Regression, browser QA and Railway release

**Files:**
- Verify all modified files.

**Interfaces:**
- Consumes: committed master branch.
- Produces: healthy backend and frontend Railway deployments with browser-verified workflows.

- [ ] **Step 1: Run local quality gates**

Run `npm run lint`, `npm run test`, `cd frontend && npm run build`, and the full backend test command from repository guidelines.

- [ ] **Step 2: Run local browser QA**

Verify policy create/edit and overdue payoff at desktop viewport, inspect console and target network requests, and confirm no test records remain unless the local fixture requires them.

- [ ] **Step 3: Review, commit and push**

Review `git diff`, commit scoped changes, push `master`, and confirm `origin/master` points to the release commit.

- [ ] **Step 4: Deploy and verify Railway**

Resolve project/service context, deploy both backend and frontend explicitly, wait for successful status, inspect bounded logs, then repeat the two browser workflows against production.
