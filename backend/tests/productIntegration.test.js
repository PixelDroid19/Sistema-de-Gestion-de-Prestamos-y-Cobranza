const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const { Op } = require('sequelize');

const {
  sequelize,
  Customer,
  Associate,
  AssociateContribution,
  AssociateInstallment,
  Loan,
  Payment,
  OperatingExpense,
  DocumentAttachment,
  LoanAlert,
  PromiseToPay,
  ProfitDistribution,
  IdempotencyKey,
} = require('@/models');

const RUN_INTEGRATION = process.env.PRODUCT_INTEGRATION_RUN === 'true';
const BASE_URL = String(process.env.PRODUCT_INTEGRATION_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/u, '');
const ORIGIN = String(process.env.PRODUCT_INTEGRATION_ORIGIN || 'http://127.0.0.1:3000').trim();
const DB_HOST = String(process.env.DB_HOST || 'localhost').trim();
const TEST_CLIENT_IP = process.env.PRODUCT_INTEGRATION_CLIENT_IP || `127.0.0.${2 + (process.pid % 240)}`;
const ADMIN_EMAIL = process.env.PRODUCT_INTEGRATION_ADMIN_EMAIL || 'qa.admin.20260427@test.local';
const ADMIN_PASSWORD = process.env.PRODUCT_INTEGRATION_ADMIN_PASSWORD || 'Admin123!';
const EMPLOYEE_EMAIL = process.env.PRODUCT_INTEGRATION_EMPLOYEE_EMAIL || 'qa.employee.20260427@test.local';
const EMPLOYEE_PASSWORD = process.env.PRODUCT_INTEGRATION_EMPLOYEE_PASSWORD || 'Admin123!';

const request = ({ method = 'GET', path, body, token, headers = {} }) => new Promise((resolve, reject) => {
  const url = new URL(path, BASE_URL);
  const payload = body === undefined ? null : JSON.stringify(body);
  const client = url.protocol === 'https:' ? https : http;
  const req = client.request(url, {
    method,
    headers: {
      accept: 'application/json',
      origin: ORIGIN,
      'x-forwarded-for': TEST_CLIENT_IP,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(payload ? {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      } : {}),
      ...headers,
    },
  }, (res) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed = raw;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch (_error) {
        // Preserve non-JSON responses in assertion details.
      }
      resolve({ status: res.statusCode, body: parsed, headers: res.headers });
    });
  });
  req.on('error', reject);
  req.setTimeout(15000, () => req.destroy(new Error(`${method} ${path} timed out`)));
  if (payload) req.write(payload);
  req.end();
});

const expectStatus = async (options, expectedStatus) => {
  const response = await request(options);
  assert.equal(response.status, expectedStatus, `${options.method || 'GET'} ${options.path}: ${JSON.stringify(response.body)}`);
  return response;
};

const integrationTest = (name, handler) => {
  test(name, { skip: !RUN_INTEGRATION, concurrency: false }, handler);
};

let accessToken;
let customerId;
let loanId;
const fixtureLoanIds = [];
const fixtureAssociateIds = [];
const fixtureExpenseIds = [];
let fixturePrefix;

const cleanupFixture = async () => {
  if (!fixturePrefix) return;

  for (const currentLoanId of [...new Set(fixtureLoanIds.filter(Boolean))]) {
    await Payment.destroy({ where: { loanId: currentLoanId }, force: true });
    await DocumentAttachment.destroy({ where: { loanId: currentLoanId }, force: true });
    await LoanAlert.destroy({ where: { loanId: currentLoanId }, force: true });
    await PromiseToPay.destroy({ where: { loanId: currentLoanId }, force: true });
    await ProfitDistribution.destroy({ where: { loanId: currentLoanId }, force: true });
    await Loan.destroy({ where: { id: currentLoanId }, force: true });
  }
  for (const currentAssociateId of [...new Set(fixtureAssociateIds.filter(Boolean))]) {
    await AssociateInstallment.destroy({ where: { associateId: currentAssociateId }, force: true });
    await AssociateContribution.destroy({ where: { associateId: currentAssociateId }, force: true });
    await ProfitDistribution.destroy({ where: { associateId: currentAssociateId }, force: true });
    await Associate.destroy({ where: { id: currentAssociateId }, force: true });
  }
  for (const currentExpenseId of [...new Set(fixtureExpenseIds.filter(Boolean))]) {
    await OperatingExpense.destroy({ where: { id: currentExpenseId }, force: true });
  }
  await IdempotencyKey.destroy({ where: { idempotencyKey: { [Op.like]: `${fixturePrefix}%` } }, force: true });
  if (customerId) {
    await Customer.destroy({ where: { id: customerId }, force: true });
  }
  await sequelize.close();
};

