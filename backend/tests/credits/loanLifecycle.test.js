const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const models = require('@/models');
const { getCanonicalLoanView } = require('@/modules/credits/application/loanFinancials');
const {
  createLoanFromCanonicalDataFactory,
} = require('@/modules/credits/infrastructure/loanCreation');
const { ValidationError } = require('@/utils/errorHandler');

afterEach(() => {
  mock.restoreAll();
});

test('createLoanFromCanonicalData persists the canonical schedule and summary via calculation profile', async () => {
  let persistedPayload;

  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Test' }));
  mock.method(models.Associate, 'findByPk', async (id) => ({ id, name: 'Associate Test' }));
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Personal Loan 12%' }));
  mock.method(models.Loan, 'create', async (payload) => {
    persistedPayload = payload;
    return { id: 77, ...payload };
  });

  // Build a calculationService that returns a profile-backed result
  const createLoan = createLoanFromCanonicalDataFactory({
    calculationService: {
      async calculate(input) {
        return {
          calculationProfileVersionId: 501,
          result: {
            lateFeeMode: 'NONE',
            method: 'FRENCH',
            schedule: Array.from({ length: input.termMonths }, (_, i) => ({
              installmentNumber: i + 1,
              dueDate: new Date(Date.now() + (i + 1) * 30 * 86400000).toISOString(),
              scheduledPayment: 1066.19,
              principalComponent: 1000,
              interestComponent: 66.19,
              paidPrincipal: 0,
              paidInterest: 0,
              paidTotal: 0,
              remainingPrincipal: 1000,
              remainingInterest: 66.19,
              remainingBalance: 1066.19,
              status: 'pending',
            })),
            summary: {
              installmentAmount: 1066.19,
              totalPayable: 12794.23,
              totalPaid: 0,
              outstandingPrincipal: 12000,
              outstandingInterest: 794.23,
              outstandingBalance: 12794.23,
              outstandingInstallments: input.termMonths,
              nextInstallment: null,
            },
          },
        };
      },
    },
  });

  const createdLoan = await createLoan({
    customerId: 1,
    amount: 12000,
    interestRate: 12,
    rateSource: 'policy',
    lateFeeSource: 'policy',
    termMonths: 12,
    lateFeeMode: 'none',
    startDate: '2026-04-24',
  });

  assert.equal(createdLoan.id, 77);
  assert.equal(persistedPayload.customerId, 1);
  assert.equal(persistedPayload.associateId, null);
  assert.equal(persistedPayload.financialProductId, 'prod-default');
  assert.equal(persistedPayload.status, 'pending');
  assert.equal(persistedPayload.startDate.toISOString(), '2026-04-24T00:00:00.000Z');
  assert.equal(persistedPayload.financialSnapshot.startDate, '2026-04-24T00:00:00.000Z');
  assert.equal(persistedPayload.lateFeeMode, 'NONE');
  assert.equal(persistedPayload.emiSchedule.length, 12);
  assert.equal(persistedPayload.installmentAmount, 1066.19);
  assert.equal(persistedPayload.totalPayable, 12794.23);
  assert.equal(Object.prototype.hasOwnProperty.call(persistedPayload, ['dag', 'GraphVersionId'].join('')), false);
  assert.equal(persistedPayload.calculationProfileVersionId, 501);
  assert.equal(persistedPayload.calculationMethod, 'FRENCH');
  assert.equal(persistedPayload.financialSnapshot.outstandingBalance, 12794.23);
  assert.equal(persistedPayload.financialSnapshot.outstandingInstallments, 12);
});

test('createLoanFromCanonicalData rejects assigning associates to new credits', async () => {
  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Test' }));

  const createLoan = createLoanFromCanonicalDataFactory({
    calculationService: {
      async calculate() {
        throw new Error('calculation should not run when associateId is provided');
      },
    },
  });

  await assert.rejects(
    () => createLoan({
      customerId: 1,
      associateId: 3,
      amount: 12000,
      interestRate: 12,
      rateSource: 'policy',
      lateFeeSource: 'policy',
      termMonths: 12,
      lateFeeMode: 'none',
      startDate: '2026-04-24',
    }),
    (error) => {
      assert.equal(error.message, 'Los socios se gestionan como inversionistas y no se asignan a créditos nuevos');
      return true;
    },
  );
});

