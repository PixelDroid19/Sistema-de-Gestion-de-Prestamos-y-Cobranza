const test = require('node:test');
const assert = require('node:assert/strict');
const { createLoanCorrectionService, CORRECTION_UNAVAILABLE } = require('@/modules/credits/infrastructure/loanCorrection');
const { createCorrectLoanOrigination } = require('@/modules/credits/application/useCases');
const { DEFAULT_CALCULATION_PROFILE } = require('@/modules/credits/domain/calculation/calculationProfiles');
const { calculateCredit } = require('@/modules/credits/domain/calculation/creditCalculationEngine');
const { AuthorizationError, ValidationError } = require('@/utils/errorHandler');

const buildScenario = ({ hasPayment = false, status = 'pending' } = {}) => {
  const originalSchedule = calculateCredit({
    input: { amount: 1000000, interestRate: 60, termMonths: 3, startDate: '2026-08-01', lateFeeMode: 'SIMPLE' },
    profileVersion: { ...DEFAULT_CALCULATION_PROFILE, id: 8 },
  }).schedule;
  const payments = [];
  if (hasPayment) {
    const first = originalSchedule[0];
    first.paidPrincipal = first.principalComponent;
    first.paidInterest = first.interestComponent;
    first.paidTotal = first.scheduledPayment;
    first.remainingPrincipal = 0;
    first.remainingInterest = 0;
    first.status = 'paid';
    payments.push({
      id: 7, status: 'completed', paymentType: 'installment', amount: first.scheduledPayment,
      paymentDate: '2026-09-01', installmentNumber: 1,
      principalApplied: first.paidPrincipal, interestApplied: first.paidInterest, penaltyApplied: 0,
    });
  }
  const transaction = { id: 'correction-transaction' };
  const calls = [];
  const loan = {
    id: 31, status, amount: 1000000, interestRate: 60, termMonths: 3,
    startDate: '2026-08-01', totalPaid: hasPayment ? originalSchedule[0].paidTotal : 0, associateId: null, financialBlock: {},
    calculationMethod: 'FRENCH', calculationProfileVersionId: 8,
    lateFeeMode: 'SIMPLE', annualLateFeeRate: 12, lateFeePolicyId: 5,
    emiSchedule: originalSchedule,
    financialSnapshot: { totalPaidPenalty: 0, totalPaidAccruedInterest: 0 },
    policySnapshot: { rateSource: 'policy', ratePolicyId: 3, lateFeeSource: 'policy', lateFeePolicyId: 5 },
    set(values) { calls.push(['set', values]); Object.assign(this, values); },
    async save(options) { calls.push(['save', options]); return this; },
  };
  const correctionService = createLoanCorrectionService({
    loanModel: {
      sequelize: { transaction: async (handler) => handler(transaction) },
      findByPk: async (id, options) => { calls.push(['find', id, options]); return loan; },
    },
    paymentModel: { findAll: async () => payments },
    alertModel: { count: async () => 0 },
    promiseModel: { count: async () => 0 },
    profileModel: { findByPk: async () => ({ toJSON: () => ({ ...DEFAULT_CALCULATION_PROFILE, id: 8, status: 'inactive' }) }) },
  });
  return { correctionService, loan, originalSchedule, payments, calls, transaction };
};

const correction = { amount: 1200000, interestRate: 27.5, termMonths: 4, startDate: '2026-08-15' };

test('admin correction rebuilds the schedule with the original profile under a row lock', async () => {
  const { correctionService, loan, calls, transaction } = buildScenario();
  const correct = createCorrectLoanOrigination({ loanCorrectionService: correctionService });
  const result = await correct({ actor: { id: 9, role: 'admin' }, loanId: 31, payload: correction });
  assert.equal(result, loan);
  assert.deepEqual(calls[0], ['find', 31, { transaction, lock: true }]);
  assert.equal(loan.amount, 1200000);
  assert.equal(loan.interestRate, 27.5);
  assert.equal(loan.termMonths, 4);
  assert.equal(loan.emiSchedule.length, 4);
  assert.equal(loan.startDate.toISOString().slice(0, 10), '2026-08-15');
  assert.equal(loan.emiSchedule[0].dueDate.slice(0, 10), '2026-09-15');
  assert.equal(loan.ratePolicyId, null);
  assert.equal(loan.policySnapshot.rateSource, 'manual');
  assert.equal(loan.policySnapshot.appliedInterestRate, 27.5);
  assert.equal(loan.policySnapshot.lateFeePolicyId, 5);
  assert.equal(loan.calculationProfileVersionId, 8);
  assert.equal(loan.financialSnapshot.policySnapshot.appliedInterestRate, 27.5);
  assert.deepEqual(loan.financialSnapshot.correctionHistory[0].before, {
    amount: 1000000, interestRate: 60, termMonths: 3, startDate: '2026-08-01', rateSource: 'policy',
    policySnapshot: { rateSource: 'policy', ratePolicyId: 3, lateFeeSource: 'policy', lateFeePolicyId: 5 },
  });
  assert.equal(loan.financialSnapshot.correctionHistory[0].actorId, 9);
  assert.deepEqual(calls.at(-1), ['save', { transaction }]);
});