integrationTest('producto: origina un crédito y expone el mismo calendario por API y reportes', async () => {
  assert.ok(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/u.test(BASE_URL), 'Las pruebas mutables solo pueden apuntar a un backend local.');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(DB_HOST), 'Las pruebas mutables solo pueden apuntar a una base de datos local.');

  let response = await expectStatus({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  }, 200);
  accessToken = response.body?.data?.accessToken;
  assert.ok(accessToken, 'El login real debe devolver data.accessToken.');

  fixturePrefix = `product-integration-${Date.now()}-${process.pid}`;
  response = await expectStatus({
    method: 'POST',
    path: '/api/customers',
    token: accessToken,
    body: {
      name: `Cliente ${fixturePrefix}`,
      email: `${fixturePrefix}@test.local`,
      phone: `300${String(Date.now()).slice(-7)}`,
      documentNumber: `DOC-${fixturePrefix}`,
      status: 'active',
    },
  }, 201);
  customerId = response.body?.data?.id;
  assert.ok(customerId, 'La creación real debe devolver el id del cliente.');

  response = await expectStatus({
    method: 'POST',
    path: '/api/loans/calculations',
    token: accessToken,
    body: {
      amount: 1000000,
      interestRate: 24,
      termMonths: 3,
      startDate: '2026-07-17',
      lateFeeMode: 'SIMPLE',
      calculationMethod: 'FRENCH',
    },
  }, 200);
  const calculation = response.body?.data?.calculation;
  assert.equal(calculation?.method, 'FRENCH');
  assert.equal(calculation?.schedule?.length, 3);

  response = await expectStatus({
    method: 'POST',
    path: '/api/loans',
    token: accessToken,
    headers: { 'Idempotency-Key': `${fixturePrefix}-loan` },
    body: {
      customerId,
      amount: 1000000,
      termMonths: 3,
      startDate: '2026-07-17',
      rateSource: 'policy',
      lateFeeSource: 'policy',
    },
  }, 201);
  loanId = response.body?.data?.loan?.id;
  fixtureLoanIds.push(loanId);
  assert.ok(loanId, 'La originación real debe devolver data.loan.id.');
  assert.equal(response.body.data.loan.emiSchedule.length, 3);
  assert.equal(response.body.data.loan.status, 'pending');

  response = await expectStatus({
    method: 'PATCH',
    path: `/api/loans/${loanId}/status`,
    token: accessToken,
    body: { status: 'approved' },
  }, 200);
  assert.equal(response.body?.data?.loan?.status, 'approved');
  response = await expectStatus({
    method: 'PATCH',
    path: `/api/loans/${loanId}/status`,
    token: accessToken,
    body: { status: 'active' },
  }, 200);
  assert.equal(response.body?.data?.loan?.status, 'active');

  response = await expectStatus({
    method: 'POST',
    path: `/api/loans/${loanId}/promises`,
    token: accessToken,
    body: { promisedDate: '2026-08-17', amount: 200000, notes: 'Compromiso de pago QA' },
  }, 201);
  const promiseId = response.body?.data?.promise?.id;
  assert.ok(promiseId);
  assert.equal(response.body?.data?.promise?.status, 'pending');
  response = await expectStatus({ path: `/api/loans/${loanId}/promises`, token: accessToken }, 200);
  assert.ok(response.body?.data?.promises?.some((promise) => Number(promise.id) === Number(promiseId)));
  response = await expectStatus({
    method: 'PATCH',
    path: `/api/loans/${loanId}/promises/${promiseId}/status`,
    token: accessToken,
    body: { status: 'kept', notes: 'Pago confirmado' },
  }, 200);
  assert.equal(response.body?.data?.promise?.status, 'kept');

  response = await expectStatus({ path: `/api/loans/${loanId}`, token: accessToken }, 200);
  assert.equal(response.body?.data?.loan?.id, loanId);
  assert.equal(response.body?.data?.loan?.customerId, customerId);
});