test('createLoanFromCanonicalData rejects manual late-fee source for new credits', async () => {
  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Test' }));

  const createLoan = createLoanFromCanonicalDataFactory({
    calculationService: {
      async calculate() {
        throw new Error('calculation should not run when lateFeeSource is manual');
      },
    },
  });

  await assert.rejects(
    () => createLoan({
      customerId: 1,
      amount: 12000,
      interestRate: 12,
      rateSource: 'policy',
      lateFeeSource: 'manual',
      termMonths: 12,
      lateFeeMode: 'none',
      startDate: '2026-04-24',
    }),
    (error) => {
      assert.equal(error.message, 'La creación de créditos debe usar una política de mora configurada');
      return true;
    },
  );
});

test('createLoanFromCanonicalData stores the selected payment date without timezone drift', async () => {
  let persistedPayload;

  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Test' }));
  mock.method(models.Associate, 'findByPk', async () => null);
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Personal Loan 12%' }));
  mock.method(models.Loan, 'create', async (payload) => {
    persistedPayload = payload;
    return { id: 79, ...payload };
  });

  const createLoan = createLoanFromCanonicalDataFactory({
    calculationService: {
      async calculate(input) {
        return {
          calculationProfileVersionId: 501,
          result: {
            lateFeeMode: 'NONE',
            method: 'FRENCH',
            schedule: [{
              installmentNumber: 1,
              dueDate: '2026-04-29T00:00:00.000Z',
              scheduledPayment: 100,
              principalComponent: 90,
              interestComponent: 10,
              paidPrincipal: 0,
              paidInterest: 0,
              paidTotal: 0,
              remainingPrincipal: 90,
              remainingInterest: 10,
              remainingBalance: 0,
              status: 'pending',
            }],
            summary: {
              installmentAmount: 100,
              totalPayable: 100,
              totalPaid: 0,
              outstandingPrincipal: 90,
              outstandingInterest: 10,
              outstandingBalance: 100,
              outstandingInstallments: 1,
              nextInstallment: null,
              startDate: input.startDate,
            },
          },
        };
      },
    },
  });

  await createLoan({
    customerId: 1,
    amount: 1000,
    interestRate: 12,
    rateSource: 'policy',
    lateFeeSource: 'policy',
    termMonths: 1,
    lateFeeMode: 'none',
    startDate: '2026-04-29T23:30:00-05:00',
  });

  assert.equal(persistedPayload.startDate.toISOString(), '2026-04-29T00:00:00.000Z');
  assert.equal(persistedPayload.financialSnapshot.startDate, '2026-04-29T00:00:00.000Z');
});

test('createLoanFromCanonicalDataFactory persists profile-selected results with calculationProfileVersionId', async () => {
  let persistedPayload;

  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Test' }));
  mock.method(models.Associate, 'findByPk', async () => null);
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Personal Loan 12%' }));
  mock.method(models.Loan, 'create', async (payload) => {
    persistedPayload = payload;
    return { id: 88, ...payload };
  });

  const createLoan = createLoanFromCanonicalDataFactory({
    calculationService: {
      async calculate() {
        return {
          calculationProfileVersionId: 501,
          result: {
            lateFeeMode: 'NONE',
            method: 'FRENCH',
            schedule: [{ installmentNumber: 1, scheduledPayment: 90 }],
            summary: {
              installmentAmount: 90,
              totalPayable: 90,
              totalPaid: 0,
              outstandingPrincipal: 80,
              outstandingInterest: 10,
              outstandingBalance: 90,
              outstandingInstallments: 1,
            },
          },
        };
      },
    },
  });

  const createdLoan = await createLoan({
    customerId: 1,
    amount: 90,
    interestRate: 12,
    rateSource: 'policy',
    lateFeeSource: 'policy',
    termMonths: 1,
  });

  assert.equal(createdLoan.id, 88);
  assert.equal(Object.prototype.hasOwnProperty.call(persistedPayload, ['dag', 'GraphVersionId'].join('')), false);
  assert.equal(persistedPayload.calculationProfileVersionId, 501);
  assert.equal(persistedPayload.installmentAmount, 90);
  assert.equal(persistedPayload.totalPayable, 90);
  assert.equal(persistedPayload.financialSnapshot.outstandingBalance, 90);
  assert.equal(persistedPayload.emiSchedule[0].scheduledPayment, 90);
});

