const assert = require('node:assert/strict');

module.exports = async ({ expectStatus, request, token, fixturePrefix }) => {
  const path = '/api/config/rate-policies';
  const before = await expectStatus({ path, token }, 200);
  const originalActive = before.body.data.policies.filter((policy) => policy.isActive);
  const createdIds = [];
  const update = (id, body, status = 200) => expectStatus({ method: 'PUT', path: `${path}/${id}`, token, body }, status);
  try {
    for (const [suffix, minAmount, maxAmount, annualEffectiveRate] of [
      ['lower', 0, 1000000, 0], ['upper', 1000000.01, null, 100],
    ]) {
      const body = { key: `${fixturePrefix}-${suffix}`, label: `${fixturePrefix} ${suffix}`, minAmount, maxAmount, annualEffectiveRate, isActive: false };
      const response = await expectStatus({ method: 'POST', path, token, body }, 201);
      createdIds.push(response.body.data.policy.id);
      await expectStatus({ method: 'POST', path, token, body }, 409);
    }
    const [lower, upper] = createdIds;
    for (const annualEffectiveRate of [-1, 100.01, '', null, true, '1e2', '30abc']) {
      await update(lower, { annualEffectiveRate }, 400);
    }
    for (const minAmount of [-1, 0.001, true, '1e6', '100abc']) {
      await update(lower, { minAmount }, 400);
    }
    await update(lower, { minAmount: 1000001 }, 400);
    for (const policy of originalActive) await update(policy.id, { isActive: false });
    await update(lower, { isActive: true });
    await update(upper, { isActive: true });
    for (const [startDate, dueDates] of [
      ['2024-01-31', ['2024-02-29', '2024-03-31', '2024-04-30']],
      ['2026-01-31', ['2026-02-28', '2026-03-31', '2026-04-30']],
    ]) {
      const response = await expectStatus({
        method: 'POST', path: '/api/loans/calculations', token,
        body: { amount: 1000000, termMonths: 3, startDate, rateSource: 'policy', lateFeeSource: 'policy' },
      }, 200);
      const schedule = response.body.data.calculation.schedule;
      assert.deepEqual(schedule.map((row) => new Date(row.dueDate).toISOString().slice(0, 10)), dueDates);
      assert.deepEqual(schedule.map((row) => Number(row.interestComponent)), [0, 0, 0]);
      assert.deepEqual(schedule.map((row) => Number(row.principalComponent)), [333333.33, 333333.33, 333333.34],
        'La última cuota debe absorber el centavo de redondeo sin crear ni perder capital.');
      assert.equal(Number(schedule.at(-1).remainingBalance), 0);
    }
    for (const [amount, id, rate] of [[0.01, lower, 0], [1000000, lower, 0], [1000000.01, upper, 100], [2000000, upper, 100]]) {
      const resolved = await expectStatus({ path: `${path}/resolve?amount=${amount}`, token }, 200);
      assert.equal(resolved.body.data.policy.id, id);
      assert.equal(Number(resolved.body.data.policy.annualEffectiveRate), rate);
    }
    await update(upper, { minAmount: 1000000 }, 409);
    await update(upper, { isActive: false });
    const uncovered = await expectStatus({ path: `${path}/resolve?amount=1000000.01`, token }, 200);
    assert.equal(uncovered.body.data.policy, null, 'Un monto sin cobertura no debe seleccionar otra tasa.');
    await expectStatus({
      method: 'POST', path: '/api/loans/calculations', token,
      body: { amount: 1000000.01, termMonths: 3, startDate: '2026-07-17', rateSource: 'policy', lateFeeSource: 'policy' },
    }, 400);

    const twin = await expectStatus({
      method: 'POST', path, token,
      body: {
        key: `${fixturePrefix}-concurrent`, label: `${fixturePrefix} concurrente`,
        minAmount: 0, maxAmount: 1000000, annualEffectiveRate: 25, isActive: false,
      },
    }, 201);
    createdIds.push(twin.body.data.policy.id);
    await update(lower, { isActive: false });
    const concurrentActivations = await Promise.all([
      request({ method: 'PUT', path: `${path}/${lower}`, token, body: { isActive: true } }),
      request({ method: 'PUT', path: `${path}/${twin.body.data.policy.id}`, token, body: { isActive: true } }),
    ]);
    assert.deepEqual(concurrentActivations.map((result) => result.status).sort(), [200, 409],
      'Dos activaciones simultáneas de rangos solapados no deben confirmar ambas.');
    const afterRace = await expectStatus({ path, token }, 200);
    const activeTwins = afterRace.body.data.policies.filter((policy) => (
      policy.isActive && [lower, twin.body.data.policy.id].includes(policy.id)
    ));
    assert.equal(activeTwins.length, 1, 'La carrera debe conservar una sola regla activa para el mismo monto.');
  } finally {
    for (const id of createdIds) await update(id, { isActive: false });
    for (const policy of originalActive) await update(policy.id, { isActive: true });
    for (const id of createdIds) {
      await expectStatus({ method: 'DELETE', path: `${path}/${id}`, token }, 200);
      await expectStatus({ method: 'DELETE', path: `${path}/${id}`, token }, 404);
    }
  }
};
