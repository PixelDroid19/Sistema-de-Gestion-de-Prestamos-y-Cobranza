const assert = require('assert/strict');
const test = require('node:test');

const {
  calculateCredit,
  calculateLateFee,
  DEFAULT_CALCULATION_PROFILE,
} = require('@/modules/credits/domain/calculation');

const activeProfile = {
  id: 11,
  ...DEFAULT_CALCULATION_PROFILE,
};

const baseInput = {
  amount: 1200,
  interestRate: 12,
  termMonths: 12,
  startDate: '2026-01-01',
  lateFeeMode: 'SIMPLE',
};

test('calculateCredit returns a traceable profile-backed contract', () => {
  const result = calculateCredit({
    input: baseInput,
    profileVersion: activeProfile,
    policySnapshot: { ratePolicyId: 2 },
  });

  assert.equal(result.calculationVersionId, 11);
  assert.equal(result.calculationProfileVersionId, 11);
  assert.equal(result.method, 'FRENCH');
  assert.equal(result.policySnapshot.ratePolicyId, 2);
  assert.equal(result.policySnapshot.calculationProfileVersionId, 11);
  assert.equal(result.explanation.profile.name, 'Perfil base de cálculo de crédito');
  assert.equal(result.summary.installmentAmount, 106.62);
  assert.equal(result.summary.totalInterest, 79.42);
  assert.equal(result.summary.totalPayable, 1279.42);
  assert.equal(result.explanation.inputs.annualRateConvention, 'TNA_30_360');
  assert.equal(result.schedule.length, 12);
  assert.equal(result.schedule[0].dueDate, '2026-02-01T00:00:00.000Z');
  assert.equal(result.explanation.method.title, 'Sistema francés');
  assert.match(result.explanation.method.description, /interés/);
  assert.match(result.explanation.lateFee.description, /días vencidos/);
  assert.ok(result.explanation.method.formula.includes('cuota'));
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'graphVersionId'), false);
});

test('calculateCredit rejects malformed start dates instead of falling back silently', () => {
  assert.throws(() => calculateCredit({
    input: { ...baseInput, startDate: '60620-02-02' },
    profileVersion: activeProfile,
  }), /fecha inicial.*AAAA-MM-DD/i);

  assert.throws(() => calculateCredit({
    input: { ...baseInput, startDate: '2026-02-31' },
    profileVersion: activeProfile,
  }), /fecha inicial.*AAAA-MM-DD/i);
});

test('a deferred first installment adds daily interest only for days after the first month', () => {
  for (const calculationMethod of ['FRENCH', 'SIMPLE', 'COMPOUND']) {
    const input = { ...baseInput, startDate: '2026-01-05', termMonths: 3, calculationMethod };
    const standard = calculateCredit({ input, profileVersion: activeProfile });
    const deferred = calculateCredit({
      input: { ...input, firstDueDate: '2026-02-10' },
      profileVersion: activeProfile,
    });

    assert.deepEqual(deferred.schedule.map((row) => row.dueDate.slice(0, 10)), [
      '2026-02-10', '2026-03-10', '2026-04-10',
    ]);
    const additionalInterest = 2;
    assert.equal(deferred.schedule[0].interestComponent,
      standard.schedule[0].interestComponent + additionalInterest);
    assert.equal(deferred.schedule[0].principalComponent, standard.schedule[0].principalComponent);
    assert.equal(deferred.schedule[0].scheduledPayment,
      standard.schedule[0].scheduledPayment + additionalInterest);
    assert.deepEqual(deferred.schedule.slice(1).map((row) => row.scheduledPayment),
      standard.schedule.slice(1).map((row) => row.scheduledPayment));
    assert.equal(deferred.summary.totalInterest, standard.summary.totalInterest + additionalInterest);
    assert.equal(deferred.summary.totalPayable, standard.summary.totalPayable + additionalInterest);
    assert.equal(deferred.summary.installmentAmount, standard.schedule[1].scheduledPayment);
    assert.equal(deferred.inputs.startDate, '2026-01-05T00:00:00.000Z');
    assert.equal(deferred.inputs.firstDueDate, '2026-02-10T00:00:00.000Z');
  }
});

test('a seven-day deferral adds the prorated interest to the pictured credit first installment', () => {
  const result = calculateCredit({
    input: { amount: 5815000, interestRate: 60.17, termMonths: 24,
      startDate: '2026-09-23', firstDueDate: '2026-10-30' },
    profileVersion: activeProfile,
  });

  assert.equal(result.schedule[0].extraFirstPeriodInterest, 68033.88);
  assert.equal(result.schedule[0].scheduledPayment, 490033.10);
  assert.equal(result.schedule[1].scheduledPayment, 421999.22);
  assert.equal(result.summary.installmentAmount, 421999.22);
});

test('a zero-rate credit does not add interest when its first installment is deferred', () => {
  const result = calculateCredit({
    input: { ...baseInput, amount: 1000, interestRate: 0, termMonths: 3,
      startDate: '2026-01-05', firstDueDate: '2026-02-10' },
    profileVersion: activeProfile,
  });

  assert.deepEqual(result.schedule.map((row) => row.scheduledPayment), [333.33, 333.33, 333.34]);
  assert.equal(result.summary.totalInterest, 0);
});

