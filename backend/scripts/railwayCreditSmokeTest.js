require('dotenv').config();

const http = require('node:http');
const https = require('node:https');

const defaultBaseUrl = `http://127.0.0.1:${process.env.PORT || 5000}`;
const baseUrl = String(process.env.SMOKE_API_BASE_URL || defaultBaseUrl).replace(/\/+$/, '');

const requireEnv = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const adminEmail = requireEnv('SMOKE_ADMIN_EMAIL');
const adminPassword = requireEnv('SMOKE_ADMIN_PASSWORD');
const customerEmail = requireEnv('SMOKE_CUSTOMER_EMAIL');
const socioEmail = requireEnv('SMOKE_SOCIO_EMAIL');

const request = ({ method = 'GET', path, token, body, headers = {} }) => new Promise((resolve, reject) => {
  const url = new URL(path, baseUrl);
  const payload = body === undefined ? null : JSON.stringify(body);
  const client = url.protocol === 'https:' ? https : http;
  const requestHeaders = {
    accept: 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders.authorization = `Bearer ${token}`;
  }

  if (payload) {
    requestHeaders['content-type'] = 'application/json';
    requestHeaders['content-length'] = Buffer.byteLength(payload);
  }

  const req = client.request(url, { method, headers: requestHeaders }, (res) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      let parsed = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch (_error) {
        parsed = text;
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        const error = new Error(`${method} ${path} failed with HTTP ${res.statusCode}`);
        error.details = parsed;
        reject(error);
        return;
      }

      resolve(parsed);
    });
  });

  req.on('error', reject);

  if (payload) {
    req.write(payload);
  }

  req.end();
});

const assert = (condition, message, details = undefined) => {
  if (!condition) {
    const error = new Error(message);
    if (details !== undefined) {
      error.details = details;
    }
    throw error;
  }
};

const listFromBody = (body, key) => {
  if (Array.isArray(body?.data?.[key])) return body.data[key];
  if (Array.isArray(body?.data?.items)) return body.data.items;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.[key])) return body[key];
  return [];
};

const loginAdmin = async () => {
  const response = await request({
    method: 'POST',
    path: '/api/auth/login',
    body: { email: adminEmail, password: adminPassword },
  });
  const token = response?.data?.accessToken;
  assert(token, 'Admin login did not return data.accessToken', response);
  return token;
};

const createLoan = async ({ token, customerId, associateId, amount, termMonths, index }) => {
  const response = await request({
    method: 'POST',
    path: '/api/loans',
    token,
    headers: { 'Idempotency-Key': `qa-reset-credit-${Date.now()}-${process.pid}-${index}` },
    body: {
      customerId,
      associateId,
      amount,
      interestRate: 36,
      termMonths,
      startDate: '2026-06-01',
      lateFeeMode: 'SIMPLE',
      annualLateFeeRate: 12,
      calculationMethod: 'FRENCH',
      rateSource: 'manual',
      lateFeeSource: 'manual',
    },
  });

  const loan = response?.data?.loan;
  assert(loan?.id, 'Loan creation response did not include data.loan.id', response);
  assert(loan.status === 'pending', `Expected pending loan status, received ${loan.status}`, loan);
  assert(Array.isArray(loan.emiSchedule), `Loan ${loan.id} did not include emiSchedule`, loan);
  assert(loan.emiSchedule.length === termMonths, `Loan ${loan.id} schedule length mismatch`, loan);
  assert(loan.calculationMethod === 'FRENCH', `Loan ${loan.id} calculation method mismatch`, loan);

  return {
    id: loan.id,
    amount: loan.amount,
    termMonths: loan.termMonths,
    status: loan.status,
    scheduleLength: loan.emiSchedule.length,
    calculationMethod: loan.calculationMethod,
  };
};

const main = async () => {
  const token = await loginAdmin();

  const [customersBody, associatesBody, loansBeforeBody] = await Promise.all([
    request({ path: '/api/customers?page=1&pageSize=10', token }),
    request({ path: '/api/associates?page=1&pageSize=10', token }),
    request({ path: '/api/loans?page=1&pageSize=20', token }),
  ]);

  const customers = listFromBody(customersBody, 'customers');
  const associates = listFromBody(associatesBody, 'associates');
  const loansBefore = listFromBody(loansBeforeBody, 'loans');
  const customer = customers.find((entry) => entry.email === customerEmail);
  const associate = associates.find((entry) => entry.email === socioEmail);

  assert(customer?.id, `Seeded customer ${customerEmail} was not found`, customersBody);
  assert(associate?.id, `Seeded associate ${socioEmail} was not found`, associatesBody);
  assert(loansBefore.length === 0, `Expected clean loans table after reset, found ${loansBefore.length}`, loansBeforeBody);

  const created = [];
  created.push(await createLoan({
    token,
    customerId: customer.id,
    associateId: associate.id,
    amount: 1200000,
    termMonths: 12,
    index: 1,
  }));
  created.push(await createLoan({
    token,
    customerId: customer.id,
    associateId: associate.id,
    amount: 750000,
    termMonths: 6,
    index: 2,
  }));

  const loansAfterBody = await request({ path: '/api/loans?page=1&pageSize=20', token });
  const loansAfter = listFromBody(loansAfterBody, 'loans');
  assert(loansAfter.length === created.length, `Expected ${created.length} loans after creation, found ${loansAfter.length}`, loansAfterBody);

  const details = [];
  for (const loan of created) {
    const detailBody = await request({ path: `/api/loans/${loan.id}`, token });
    const detail = detailBody?.data?.loan || detailBody?.data;
    assert(Number(detail?.id) === Number(loan.id), `Loan ${loan.id} detail did not round-trip`, detailBody);
    details.push({
      id: detail.id,
      status: detail.status,
      paymentContext: Boolean(detail.paymentContext),
      outstandingBalance: detail.financialSnapshot?.outstandingBalance,
    });
  }

  console.log(JSON.stringify({
    baseUrl,
    cleanBeforeCreation: true,
    seeded: {
      customerId: customer.id,
      associateId: associate.id,
    },
    created,
    loansAfterCount: loansAfter.length,
    details,
  }, null, 2));
};

main().catch((error) => {
  console.error(error.message);
  if (error.details !== undefined) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exitCode = 1;
});
