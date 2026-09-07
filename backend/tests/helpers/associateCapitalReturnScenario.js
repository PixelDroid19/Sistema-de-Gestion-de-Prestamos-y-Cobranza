const assert = require('node:assert/strict');
const { AssociateInstallment, AssociateContribution, ProfitDistribution } = require('@/models');

module.exports = async ({ associateId, token, operationDate, request, expectStatus }) => {
  // Fixture: 1,600,000 capital, 2% monthly and one paid interest installment.
  const paidBefore = await AssociateInstallment.findOne({ where: { associateId, installmentNumber: 1 }, raw: true });
  const results = await Promise.all([1, 2].map((number) => request({
    method: 'POST', path: `/api/associates/${associateId}/capital-returns`, token,
    body: { amount: 1000000, capitalReturnDate: operationDate, notes: `Retiro concurrente ${number}` },
  })));
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 400],
    'Dos retiros no pueden consumir el mismo capital disponible.');
  const accepted = results.find((result) => result.status === 201);
  assert.equal(accepted.body.data.summary.currentCapital, 600000);

  const paymentsBefore = await ProfitDistribution.findAll({ where: { associateId }, raw: true });
  const installmentsBefore = await AssociateInstallment.findAll({ where: { associateId }, raw: true });
  assert.equal(paymentsBefore.length, 1);
  assert.equal(Number(paymentsBefore[0].amount), 1000000);
  assert.deepEqual(installmentsBefore.find((row) => row.installmentNumber === 1), paidBefore,
    'Una devolución no modifica el interés que ya fue pagado.');
  assert.deepEqual(installmentsBefore.filter((row) => row.status !== 'paid').map((row) => Number(row.amount)), [12000, 12000]);

  await expectStatus({
    method: 'POST', path: `/api/associates/${associateId}/capital-returns`, token,
    body: { amount: 600000.01, capitalReturnDate: operationDate },
  }, 400);
  assert.deepEqual(await ProfitDistribution.findAll({ where: { associateId }, raw: true }), paymentsBefore);
  assert.deepEqual(await AssociateInstallment.findAll({ where: { associateId }, raw: true }), installmentsBefore);

  const finalReturn = await expectStatus({
    method: 'POST', path: `/api/associates/${associateId}/capital-returns`, token,
    body: { amount: 600000, capitalReturnDate: operationDate },
  }, 201);
  assert.equal(finalReturn.body.data.summary.currentCapital, 0);
  await expectStatus({
    method: 'POST', path: `/api/associates/${associateId}/capital-returns`, token,
    body: { amount: 0.01, capitalReturnDate: operationDate },
  }, 400);
  const remaining = await AssociateInstallment.findAll({ where: { associateId }, raw: true });
  assert.ok(remaining.filter((row) => row.status !== 'paid').every((row) => Number(row.amount) === 0),
    'Sin capital vigente no deben quedar intereses futuros por cobrar al fondo.');
  assert.deepEqual(remaining.find((row) => row.installmentNumber === 1), paidBefore);

  await expectStatus({
    method: 'PATCH', path: `/api/associates/${associateId}`, token,
    body: { interestRate: 3 },
  }, 200);
  const reinvested = await expectStatus({
    method: 'POST', path: `/api/associates/${associateId}/reinvestments`, token,
    body: { amount: 100000, reinvestmentDate: operationDate, notes: 'Reinversión tras devolución completa' },
  }, 201);
  const contribution = await AssociateContribution.findByPk(reinvested.body.data.contribution.id, { raw: true });
  const distribution = await ProfitDistribution.findByPk(reinvested.body.data.distribution.id, { raw: true });
  assert.equal(Number(contribution.amount), 100000);
  assert.equal(Number(contribution.interestRateSnapshot), 3);
  assert.equal(Number(distribution.amount), 100000);
  assert.equal(distribution.basis.type, 'reinvestment');
  assert.equal(distribution.basis.contributionId, contribution.id,
    'La salida de reinversión debe enlazar el aporte que capitaliza, no otro movimiento.');
  const summary = await expectStatus({ path: `/api/associates/${associateId}/financial-summary`, token }, 200);
  assert.equal(Number(summary.body.data.report.summary?.currentCapital ?? summary.body.data.report.currentCapital), 100000);
  assert.equal(Number(summary.body.data.report.summary.interestDebt), 6000,
    'El resumen debe usar la tasa del nuevo aporte; el capital anterior ya fue devuelto.');
  const calendar = await expectStatus({ path: `/api/associates/${associateId}/installments`, token }, 200);
  const reprojected = calendar.body.data.installments.installments;
  assert.deepEqual(reprojected.filter((row) => row.status !== 'paid').map((row) => Number(row.amount)), [3000, 3000],
    'La reinversión debe generar el 3% mensual sobre el nuevo capital, sin recuperar capital devuelto al 2%.');
  assert.equal(Number(reprojected.find((row) => row.installmentNumber === 1).amount), Number(paidBefore.amount));

  // Two 0.10 contributions at 3% add 0.006 interest: round once to 0.01,
  // rather than rounding each 0.003 to zero before adding them.
  for (let index = 0; index < 2; index += 1) {
    await expectStatus({
      method: 'POST', path: `/api/associates/${associateId}/contributions`, token,
      body: { amount: 0.10, contributionDate: operationDate },
    }, 201);
  }
  const fractionalCalendar = await expectStatus({ path: `/api/associates/${associateId}/installments`, token }, 200);
  assert.deepEqual(fractionalCalendar.body.data.installments.installments
    .filter((row) => row.status !== 'paid').map((row) => Number(row.amount)), [3000.01, 3000.01]);
};
