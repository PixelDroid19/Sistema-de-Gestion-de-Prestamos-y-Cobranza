const assert = require('node:assert/strict');

// Runs inside the local product fixture so its loans share the suite's cleanup.
module.exports = async ({ expectStatus, token, customerId, fixturePrefix, fixtureLoanIds, Loan }) => {
  const policies = {};
  for (const category of ['rate-policies', 'late-fee-policies']) {
    const response = await expectStatus({ path: `/api/config/${category}`, token }, 200);
    policies[category] = response.body.data.policies.find((policy) => policy.isActive);
    assert.ok(policies[category], `Debe existir una regla activa de ${category}.`);
  }
  const createLoan = async (suffix) => {
    const response = await expectStatus({
      method: 'POST', path: '/api/loans', token,
      headers: { 'Idempotency-Key': `${fixturePrefix}-policy-${suffix}` },
      body: { customerId, amount: 1000000, termMonths: 3, startDate: '2026-07-17', rateSource: 'policy', lateFeeSource: 'policy' },
    }, 201);
    const id = response.body.data.loan.id;
    fixtureLoanIds.push(id);
    return Loan.findByPk(id, { raw: true });
  };
  const financialTerms = (loan) => Object.fromEntries([
    'interestRate', 'annualLateFeeRate', 'lateFeeMode', 'ratePolicyId', 'lateFeePolicyId',
    'policySnapshot', 'emiSchedule', 'installmentAmount', 'totalPayable',
  ].map((key) => [key, loan[key]]));
  const original = await createLoan('original');
  const replacements = {};
  try {
    for (const [category, annualEffectiveRate] of [['rate-policies', 36], ['late-fee-policies', 18]]) {
      await expectStatus({
        method: 'PUT', path: `/api/config/${category}/${policies[category].id}`, token,
        body: { annualEffectiveRate },
      }, 200);
    }
    const updated = await createLoan('updated');
    assert.equal(Number(updated.interestRate), 36);
    assert.equal(Number(updated.annualLateFeeRate), 18);
    assert.equal(Number(updated.emiSchedule[0].interestComponent), 30000,
      'Un millón a 36% TNA debe generar 30.000 de interés en el primer mes.');
    assert.deepEqual(financialTerms(await Loan.findByPk(original.id, { raw: true })), financialTerms(original),
      'Cambiar configuración no debe reescribir tasas, políticas ni calendario de créditos existentes.');
    const viewed = await expectStatus({ path: `/api/loans/${original.id}`, token }, 200);
    assert.equal(Number(viewed.body.data.loan.interestRate), Number(original.interestRate));
    for (const [category, policy] of Object.entries(policies)) {
      await expectStatus({ method: 'DELETE', path: `/api/config/${category}/${policy.id}`, token }, 409);
    }
    await expectStatus({
      method: 'PUT', path: `/api/config/rate-policies/${policies['rate-policies'].id}`, token,
      body: { isActive: false },
    }, 200);
    for (const category of ['rate-policies', 'late-fee-policies']) {
      const replacement = await expectStatus({
        method: 'POST', path: `/api/config/${category}`, token,
        body: {
          key: `${fixturePrefix}-replacement-${category}`, label: 'Reemplazo de prueba', isActive: true,
          annualEffectiveRate: category === 'rate-policies' ? 24 : 20,
          ...(category === 'rate-policies' ? { minAmount: 0, maxAmount: null } : { lateFeeMode: 'SIMPLE', priority: 'medium' }),
        },
      }, 201);
      replacements[category] = replacement.body.data.policy.id;
      await expectStatus({ method: 'DELETE', path: `/api/config/${category}/${policies[category].id}`, token }, 409);
    }
    const preview = await expectStatus({
      method: 'POST', path: '/api/loans/calculations', token,
      body: { customerId, amount: 1000000, termMonths: 3, startDate: '2026-07-17', rateSource: 'policy', lateFeeSource: 'policy' },
    }, 200);
    assert.equal(Number(preview.body.data.calculation.inputs.interestRate), 24,
      'La simulación nueva no debe resolver la política desactivada.');
    assert.deepEqual(financialTerms(await Loan.findByPk(original.id, { raw: true })), financialTerms(original),
      'Desactivar y sustituir políticas no debe cambiar las condiciones históricas del crédito.');
    assert.deepEqual(financialTerms(await Loan.findByPk(updated.id, { raw: true })), financialTerms(updated));
    const historicalView = await expectStatus({ path: `/api/loans/${original.id}`, token }, 200);
    assert.equal(Number(historicalView.body.data.loan.interestRate), Number(original.interestRate));
    assert.equal(Number(historicalView.body.data.loan.annualLateFeeRate), Number(original.annualLateFeeRate),
      'La consulta del crédito debe conservar la mora pactada, no sustituirla por la nueva regla activa.');
  } finally {
    if (replacements['rate-policies']) {
      await expectStatus({ method: 'DELETE', path: `/api/config/rate-policies/${replacements['rate-policies']}`, token }, 200);
    }
    // Restore even when a financial assertion fails; never leave changed live fixtures.
    for (const [category, policy] of Object.entries(policies)) {
      await expectStatus({
        method: 'PUT', path: `/api/config/${category}/${policy.id}`, token,
        body: { annualEffectiveRate: policy.annualEffectiveRate, isActive: policy.isActive },
      }, 200);
    }
    if (replacements['late-fee-policies']) {
      await expectStatus({ method: 'DELETE', path: `/api/config/late-fee-policies/${replacements['late-fee-policies']}`, token }, 200);
    }
  }
};