test('createLoanFromCanonicalDataFactory persists resolved rate and late-fee policies in the loan snapshot', async () => {
  let persistedPayload;
  let calculationInput;

  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Test' }));
  mock.method(models.Associate, 'findByPk', async () => null);
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Personal Loan 12%' }));
  mock.method(models.Loan, 'create', async (payload) => {
    persistedPayload = payload;
    return { id: 90, ...payload };
  });

  const createLoan = createLoanFromCanonicalDataFactory({
    policyResolver: {
      async resolve({ input }) {
        return {
          calculationInput: {
            ...input,
            interestRate: 48,
            lateFeeMode: 'SIMPLE',
            annualLateFeeRate: 30,
          },
          policySnapshot: {
            ratePolicyId: 10,
            ratePolicyLabel: 'Tasa estándar',
            lateFeePolicyId: 20,
            lateFeePolicyLabel: 'Mora simple',
            appliedInterestRate: 48,
            appliedLateFeeMode: 'SIMPLE',
            appliedAnnualLateFeeRate: 30,
          },
        };
      },
    },
    calculationService: {
      async calculate(input) {
        calculationInput = input;
        return {
          calculationProfileVersionId: 701,
          result: {
            lateFeeMode: input.lateFeeMode,
            method: 'FRENCH',
            schedule: [{ installmentNumber: 1, scheduledPayment: 120, principalComponent: 100, interestComponent: 20 }],
            summary: {
              installmentAmount: 120,
              totalPayable: 120,
              totalPaid: 0,
              outstandingPrincipal: 100,
              outstandingInterest: 20,
              outstandingBalance: 120,
              outstandingInstallments: 1,
            },
          },
        };
      },
    },
  });

  const loan = await createLoan({
    customerId: 1,
    amount: 100,
    interestRate: 12,
    termMonths: 1,
    rateSource: 'policy',
    lateFeeSource: 'policy',
  });

  assert.equal(loan.id, 90);
  assert.equal(calculationInput.interestRate, 48);
  assert.equal(calculationInput.lateFeeMode, 'SIMPLE');
  assert.equal(persistedPayload.interestRate, 48);
  assert.equal(persistedPayload.annualLateFeeRate, 30);
  assert.equal(persistedPayload.financialSnapshot.policySnapshot.ratePolicyId, 10);
  assert.equal(persistedPayload.financialSnapshot.policySnapshot.lateFeePolicyId, 20);
  assert.equal(persistedPayload.ratePolicyId, 10);
  assert.equal(persistedPayload.lateFeePolicyId, 20);
  assert.equal(persistedPayload.policySnapshot.appliedInterestRate, 48);
});

test('createLoanFromCanonicalDataFactory keeps canonical persistence without fallback paths', async () => {
  let persistedPayload;

  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Test' }));
  mock.method(models.Associate, 'findByPk', async () => null);
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Personal Loan 12%' }));
  mock.method(models.Loan, 'create', async (payload) => {
    persistedPayload = payload;
    return { id: 89, ...payload };
  });

  const createLoan = createLoanFromCanonicalDataFactory({
    calculationService: {
      async calculate() {
        return {
          calculationProfileVersionId: 700,
          result: {
            lateFeeMode: 'NONE',
            method: 'FRENCH',
            schedule: [{ installmentNumber: 1, scheduledPayment: 100 }],
            summary: {
              installmentAmount: 100,
              totalPayable: 100,
              totalPaid: 0,
              outstandingPrincipal: 90,
              outstandingInterest: 10,
              outstandingBalance: 100,
              outstandingInstallments: 1,
            },
          },
        };
      },
    },
  });

  await createLoan({
    customerId: 1,
    amount: 100,
    interestRate: 12,
    rateSource: 'policy',
    lateFeeSource: 'policy',
    termMonths: 1,
  });

  assert.equal(persistedPayload.financialSnapshot.outstandingBalance, 100);
  assert.equal(persistedPayload.installmentAmount, 100);
});

