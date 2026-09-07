const assert = require('node:assert/strict');

module.exports = async ({ expectStatus, request, adminToken, employeeToken, fixturePrefix }) => {
  for (const category of ['rate-policies', 'late-fee-policies']) {
    const path = `/api/config/${category}`;
    const before = await expectStatus({ path, token: adminToken }, 200);
    const policy = before.body.data.policies.find((row) => row.isActive);
    assert.ok(policy);
    const createPayload = {
      key: `${fixturePrefix}-forbidden-${category}`, label: 'Política no autorizada',
      annualEffectiveRate: 25, isActive: false,
      ...(category === 'late-fee-policies' ? { lateFeeMode: 'SIMPLE', priority: 'medium' } : { minAmount: 0, maxAmount: null }),
    };
    const creation = await request({ method: 'POST', path, token: employeeToken, body: createPayload });
    try {
      assert.equal(creation.status, 403, 'Un empleado no debe crear reglas financieras, aunque pueda originar créditos.');
      for (const body of [{ annualEffectiveRate: policy.annualEffectiveRate }, { isActive: true }, { isActive: false }]) {
        await expectStatus({ method: 'PUT', path: `${path}/${policy.id}`, token: employeeToken, body }, 403);
      }
      await expectStatus({ method: 'DELETE', path: `${path}/${policy.id}`, token: employeeToken }, 403);
      const after = await expectStatus({ path, token: adminToken }, 200);
      assert.deepEqual(after.body.data.policies, before.body.data.policies,
        'Los intentos no autorizados no deben modificar ni las políticas ni sus marcas de actualización.');
    } finally {
      if (creation.status === 201 && creation.body?.data?.policy?.id) {
        await expectStatus({ method: 'DELETE', path: `${path}/${creation.body.data.policy.id}`, token: adminToken }, 200);
      }
    }
  }
};
