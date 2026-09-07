const assert = require('node:assert/strict');

module.exports = async ({ expectStatus, request, token, fixturePrefix }) => {
  const path = '/api/config/late-fee-policies';
  const before = await expectStatus({ path, token }, 200);
  const original = before.body.data.policies.find((policy) => policy.isActive);
  assert.ok(original);
  const created = await expectStatus({
    method: 'POST', path, token,
    body: {
      key: `${fixturePrefix}-late-activation`, label: `Mora ${fixturePrefix}`,
      annualEffectiveRate: 18, lateFeeMode: 'SIMPLE', priority: original.priority, isActive: false,
    },
  }, 201);
  const id = created.body.data.policy.id;
  let competingId = null;
  try {
    // Switching a saved policy must be possible without ever leaving no active policy.
    await expectStatus({ method: 'PUT', path: `${path}/${id}`, token, body: { isActive: true } }, 200);
    const switched = await expectStatus({ path, token }, 200);
    assert.deepEqual(switched.body.data.policies.filter((policy) => policy.isActive).map((policy) => policy.id), [id]);
    await expectStatus({ method: 'PUT', path: `${path}/${id}`, token, body: { isActive: true } }, 200);
    await expectStatus({ method: 'PUT', path: `${path}/${id}`, token, body: { isActive: false } }, 409);
    await expectStatus({ method: 'DELETE', path: `${path}/${id}`, token }, 409);

    const competing = await expectStatus({
      method: 'POST', path, token,
      body: {
        key: `${fixturePrefix}-late-competing`, label: `Mora concurrente ${fixturePrefix}`,
        annualEffectiveRate: 19, lateFeeMode: 'SIMPLE', priority: original.priority, isActive: false,
      },
    }, 201);
    competingId = competing.body.data.policy.id;
    await expectStatus({ method: 'PUT', path: `${path}/${original.id}`, token, body: { isActive: true } }, 200);
    const activationResults = await Promise.all([
      request({ method: 'PUT', path: `${path}/${id}`, token, body: { isActive: true } }),
      request({ method: 'PUT', path: `${path}/${competingId}`, token, body: { isActive: true } }),
    ]);
    assert.deepEqual(activationResults.map((result) => result.status), [200, 200]);
    const afterRace = await expectStatus({ path, token }, 200);
    assert.equal(afterRace.body.data.policies.filter((policy) => policy.isActive).length, 1,
      'Activaciones simultáneas de mora deben conservar una sola política operativa.');
  } finally {
    await expectStatus({ method: 'PUT', path: `${path}/${original.id}`, token, body: { isActive: true } }, 200);
    await expectStatus({ method: 'DELETE', path: `${path}/${id}`, token }, 200);
    if (competingId) await expectStatus({ method: 'DELETE', path: `${path}/${competingId}`, token }, 200);
  }
};