integrationTest('producto: proyecta y aplica abonos a capital sin alterar la deuda antes de confirmar', async () => {
  assert.ok(accessToken && customerId && fixturePrefix, 'La prueba de capital requiere el fixture de originación.');

  const response = await expectStatus({
    method: 'POST',
    path: '/api/loans',
    token: accessToken,
    headers: { 'Idempotency-Key': `${fixturePrefix}-capital-loan` },
    body: {
      customerId,
      amount: 1000000,
      termMonths: 4,
      startDate: '2026-07-17',
      rateSource: 'policy',
      lateFeeSource: 'policy',
    },
  }, 201);
  const capitalLoanId = response.body?.data?.loan?.id;
  fixtureLoanIds.push(capitalLoanId);
  assert.ok(capitalLoanId);

  const before = await expectStatus({ path: `/api/loans/${capitalLoanId}`, token: accessToken }, 200);
  const scheduleBefore = before.body?.data?.loan?.emiSchedule;
  assert.equal(scheduleBefore?.length, 4);

  // The domain requires the first scheduled installment to be paid before a
  // capital prepayment. Exercise that guard through the real payment route.
  await expectStatus({
    method: 'POST',
    path: '/api/loans/payments/process',
    token: accessToken,
    headers: { 'Idempotency-Key': `${fixturePrefix}-capital-first-installment` },
    body: {
      loanId: capitalLoanId,
      paymentAmount: Number(scheduleBefore[0].scheduledPayment),
      paymentDate: '2026-07-17',
      paymentMethod: 'cash',
    },
  }, 200);

  const afterFirstInstallment = await expectStatus({ path: `/api/loans/${capitalLoanId}`, token: accessToken }, 200);
  const principalBefore = Number(afterFirstInstallment.body?.data?.loan?.financialSnapshot?.outstandingPrincipal);
  assert.ok(principalBefore > 0 && principalBefore < 1000000);

  const preview = await expectStatus({
    method: 'POST',
    path: '/api/payments/capital/preview',
    token: accessToken,
    body: {
      loanId: capitalLoanId,
      amount: 250000,
      asOfDate: '2026-07-17',
      strategy: 'REDUCE_QUOTA',
      newTermMonths: 4,
    },
  }, 200);
  assert.equal(preview.body?.data?.preview?.before?.outstandingPrincipal, principalBefore);
  const expectedPrincipalAfterCapital = Math.round((principalBefore - 250000) * 100) / 100;
  assert.equal(preview.body?.data?.preview?.after?.outstandingPrincipal, expectedPrincipalAfterCapital);

  const unchanged = await expectStatus({ path: `/api/loans/${capitalLoanId}`, token: accessToken }, 200);
  assert.equal(Number(unchanged.body?.data?.loan?.financialSnapshot?.outstandingPrincipal), principalBefore, 'El preview no debe persistir cambios.');

  const applied = await expectStatus({
    method: 'POST',
    path: '/api/payments/capital',
    token: accessToken,
    headers: { 'Idempotency-Key': `${fixturePrefix}-capital-payment` },
    body: {
      loanId: capitalLoanId,
      amount: 250000,
      paymentDate: '2026-07-17',
      paymentMethod: 'cash',
      strategy: 'REDUCE_QUOTA',
      newTermMonths: 4,
    },
  }, 201);
  assert.equal(applied.body?.data?.allocation?.principalApplied, 250000);
  assert.equal(applied.body?.data?.allocation?.remainingPrincipalOutstanding, expectedPrincipalAfterCapital);
  assert.equal(applied.body?.data?.strategyApplied, 'reduce_payment');

  const replay = await expectStatus({
    method: 'POST',
    path: '/api/payments/capital',
    token: accessToken,
    headers: { 'Idempotency-Key': `${fixturePrefix}-capital-payment` },
    body: {
      loanId: capitalLoanId,
      amount: 250000,
      paymentDate: '2026-07-17',
      paymentMethod: 'cash',
      strategy: 'REDUCE_QUOTA',
      newTermMonths: 4,
    },
  }, 201);
  assert.equal(replay.body?.data?.payment?.id, applied.body?.data?.payment?.id, 'Repetir el abono no debe duplicarlo.');

  const after = await expectStatus({ path: `/api/loans/${capitalLoanId}`, token: accessToken }, 200);
  assert.equal(Number(after.body?.data?.loan?.financialSnapshot?.outstandingPrincipal), expectedPrincipalAfterCapital);
  const scheduleAfter = after.body?.data?.loan?.emiSchedule || [];
  assert.equal(scheduleAfter.length, 5, 'El historial de la cuota pagada se conserva y se agregan cuatro cuotas reproyectadas.');
  assert.equal(scheduleAfter.filter((row) => !['paid', 'annulled'].includes(row.status)).length, 4);
});