test('createLoanFromCanonicalDataFactory rejects new credits when no calculation profile version is active', async () => {
  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Test' }));
  mock.method(models.Associate, 'findByPk', async () => null);
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Personal Loan 12%' }));

  const createLoan = createLoanFromCanonicalDataFactory({
    calculationService: {
      async calculate() {
        const { ValidationError } = require('@/utils/errorHandler');
        throw new ValidationError('No hay un perfil de cálculo activo para créditos. Activa un perfil antes de calcular o crear créditos.');
      },
    },
  });

  await assert.rejects(
    () => createLoan({
      customerId: 1,
      amount: 90,
      interestRate: 12,
      rateSource: 'policy',
      lateFeeSource: 'policy',
      termMonths: 1,
    }),
    (error) => {
      assert.equal(error.message, 'No hay un perfil de cálculo activo para créditos. Activa un perfil antes de calcular o crear créditos.');
      return true;
    },
  );
});

test('createLoanFromCanonicalDataFactory rejects incomplete calculation executions with operator-facing messages', async () => {
  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Test' }));
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-default', name: 'Personal Loan 12%' }));

  const buildCreateLoan = (calculationResult) => createLoanFromCanonicalDataFactory({
    calculationService: {
      async calculate() {
        return calculationResult;
      },
    },
  });

  await assert.rejects(
    () => buildCreateLoan({
      calculationProfileVersionId: null,
      result: {
        method: 'FRENCH',
        lateFeeMode: 'NONE',
        schedule: [{ installmentNumber: 1, scheduledPayment: 90 }],
        summary: {
          installmentAmount: 90,
          totalPayable: 90,
          totalPaid: 0,
          outstandingPrincipal: 80,
          outstandingInterest: 10,
          outstandingBalance: 90,
          outstandingInstallments: 1,
        },
      },
    })({
      customerId: 1,
      amount: 90,
      interestRate: 12,
      rateSource: 'policy',
      lateFeeSource: 'policy',
      termMonths: 1,
    }),
    (error) => error instanceof ValidationError
      && error.message === 'El cálculo de crédito no devolvió una versión de perfil activa. Aprueba un perfil de cálculo antes de crear créditos.',
  );

  await assert.rejects(
    () => buildCreateLoan({
      calculationProfileVersionId: 501,
      result: {
        lateFeeMode: 'NONE',
        schedule: [{ installmentNumber: 1, scheduledPayment: 90 }],
        summary: {
          installmentAmount: 90,
          totalPayable: 90,
          totalPaid: 0,
          outstandingPrincipal: 80,
          outstandingInterest: 10,
          outstandingBalance: 90,
          outstandingInstallments: 1,
        },
      },
    })({
      customerId: 1,
      amount: 90,
      interestRate: 12,
      rateSource: 'policy',
      lateFeeSource: 'policy',
      termMonths: 1,
    }),
    (error) => error instanceof ValidationError
      && error.message === 'El cálculo de crédito no devolvió un método de cálculo.',
  );
});

test('getCanonicalLoanView rebuilds legacy schedules without leaking through root services', () => {
  const loanView = getCanonicalLoanView({
    amount: 5000,
    interestRate: 10,
    termMonths: 5,
    startDate: '2026-01-01T00:00:00.000Z',
    emiSchedule: [],
    financialSnapshot: {},
  });

  assert.equal(loanView.schedule.length, 5);
  assert.equal(loanView.snapshot.outstandingInstallments, 5);
  assert.ok(loanView.snapshot.totalPayable > 5000);
});