test('correction keeps posted payment and paid installment intact, and recalculates only remaining installments', async () => {
  const { correctionService, loan, originalSchedule, payments } = buildScenario({ hasPayment: true, status: 'active' });
  const firstPayment = structuredClone(payments[0]);
  const firstInstallment = structuredClone(originalSchedule[0]);
  const totalPaidBefore = loan.totalPaid;
  await correctionService.correct({ loanId: 31, actorId: 9, ...correction });
  assert.deepEqual(payments[0], firstPayment);
  assert.deepEqual(loan.emiSchedule[0], firstInstallment);
  assert.equal(loan.emiSchedule.length, 4);
  assert.equal(loan.emiSchedule[1].installmentNumber, 2);
  assert.equal(loan.emiSchedule[1].dueDate.slice(0, 10), '2026-10-15');
  assert.equal(loan.totalPaid, totalPaidBefore);
  assert.equal(loan.financialSnapshot.totalPrincipal, 1200000);
  assert.equal(loan.financialSnapshot.correctionHistory[0].mode, 'future_installments');
});

test('correction rejects an amount or term that would invalidate paid installments', async () => {
  const { correctionService, calls } = buildScenario({ hasPayment: true, status: 'active' });
  await assert.rejects(() => correctionService.correct({ loanId: 31, actorId: 9, ...correction, termMonths: 1 }),
    (error) => error instanceof ValidationError && /plazo/.test(error.message));
  await assert.rejects(() => correctionService.correct({ loanId: 31, actorId: 9, ...correction, amount: 1 }),
    (error) => error instanceof ValidationError && /monto/.test(error.message));
  assert.equal(calls.some(([action]) => action === 'save'), false);
});

test('correction rejects dates that precede paid history or reverse installment order', async () => {
  const { correctionService, loan, calls } = buildScenario({ hasPayment: true, status: 'active' });
  await assert.rejects(() => correctionService.correct({ loanId: 31, actorId: 9, ...correction, startDate: '2026-09-15' }),
    (error) => error instanceof ValidationError && /fecha de desembolso/.test(error.message));
  loan.emiSchedule[0].dueDate = '2026-12-01';
  await assert.rejects(() => correctionService.correct({ loanId: 31, actorId: 9, ...correction }),
    (error) => error instanceof ValidationError && /cuotas pendientes/.test(error.message));
  assert.equal(calls.some(([action]) => action === 'save'), false);
});

test('correction rejects completed payments missing from the preserved schedule', async () => {
  const { correctionService, payments, calls } = buildScenario({ hasPayment: true, status: 'active' });
  payments[0].installmentNumber = 3;
  await assert.rejects(() => correctionService.correct({ loanId: 31, actorId: 9, ...correction }),
    (error) => error instanceof ValidationError && /no concilian/.test(error.message));
  assert.equal(calls.some(([action]) => action === 'save'), false);
});

test('correction rejects alerts and cancelled installments before changing balances', async () => {
  const { correctionService, loan, payments, calls } = buildScenario({ hasPayment: true, status: 'active' });
  payments.push({ id: 8, status: 'annulled', paymentType: 'installment' });
  await assert.rejects(() => correctionService.correct({ loanId: 31, actorId: 9, ...correction }),
    (error) => error instanceof ValidationError && error.message === CORRECTION_UNAVAILABLE);
  assert.equal(loan.amount, 1000000);
  assert.equal(calls.some(([action]) => action === 'save'), false);
});

test('correction rejects unauthorized users and invalid terms before persistence', async () => {
  const { correctionService, calls } = buildScenario();
  const correct = createCorrectLoanOrigination({ loanCorrectionService: correctionService });
  await assert.rejects(() => correct({ actor: { role: 'employee' }, loanId: 31, payload: correction }), AuthorizationError);
  await assert.rejects(() => correct({ actor: { role: 'admin' }, loanId: 31, payload: { ...correction, interestRate: 27.12345 } }), ValidationError);
  await assert.rejects(() => correct({ actor: { role: 'admin' }, loanId: 31, payload: { ...correction, startDate: '2026-02-30' } }), ValidationError);
  assert.equal(calls.length, 0);
});