integrationTest('producto: calcula mora y liquida el saldo total con cierre y trazabilidad', async () => {
  assert.ok(accessToken && customerId && fixturePrefix, 'La prueba de liquidación requiere el fixture de originación.');

  const response = await expectStatus({
    method: 'POST',
    path: '/api/loans',
    token: accessToken,
    headers: { 'Idempotency-Key': `${fixturePrefix}-payoff-loan` },
    body: {
      customerId,
      amount: 900000,
      termMonths: 3,
      startDate: '2026-01-01',
      rateSource: 'policy',
      lateFeeSource: 'policy',
    },
  }, 201);
  const payoffLoanId = response.body?.data?.loan?.id;
  fixtureLoanIds.push(payoffLoanId);

  const quote = await expectStatus({ path: `/api/loans/${payoffLoanId}/payoff-quote?asOfDate=2026-07-18`, token: accessToken }, 200);
  const payoffQuote = quote.body?.data?.payoffQuote;
  assert.equal(payoffQuote?.accrualMethod, 'actual/360');
  assert.ok(Number(payoffQuote?.accruedDays) > 0);
  assert.ok(Number(payoffQuote?.breakdown?.overduePrincipal) > 0);
  assert.ok(Number(payoffQuote?.breakdown?.overdueInterest) > 0);
  assert.ok(Number(payoffQuote?.total) > Number(payoffQuote?.breakdown?.principal || 0), 'La mora/interés debe sumarse, no restarse, del saldo total.');

  const execution = await expectStatus({
    method: 'POST',
    path: `/api/loans/${payoffLoanId}/payoff-executions`,
    token: accessToken,
    headers: { 'Idempotency-Key': `${fixturePrefix}-payoff` },
    body: { asOfDate: '2026-07-18', quotedTotal: payoffQuote.total },
  }, 201);
  assert.equal(execution.body?.data?.loan?.status, 'closed');
  assert.equal(execution.body?.data?.loan?.closureReason, 'payoff');
  assert.ok(Number(execution.body?.data?.allocation?.payoff?.breakdown?.overdueInterest) > 0);

  const history = await expectStatus({ path: `/api/reports/credit-history/loan/${payoffLoanId}`, token: accessToken }, 200);
  assert.equal(history.body?.data?.history?.closure?.closureReason, 'payoff');
  assert.equal(history.body?.data?.history?.payoffHistory?.length, 1);
});