test('createLoanFromCanonicalData freezes the policySnapshot and rate at creation time', async () => {
  // Regression contract: once a loan is created with a policy-derived rate, the
  // persisted `policySnapshot`, `ratePolicyId`, `lateFeePolicyId` and `interestRate`
  // must mirror the snapshot returned by the calculation service. Future mutations
  // to live rate policies must NOT alter the stored values (AGENTS.md contract #2).
  let persistedPayload;

  mock.method(models.Customer, 'findByPk', async (id) => ({ id, name: 'Customer Snapshot' }));
  mock.method(models.FinancialProduct, 'findOne', async () => ({ id: 'prod-snapshot', name: 'Snapshot Product' }));
  mock.method(models.Loan, 'create', async (payload) => {
    persistedPayload = payload;
    return { id: 91, ...payload };
  });

  const frozenSnapshot = {
    ratePolicyId: 100,
    lateFeePolicyId: 200,
    rateSource: 'policy',
    lateFeeSource: 'policy',
    label: 'Rango 0-15000 @ 12% anual',
    minAmount: 0,
    maxAmount: 15000,
    interestRate: 12,
    priority: 'medium',
    capturedAt: '2026-04-01T00:00:00.000Z',
  };

  const policyResolver = {
    async resolve({ input }) {
      return {
        calculationInput: { ...input, interestRate: 12, rateSource: 'policy' },
        policySnapshot: frozenSnapshot,
      };
    },
  };

  const createLoan = createLoanFromCanonicalDataFactory({
    policyResolver,
    calculationService: {
      async calculate(input, { policySnapshot } = {}) {
        return {
          calculationProfileVersionId: 777,
          result: {
            lateFeeMode: 'NONE',
            method: 'FRENCH',
            policySnapshot,
            schedule: [{
              installmentNumber: 1,
              dueDate: '2026-05-01T00:00:00.000Z',
              scheduledPayment: 1000,
              principalComponent: 988,
              interestComponent: 12,
              paidPrincipal: 0,
              paidInterest: 0,
              paidTotal: 0,
              remainingPrincipal: 988,
              remainingInterest: 12,
              remainingBalance: 1000,
              status: 'pending',
            }],
            summary: {
              installmentAmount: 1000,
              totalPayable: 1000,
              totalPaid: 0,
              outstandingPrincipal: input.amount,
              outstandingInterest: 12,
              outstandingBalance: 1000,
              outstandingInstallments: 1,
              nextInstallment: null,
            },
          },
        };
      },
    },
  });

  await createLoan({
    customerId: 1,
    amount: 988,
    interestRate: 99, // user-supplied rate must be overridden by the policy resolver
    rateSource: 'policy',
    lateFeeSource: 'policy',
    termMonths: 1,
    lateFeeMode: 'none',
    startDate: '2026-04-01',
  });

  // Persisted loan reflects the frozen snapshot, not the user-supplied rate.
  assert.equal(persistedPayload.calculationProfileVersionId, 777);
  assert.equal(persistedPayload.interestRate, 12, 'persisted interestRate must come from resolved policy, not user input');
  assert.equal(persistedPayload.ratePolicyId, 100, 'ratePolicyId must be derived from snapshot');
  assert.equal(persistedPayload.lateFeePolicyId, 200, 'lateFeePolicyId must be derived from snapshot');
  assert.ok(persistedPayload.policySnapshot, 'policySnapshot must be persisted');
  assert.equal(persistedPayload.policySnapshot.ratePolicyId, 100);
  assert.equal(persistedPayload.policySnapshot.interestRate, 12);
  assert.equal(persistedPayload.policySnapshot.rateSource, 'policy');
  assert.equal(persistedPayload.policySnapshot.capturedAt, '2026-04-01T00:00:00.000Z');

  // Simulate a later mutation to the live policy registry. The persisted payload
  // must remain immutable because the loan stores its own snapshot.
  const livePolicySnapshot = { ...frozenSnapshot, interestRate: 99, capturedAt: '2026-06-01T00:00:00.000Z' };
  assert.notEqual(persistedPayload.policySnapshot.interestRate, livePolicySnapshot.interestRate);
  assert.notEqual(persistedPayload.policySnapshot.capturedAt, livePolicySnapshot.capturedAt);
});
