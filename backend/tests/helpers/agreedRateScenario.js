const assert = require('node:assert/strict');

// Uses the local product fixture and its cleanup; never targets production.
module.exports = async ({ expectStatus, token, customerId, fixturePrefix, fixtureLoanIds, Loan }) => {
  const preservedFields = [
    'id', 'amount', 'interestRate', 'termMonths', 'startDate', 'status',
    'ratePolicyId', 'lateFeePolicyId', 'annualLateFeeRate', 'lateFeeMode',
    'calculationProfileVersionId', 'policySnapshot', 'financialSnapshot', 'emiSchedule',
    'installmentAmount', 'totalPayable', 'totalPaid', 'principalOutstanding', 'interestOutstanding',
  ];
  const existingLoans = await Loan.findAll({ attributes: preservedFields, order: [['id', 'ASC']], raw: true });
  const response = await expectStatus({ path: '/api/config/rate-policies', token }, 200);
  const activePolicies = response.body.data.policies.filter((policy) => policy.isActive);
  const financialRows = (schedule) => schedule.map((row) => ({
    dueDate: new Date(row.dueDate).toISOString().slice(0, 10),
    principal: Number(row.principalComponent), interest: Number(row.interestComponent),
    payment: Number(row.scheduledPayment),
  }));
  const created = [];
  try {
    for (const policy of activePolicies) {
      await expectStatus({ method: 'PUT', path: `/api/config/rate-policies/${policy.id}`, token, body: { isActive: false } }, 200);
    }
    for (const interestRate of [27.5, 27.1234, 0]) {
      const body = { customerId, amount: 1000000, termMonths: 3, startDate: '2026-07-17',
        rateSource: 'manual', interestRate, lateFeeSource: 'policy' };
      const preview = await expectStatus({ method: 'POST', path: '/api/loans/calculations', token, body }, 200);
      const calculation = preview.body.data.calculation;
      assert.equal(calculation.inputs.interestRate, interestRate);
      const registered = await expectStatus({ method: 'POST', path: '/api/loans', token, body,
        headers: { 'Idempotency-Key': `${fixturePrefix}-agreed-${interestRate}` } }, 201);
      const id = registered.body.data.loan.id;
      fixtureLoanIds.push(id);
      const persisted = await Loan.findByPk(id, { raw: true });
      assert.equal(Number(persisted.interestRate), interestRate);
      assert.equal(persisted.ratePolicyId, null);
      assert.equal(persisted.policySnapshot.rateSource, 'manual');
      assert.equal(persisted.policySnapshot.appliedInterestRate, interestRate);
      assert.equal(persisted.policySnapshot.lateFeeSource, 'policy');
      assert.deepEqual(financialRows(persisted.emiSchedule), financialRows(calculation.schedule));
      assert.equal(Number(persisted.emiSchedule[0].interestComponent), Math.round(1000000 * interestRate / 1200 * 100) / 100);
      const viewed = await expectStatus({ path: `/api/loans/${id}`, token }, 200);
      assert.equal(Number(viewed.body.data.loan.interestRate), interestRate);
      const history = await expectStatus({ path: `/api/reports/credit-history/loan/${id}`, token }, 200);
      assert.equal(Number(history.body.data.history.loan.interestRate), interestRate);
      created.push(persisted);
    }
    for (const interestRate of [null, '', -1, 100.01, 27.12345, 'abc']) {
      const rejected = await expectStatus({ method: 'POST', path: '/api/loans', token,
        headers: { 'Idempotency-Key': `${fixturePrefix}-bad-rate-${String(interestRate)}` },
        body: { customerId, amount: 1000000, termMonths: 3, rateSource: 'manual', interestRate, lateFeeSource: 'policy' },
      }, 400);
      assert.ok(JSON.stringify(rejected.body).includes('interestRate'));
      const invalidPreview = await expectStatus({ method: 'POST', path: '/api/loans/calculations', token,
        body: { amount: 1000000, termMonths: 3, rateSource: 'manual', interestRate, lateFeeSource: 'policy' },
      }, 400);
      assert.ok(JSON.stringify(invalidPreview.body).includes('interestRate'));
    }
    await expectStatus({ method: 'POST', path: '/api/loans/calculations', token,
      body: { amount: 1000000, termMonths: 3, rateSource: 'policy', lateFeeSource: 'policy' },
    }, 400);
  } finally {
    for (const policy of activePolicies) {
      await expectStatus({ method: 'PUT', path: `/api/config/rate-policies/${policy.id}`, token, body: { isActive: true } }, 200);
    }
  }
  const existingIds = new Set(existingLoans.map((loan) => loan.id));
  const loansAfterRegistration = await Loan.findAll({ attributes: preservedFields, order: [['id', 'ASC']], raw: true });
  assert.deepEqual(loansAfterRegistration.filter((loan) => existingIds.has(loan.id)), existingLoans,
    'Registrar tasas pactadas y restaurar políticas no debe modificar ningún crédito existente ni sus saldos o calendarios.');
  for (const original of created) {
    const after = await Loan.findByPk(original.id, { raw: true });
    assert.equal(after.interestRate, original.interestRate);
    assert.deepEqual(after.policySnapshot, original.policySnapshot);
    assert.deepEqual(after.emiSchedule, original.emiSchedule);
  }
};