integrationTest('producto: gestiona el ciclo financiero completo de un socio y sus reportes', async () => {
  assert.ok(accessToken && fixturePrefix, 'La prueba de socios requiere autenticación administrativa.');

  let response = await expectStatus({
    method: 'POST',
    path: '/api/associates',
    token: accessToken,
    body: {
      name: `Socio ${fixturePrefix}`,
      email: `socio-${fixturePrefix}@test.local`,
      phone: `301${String(Date.now()).slice(-7)}`,
      status: 'active',
      interestType: 'monthly',
      interestRate: 2,
      interestPaymentDay: 28,
      interestPaymentMonth: 1,
      initialCapital: 1000000,
    },
  }, 201);
  const associateId = response.body?.data?.associate?.id;
  fixtureAssociateIds.push(associateId);
  assert.ok(associateId);
  assert.equal(response.body?.data?.associate?.interestType, 'monthly');

  response = await expectStatus({ path: `/api/associates/${associateId}/installments`, token: accessToken }, 200);
  const initialInstallments = response.body?.data?.installments?.installments;
  assert.equal(initialInstallments?.length, 1);
  assert.equal(Number(initialInstallments[0].amount), 20000, 'La rentabilidad mensual debe ser capital x tasa mensual.');

  response = await expectStatus({ path: `/api/associates/${associateId}/financial-summary`, token: accessToken }, 200);
  assert.equal(Number(response.body?.data?.report?.summary?.currentCapital ?? response.body?.data?.report?.currentCapital), 1000000);

  response = await expectStatus({
    method: 'POST',
    path: `/api/associates/${associateId}/contributions`,
    token: accessToken,
    body: { amount: 500000, contributionDate: '2026-07-18', notes: 'Aporte integración' },
  }, 201);
  assert.equal(Number(response.body?.data?.contribution?.amount), 500000);

  response = await expectStatus({ path: `/api/associates/${associateId}/installments`, token: accessToken }, 200);
  assert.equal(Number(response.body?.data?.installments?.installments?.[0]?.amount), 30000, 'La cuota futura debe reproyectarse con el capital vigente.');

  response = await expectStatus({
    method: 'POST',
    path: `/api/associates/${associateId}/installments/1/pay`,
    token: accessToken,
    body: { paymentDate: '2026-07-18', paymentMethod: 'transfer' },
  }, 200);
  assert.equal(response.body?.data?.installment?.installment?.status, 'paid');

  response = await expectStatus({
    method: 'POST',
    path: `/api/associates/${associateId}/capital-returns`,
    token: accessToken,
    body: { amount: 250000, capitalReturnDate: '2026-08-01', notes: 'Retiro parcial integración' },
  }, 201);
  assert.equal(response.body?.data?.summary?.currentCapital, 1250000);

  response = await expectStatus({
    method: 'POST',
    path: `/api/associates/${associateId}/reinvestments`,
    token: accessToken,
    body: { amount: 100000, reinvestmentDate: '2026-08-02', notes: 'Reinversión integración' },
  }, 201);
  assert.equal(response.body?.data?.reinvestment?.amount, '100000.00');

  response = await expectStatus({ path: `/api/associates/movements?associateId=${associateId}`, token: accessToken }, 200);
  assert.ok(Array.isArray(response.body?.data?.report?.rows));
  assert.ok(response.body.data.report.rows.some((row) => row.movementType === 'reinvestment'));

  response = await expectStatus({ path: `/api/associates/${associateId}/financial-details`, token: accessToken }, 200);
  assert.ok(response.body?.data?.details);
  response = await expectStatus({ path: `/api/associates/${associateId}/calendar-events`, token: accessToken }, 200);
  assert.ok(Array.isArray(response.body?.data?.calendar?.events));

  // Annual CDT-style returns use the same nominal rate over a yearly period.
  response = await expectStatus({
    method: 'POST',
    path: '/api/associates',
    token: accessToken,
    body: {
      name: `Socio anual ${fixturePrefix}`,
      email: `socio-anual-${fixturePrefix}@test.local`,
      phone: `303${String(Date.now()).slice(-7)}`,
      status: 'active',
      interestType: 'annual',
      interestRate: 12,
      interestPaymentDay: 15,
      interestPaymentMonth: 8,
      initialCapital: 1200000,
    },
  }, 201);
  const annualAssociateId = response.body?.data?.associate?.id;
  fixtureAssociateIds.push(annualAssociateId);
  assert.ok(annualAssociateId);

  response = await expectStatus({ path: `/api/associates/${annualAssociateId}/installments`, token: accessToken }, 200);
  const annualInstallment = response.body?.data?.installments?.installments?.[0];
  assert.equal(Number(annualInstallment?.amount), 144000, 'La rentabilidad anual debe ser capital x tasa anual.');
  assert.match(String(annualInstallment?.dueDate), /^2026-08-15/u);

  response = await expectStatus({ path: `/api/associates/${associateId}/export?format=xlsx`, token: accessToken }, 200);
  assert.match(String(response.headers['content-type']), /spreadsheet|octet-stream/u);
  response = await expectStatus({ path: '/api/associates/export?format=pdf', token: accessToken }, 200);
  assert.match(String(response.headers['content-type']), /pdf/u);
});