test('first installment date must be valid and at least one month after disbursement', () => {
  for (const firstDueDate of ['2026-02-04', '2026-02-31', 'not-a-date']) {
    assert.throws(() => calculateCredit({
      input: { ...baseInput, startDate: '2026-01-05', firstDueDate },
      profileVersion: activeProfile,
    }), /primera cuota/i);
  }
});

test('selecting the ordinary first due date keeps the original month-end anchor', () => {
  const result = calculateCredit({
    input: { ...baseInput, startDate: '2026-01-31', firstDueDate: '2026-02-28', termMonths: 3 },
    profileVersion: activeProfile,
  });
  assert.equal(result.inputs.firstDueDate, null);
  assert.deepEqual(result.schedule.map((row) => row.dueDate.slice(0, 10)),
    ['2026-02-28', '2026-03-31', '2026-04-30']);
});

test('calculateCredit rejects missing or inactive calculation profiles with operator messages', () => {
  assert.throws(() => calculateCredit({
    input: baseInput,
    profileVersion: null,
  }), (error) => {
    assert.equal(error.message, 'No hay un perfil de cálculo activo para créditos. Activa un perfil antes de calcular o crear créditos.');
    return true;
  });

  assert.throws(() => calculateCredit({
    input: baseInput,
    profileVersion: { ...activeProfile, status: 'draft' },
  }), (error) => {
    assert.equal(error.message, 'El perfil de cálculo seleccionado no está activo.');
    return true;
  });
});

test('calculateCredit rejects invalid financial inputs with Spanish operator messages', () => {
  assert.throws(() => calculateCredit({
    input: { ...baseInput, amount: 0 },
    profileVersion: activeProfile,
  }), (error) => {
    assert.equal(error.message, 'El monto del crédito debe ser mayor que 0.');
    return true;
  });

  assert.throws(() => calculateCredit({
    input: { ...baseInput, interestRate: 101 },
    profileVersion: activeProfile,
  }), (error) => {
    assert.equal(error.message, 'La tasa del crédito debe estar entre 0 y 100.');
    return true;
  });

  assert.throws(() => calculateCredit({
    input: { ...baseInput, termMonths: '1e2' },
    profileVersion: activeProfile,
  }), (error) => {
    assert.equal(error.message, 'El plazo debe ser un número entero entre 1 y 360 meses.');
    return true;
  });
});

test('calculateCredit defaults missing startDate to the disbursement day instead of shifting it one month ahead', () => {
  const RealDate = Date;
  const fixedNow = '2026-05-28T15:45:00.000Z';

  global.Date = class FixedDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [fixedNow]));
    }

    static now() {
      return new RealDate(fixedNow).getTime();
    }

    static parse(value) {
      return RealDate.parse(value);
    }

    static UTC(...args) {
      return RealDate.UTC(...args);
    }
  };

  try {
    const result = calculateCredit({
      input: { ...baseInput, startDate: undefined },
      profileVersion: activeProfile,
    });

    assert.equal(result.inputs.startDate, '2026-05-28T00:00:00.000Z');
    assert.equal(result.schedule[0].dueDate, '2026-06-28T00:00:00.000Z');
  } finally {
    global.Date = RealDate;
  }
});

test('calculateCredit supports FRENCH, SIMPLE, and COMPOUND methods with explicit totals', () => {
  const scenarios = [
    ['FRENCH', { installmentAmount: 106.62, totalInterest: 79.42, totalPayable: 1279.42 }],
    ['SIMPLE', { installmentAmount: 112, totalInterest: 144, totalPayable: 1344 }],
    ['COMPOUND', { installmentAmount: 112.68, totalInterest: 152.19, totalPayable: 1352.19 }],
  ];

  for (const [method, expected] of scenarios) {
    const result = calculateCredit({
      input: { ...baseInput, calculationMethod: method },
      profileVersion: activeProfile,
    });

    assert.equal(result.method, method);
    assert.deepEqual({
      installmentAmount: result.summary.installmentAmount,
      totalInterest: result.summary.totalInterest,
      totalPayable: result.summary.totalPayable,
    }, expected);
  }
});

test('calculateLateFee handles all supported mora modes deterministically', () => {
  const input = {
    overdueAmount: 1000,
    daysOverdue: 45,
    annualRate: 36,
    flatFeePerDay: 2,
    baseRate: 24,
  };

  assert.equal(calculateLateFee({ ...input, feeMode: 'NONE' }), 0);
  assert.equal(calculateLateFee({ ...input, feeMode: 'SIMPLE' }), 44.38);
  assert.equal(calculateLateFee({ ...input, feeMode: 'COMPOUND' }), 45.36);
  assert.equal(calculateLateFee({ ...input, feeMode: 'FLAT' }), 90);
  assert.equal(calculateLateFee({ ...input, feeMode: 'TIERED' }), 34.52);
});

test('calculateLateFee rejects unsupported mora modes with an operator-facing message', () => {
  assert.throws(
    () => calculateLateFee({
      overdueAmount: 1000,
      daysOverdue: 10,
      feeMode: 'SIMPLE_DAILY',
      annualRate: 24,
    }),
    (error) => {
      assert.equal(error.message, 'Selecciona un método de mora válido.');
      assert.doesNotMatch(error.message, /SIMPLE_DAILY|NONE|SIMPLE|COMPOUND|FLAT|TIERED/);
      return true;
    },
  );
});
