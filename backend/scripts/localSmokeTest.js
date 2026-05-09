require('dotenv').config();

const http = require('node:http');
const https = require('node:https');

const DEFAULT_BASE_URL = 'http://127.0.0.1:5000';
const baseUrl = String(process.env.SMOKE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const allowRemote = process.env.SMOKE_ALLOW_REMOTE === 'true';

const isLocalBaseUrl = (value) => {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch (_error) {
    return false;
  }
};

const assert = (condition, message, details = undefined) => {
  if (!condition) {
    const error = new Error(message);
    if (details !== undefined) {
      error.details = details;
    }
    throw error;
  }
};

const request = ({ method = 'GET', path, token, body, headers = {} }) => new Promise((resolve, reject) => {
  const url = new URL(path, baseUrl);
  const payload = body === undefined ? null : JSON.stringify(body);
  const client = url.protocol === 'https:' ? https : http;
  const requestHeaders = {
    accept: 'application/json',
    ...headers,
  };

  if (payload) {
    requestHeaders['content-type'] = 'application/json';
    requestHeaders['content-length'] = Buffer.byteLength(payload);
  }

  if (token) {
    requestHeaders.authorization = `Bearer ${token}`;
  }

  const req = client.request(url, { method, headers: requestHeaders }, (res) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      let parsedBody = text;
      try {
        parsedBody = text ? JSON.parse(text) : null;
      } catch (_error) {
        parsedBody = text;
      }

      resolve({
        status: res.statusCode,
        headers: res.headers,
        body: parsedBody,
      });
    });
  });

  req.on('error', reject);

  if (payload) {
    req.write(payload);
  }

  req.end();
});

const expectStatus = async (label, requestOptions, expectedStatus = 200) => {
  const response = await request(requestOptions);
  assert(
    response.status === expectedStatus,
    `${label} expected HTTP ${expectedStatus} but received HTTP ${response.status}`,
    response.body,
  );
  return response;
};

const login = async ({ email, password, label }) => {
  if (!email || !password) {
    return null;
  }

  const response = await expectStatus(`${label} login`, {
    method: 'POST',
    path: '/api/auth/login',
    body: { email, password },
  });
  const token = response.body?.data?.accessToken;
  assert(token, `${label} login did not return data.accessToken`, response.body);
  return token;
};

const runPublicSmoke = async (summary) => {
  const health = await expectStatus('health', { path: '/health' });
  assert(health.body?.status === 'success', 'health response did not report success', health.body);
  summary.public.health = health.body.message;

  const api = await expectStatus('api index', { path: '/api' });
  const endpoints = api.body?.endpoints || {};
  const endpointValues = new Set(Object.values(endpoints));
  const requiredRoutes = ['/api/auth', '/api/customers', '/api/loans', '/api/payments', '/api/reports', '/api/config'];
  for (const route of requiredRoutes) {
    assert(endpointValues.has(route), `api index is missing ${route} route`, api.body);
  }
  summary.public.endpoints = Object.keys(endpoints).sort();

  const openapi = await expectStatus('openapi', { path: '/api/docs/openapi.json' });
  const openapiText = JSON.stringify(openapi.body);
  assert(!openapiText.includes('graphVersionId'), 'OpenAPI still exposes graphVersionId');
  assert(!openapiText.includes('DagGraphVersion'), 'OpenAPI still exposes DagGraphVersion');
  summary.public.openapi = openapi.body?.info?.title || 'available';
};