integrationTest('producto: registra un pago, actualiza calendario, liquida cuota y exporta reportes', async () => {
  assert.ok(accessToken && loanId, 'La prueba de servicio requiere el fixture de originación.');

  let response = await expectStatus({
    method: 'POST',
    path: '/api/loans/payments/process',
    token: accessToken,
    headers: { 'Idempotency-Key': `${fixturePrefix}-payment` },
    body: {
      loanId,
      paymentAmount: 100000,
      paymentDate: '2026-07-17',
      paymentMethod: 'cash',
    },
  }, 200);
  assert.ok(response.body?.data?.paymentId, 'El pago real debe devolver el id persistido.');
  assert.equal(response.body?.data?.status, 'APPLIED');
  assert.ok(Number(response.body?.data?.breakdown?.capital || 0) > 0, 'El pago debe aplicar capital positivo.');
  const paymentId = response.body.data.paymentId;

  response = await expectStatus({
    method: 'POST',
    path: '/api/loans/payments/process',
    token: accessToken,
    headers: { 'Idempotency-Key': `${fixturePrefix}-payment` },
    body: {
      loanId,
      paymentAmount: 100000,
      paymentDate: '2026-07-17',
      paymentMethod: 'cash',
    },
  }, 200);
  assert.equal(response.body?.data?.idempotent, true, 'Repetir la misma operación no debe duplicar el pago.');
  assert.equal(response.body?.data?.paymentId, paymentId);

  response = await expectStatus({ path: `/api/loans/${loanId}/calendar?asOfDate=2026-07-17`, token: accessToken }, 200);
  const entries = response.body?.data?.calendar?.entries;
  assert.equal(entries?.length, 3);
  assert.equal(entries[0].status, 'partial');
  assert.equal(entries[1].canPay, false);
  assert.match(entries[1].disabledReason, /Debe pagar primero la cuota 1/u);

  response = await expectStatus({ path: `/api/loans/${loanId}/payoff-quote?asOfDate=2026-07-17`, token: accessToken }, 200);
  const quote = response.body?.data?.payoffQuote;
  assert.equal(quote?.accrualMethod, 'actual/360');
  assert.equal(quote?.accruedDays, 0);
  assert.ok(Number(quote?.total) > 0);

  response = await expectStatus({ path: `/api/reports/credit-history/loan/${loanId}`, token: accessToken }, 200);
  assert.equal(response.body?.data?.history?.loan?.id, loanId);
  assert.equal(response.body?.data?.history?.payments?.length, 1);

  response = await expectStatus({ path: '/api/reports/credits/excel', token: accessToken }, 200);
  assert.match(String(response.headers['content-type']), /spreadsheet|octet-stream/u);
  assert.ok(String(response.headers['content-disposition']).includes('.xlsx'));
});

integrationTest('producto: expone módulos operativos y respeta permisos por rol', async () => {
  const adminToken = accessToken;
  assert.ok(adminToken, 'La prueba de módulos requiere el token administrativo del flujo principal.');

  for (const path of [
    '/api/customers?page=1&pageSize=5',
    '/api/loans?page=1&pageSize=5',
    '/api/associates?page=1&pageSize=5',
    '/api/payments?page=1&pageSize=5',
    '/api/config/payment-methods',
    '/api/config/rate-policies',
    '/api/config/late-fee-policies',
    '/api/permissions',
    '/api/audits/stats',
    '/api/reports/dashboard',
  ]) {
    const response = await expectStatus({ path, token: adminToken }, 200);
    assert.equal(response.body?.success, true, `${path} debe devolver success=true`);
  }

  const response = await expectStatus({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: EMPLOYEE_EMAIL, password: EMPLOYEE_PASSWORD },
  }, 200);
  const employeeToken = response.body?.data?.accessToken;
  assert.ok(employeeToken);
  assert.equal(response.body?.data?.user?.role, 'employee');

  for (const path of [
    '/api/config/payment-methods',
    '/api/audits/stats',
    '/api/reports/dashboard',
    '/api/payments?page=1&pageSize=5',
    '/api/loans?page=1&pageSize=5',
  ]) {
    await expectStatus({ path, token: employeeToken }, 403);
  }
});

