const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const { Op } = require('sequelize');

const {
  sequelize,
  Customer,
  Loan,
  Payment,
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
let fixturePrefix;

const cleanupFixture = async () => {
  if (!fixturePrefix) return;

  if (loanId) {
    await Payment.destroy({ where: { loanId }, force: true });
    await DocumentAttachment.destroy({ where: { loanId }, force: true });
    await LoanAlert.destroy({ where: { loanId }, force: true });
    await PromiseToPay.destroy({ where: { loanId }, force: true });
    await ProfitDistribution.destroy({ where: { loanId }, force: true });
    await Loan.destroy({ where: { id: loanId }, force: true });
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
  assert.ok(loanId, 'La originación real debe devolver data.loan.id.');
  assert.equal(response.body.data.loan.emiSchedule.length, 3);
  assert.equal(response.body.data.loan.status, 'pending');

  response = await expectStatus({ path: `/api/loans/${loanId}`, token: accessToken }, 200);
  assert.equal(response.body?.data?.loan?.id, loanId);
  assert.equal(response.body?.data?.loan?.customerId, customerId);
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

test.after(async () => {
  if (!RUN_INTEGRATION) return;
  await cleanupFixture();
});