const runAdminSmoke = async (summary) => {
  const token = await login({
    label: 'admin',
    email: process.env.SMOKE_ADMIN_EMAIL,
    password: process.env.SMOKE_ADMIN_PASSWORD,
  });

  if (!token) {
    summary.admin = 'skipped: set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD';
    return;
  }

  const profile = await expectStatus('admin profile', { path: '/api/auth/profile', token });
  assert(profile.body?.data?.user?.role === 'admin', 'admin credentials did not resolve to admin role', profile.body);

  const calculation = await expectStatus('credit calculation', {
    method: 'POST',
    path: '/api/loans/calculations',
    token,
    body: {
      amount: 1200000,
      interestRate: 36,
      termMonths: 12,
      startDate: '2026-06-01',
      lateFeeMode: 'SIMPLE',
      calculationMethod: 'FRENCH',
    },
  });
  const calculationBody = calculation.body?.data?.calculation;
  assert(calculationBody?.method === 'FRENCH', 'calculation did not return canonical method', calculation.body);
  assert(!Object.prototype.hasOwnProperty.call(calculationBody, 'calculationMethod'), 'calculation exposes legacy calculationMethod');
  assert(!Object.prototype.hasOwnProperty.call(calculationBody, 'graphVersionId'), 'calculation exposes graphVersionId');
  assert(Array.isArray(calculationBody.schedule) && calculationBody.schedule.length === 12, 'calculation schedule is invalid', calculation.body);

  await expectStatus('loans list', { path: '/api/loans?page=1&pageSize=5', token });
  await expectStatus('customers list', { path: '/api/customers?page=1&pageSize=5', token });
  await expectStatus('associates list', { path: '/api/associates?page=1&pageSize=5', token });
  await expectStatus('payment methods', { path: '/api/config/payment-methods', token });
  await expectStatus('rate policies', { path: '/api/config/rate-policies', token });
  await expectStatus('late fee policies', { path: '/api/config/late-fee-policies', token });
  await expectStatus('permissions', { path: '/api/permissions/me', token });
  await expectStatus('audit stats', { path: '/api/audits/stats', token });
  await expectStatus('reports dashboard', { path: '/api/reports/dashboard', token });
  await expectStatus('reports credits summary', { path: '/api/reports/credits/summary', token });
  await expectStatus('payments list', { path: '/api/payments?page=1&pageSize=5', token });

  summary.admin = 'authenticated core modules passed';
};

const runCustomerSmoke = async (summary) => {
  const token = await login({
    label: 'customer',
    email: process.env.SMOKE_CUSTOMER_EMAIL,
    password: process.env.SMOKE_CUSTOMER_PASSWORD,
  });

  if (!token) {
    summary.customer = 'skipped: set SMOKE_CUSTOMER_EMAIL and SMOKE_CUSTOMER_PASSWORD';
    return;
  }

  const profile = await expectStatus('customer profile', { path: '/api/auth/profile', token });
  assert(profile.body?.data?.user?.role === 'customer', 'customer credentials did not resolve to customer role', profile.body);

  await expectStatus('customer loans', { path: '/api/loans?page=1&pageSize=5', token });

  if (process.env.SMOKE_CUSTOMER_LOAN_ID) {
    const loanId = process.env.SMOKE_CUSTOMER_LOAN_ID;
    await expectStatus('customer loan detail', { path: `/api/loans/${loanId}`, token });
    await expectStatus('customer loan calendar', { path: `/api/loans/${loanId}/calendar`, token });
    await expectStatus('customer payoff quote', { path: `/api/loans/${loanId}/payoff-quote?asOfDate=2026-06-01`, token });
  }

  if (process.env.SMOKE_FORBIDDEN_LOAN_ID) {
    await expectStatus('customer forbidden loan detail', {
      path: `/api/loans/${process.env.SMOKE_FORBIDDEN_LOAN_ID}`,
      token,
    }, 403);
  }

  summary.customer = 'authenticated customer read flow passed';
};

const runSocioSmoke = async (summary) => {
  const token = await login({
    label: 'socio',
    email: process.env.SMOKE_SOCIO_EMAIL,
    password: process.env.SMOKE_SOCIO_PASSWORD,
  });

  if (!token) {
    summary.socio = 'skipped: set SMOKE_SOCIO_EMAIL and SMOKE_SOCIO_PASSWORD';
    return;
  }

  const profile = await expectStatus('socio profile', { path: '/api/auth/profile', token });
  assert(profile.body?.data?.user?.role === 'socio', 'socio credentials did not resolve to socio role', profile.body);

  await expectStatus('socio portal', { path: '/api/associates/portal/me', token });
  await expectStatus('socio cannot list payments', { path: '/api/payments?page=1&pageSize=5', token }, 403);

  summary.socio = 'authenticated socio read/guard flow passed';
};

const main = async () => {
  assert(
    isLocalBaseUrl(baseUrl) || allowRemote,
    `Refusing to run smoke against non-local URL ${baseUrl}. Set SMOKE_ALLOW_REMOTE=true only for explicit non-mutating remote checks.`,
  );

  const summary = {
    baseUrl,
    public: {},
  };

  await runPublicSmoke(summary);
  await runAdminSmoke(summary);
  await runCustomerSmoke(summary);
  await runSocioSmoke(summary);

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error.message);
  if (error.details) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exitCode = 1;
});