integrationTest('producto: mantiene configuración, gastos, notificaciones y reportes administrativos coherentes', async () => {
  assert.ok(accessToken && fixturePrefix, 'La prueba administrativa requiere autenticación y fixture.');

  let response = await expectStatus({ path: '/api/config/rate-policies', token: accessToken }, 200);
  const ratePolicy = response.body?.data?.policies?.find((policy) => policy.key === 'standard-credit');
  assert.ok(ratePolicy?.id);
  assert.equal(Number(ratePolicy.annualEffectiveRate), 60);

  response = await expectStatus({
    method: 'PUT',
    path: `/api/config/rate-policies/${ratePolicy.id}`,
    token: accessToken,
    body: { annualEffectiveRate: 61 },
  }, 200);
  assert.equal(Number(response.body?.data?.policy?.annualEffectiveRate), 61);
  response = await expectStatus({
    method: 'PUT',
    path: `/api/config/rate-policies/${ratePolicy.id}`,
    token: accessToken,
    body: { annualEffectiveRate: 60 },
  }, 200);
  assert.equal(Number(response.body?.data?.policy?.annualEffectiveRate), 60, 'La restauración de la tasa no debe dejar configuración de prueba activa.');

  response = await expectStatus({ path: '/api/config/late-fee-policies', token: accessToken }, 200);
  const lateFeePolicy = response.body?.data?.policies?.find((policy) => policy.key === 'standard-simple-late-fee');
  assert.ok(lateFeePolicy?.id);
  assert.equal(String(lateFeePolicy.lateFeeMode), 'SIMPLE');
  response = await expectStatus({
    method: 'PUT',
    path: `/api/config/late-fee-policies/${lateFeePolicy.id}`,
    token: accessToken,
    body: { annualEffectiveRate: 13, lateFeeMode: 'SIMPLE' },
  }, 200);
  assert.equal(Number(response.body?.data?.policy?.annualEffectiveRate), 13);
  await expectStatus({
    method: 'PUT',
    path: `/api/config/late-fee-policies/${lateFeePolicy.id}`,
    token: accessToken,
    body: { annualEffectiveRate: 12, lateFeeMode: 'SIMPLE' },
  }, 200);

  response = await expectStatus({
    method: 'POST',
    path: '/api/operating-expenses',
    token: accessToken,
    body: {
      amount: 125000,
      expenseDate: '2026-07-18',
      category: 'Servicios',
      description: `Gasto ${fixturePrefix}`,
      paymentMethod: 'cash',
      reference: `${fixturePrefix}-expense`,
    },
  }, 201);
  const expenseId = response.body?.data?.expense?.id;
  fixtureExpenseIds.push(expenseId);
  assert.ok(expenseId);
  assert.equal(Number(response.body?.data?.expense?.amount), 125000);
  assert.equal(response.body?.data?.expense?.status, 'completed');

  response = await expectStatus({ path: '/api/operating-expenses?fromDate=2026-07-18&toDate=2026-07-18&status=completed', token: accessToken }, 200);
  assert.ok(response.body?.data?.expenses?.some((expense) => Number(expense.id) === Number(expenseId)));

  response = await expectStatus({
    method: 'POST',
    path: `/api/operating-expenses/${expenseId}/annul`,
    token: accessToken,
    body: { reason: 'Prueba de reversión operativa' },
  }, 200);
  assert.equal(response.body?.data?.expense?.status, 'annulled');
  assert.equal(response.body?.data?.expense?.annulmentReason, 'Prueba de reversión operativa');

  response = await expectStatus({ path: '/api/reports/operating-expenses/export?format=xlsx&fromDate=2026-07-18&toDate=2026-07-18', token: accessToken }, 200);
  assert.match(String(response.headers['content-type']), /spreadsheet|octet-stream/u);
  response = await expectStatus({ path: '/api/reports/operating-expenses/export?format=pdf&fromDate=2026-07-18&toDate=2026-07-18', token: accessToken }, 200);
  assert.match(String(response.headers['content-type']), /pdf/u);

  response = await expectStatus({ path: '/api/notifications/unread-count', token: accessToken }, 200);
  assert.equal(typeof response.body?.data?.unreadCount, 'number');
  response = await expectStatus({ path: '/api/notifications', token: accessToken }, 200);
  assert.ok(Array.isArray(response.body?.data?.notifications));
  response = await expectStatus({ method: 'PATCH', path: '/api/notifications/mark-all-read', token: accessToken, body: {} }, 200);
  assert.equal(response.body?.success, true);

  response = await expectStatus({ path: '/api/config/payment-methods/active', token: accessToken }, 200);
  assert.ok(response.body?.data?.paymentMethods?.some((method) => method.key === 'cash'));
});

test.after(async () => {
  if (!RUN_INTEGRATION) return;
  await cleanupFixture();
});
