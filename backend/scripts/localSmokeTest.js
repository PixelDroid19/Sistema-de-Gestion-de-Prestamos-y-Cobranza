require('dotenv').config({ quiet: true });

const http = require('node:http');
const https = require('node:https');

const DEFAULT_BASE_URL = 'http://127.0.0.1:5000';
const baseUrl = String(process.env.SMOKE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const allowRemote = process.env.SMOKE_ALLOW_REMOTE === 'true';
const smokeOrigin = String(process.env.SMOKE_ORIGIN || '').trim();
const requestTimeoutRaw = process.env.SMOKE_TIMEOUT_MS || '15000';
const parsePositiveInteger = (value, label) => {
  const normalized = String(value || '').trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(`${label} must be a positive integer.`);
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
};
let requestTimeoutMs = null;

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

  if (smokeOrigin) {
    requestHeaders.origin = smokeOrigin;
  }

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
  req.setTimeout(requestTimeoutMs, () => {
    req.destroy(new Error(`${method} ${url.pathname} timed out after ${requestTimeoutMs}ms`));
  });

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
  if (smokeOrigin) {
    const corsOrigin = response.headers['access-control-allow-origin'];
    assert(
      corsOrigin === smokeOrigin,
      `${label} did not echo SMOKE_ORIGIN in Access-Control-Allow-Origin`,
      { expectedOrigin: smokeOrigin, receivedOrigin: corsOrigin || null },
    );
  }
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

const expectLoginRejected = async ({ email, password, label }) => {
  if (!email || !password) {
    return 'skipped';
  }

  const response = await expectStatus(`${label} login rejected`, {
    method: 'POST',
    path: '/api/auth/login',
    body: { email, password },
  }, 401);

  assert(!response.body?.data?.accessToken, `${label} unexpectedly received an access token`, response.body);
  return 'rejected';
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
  await expectStatus('permissions catalog', { path: '/api/permissions', token });
  await expectStatus('audit stats', { path: '/api/audits/stats', token });
  await expectStatus('reports dashboard', { path: '/api/reports/dashboard', token });
  await expectStatus('payments list', { path: '/api/payments?page=1&pageSize=5', token });

  summary.admin = 'authenticated core modules passed';
};

const runEmployeeSmoke = async (summary) => {
  const token = await login({
    label: 'employee',
    email: process.env.SMOKE_EMPLOYEE_EMAIL,
    password: process.env.SMOKE_EMPLOYEE_PASSWORD,
  });

  if (!token) {
    summary.employee = 'skipped: set SMOKE_EMPLOYEE_EMAIL and SMOKE_EMPLOYEE_PASSWORD';
    return;
  }

  const profile = await expectStatus('employee profile', { path: '/api/auth/profile', token });
  assert(profile.body?.data?.user?.role === 'employee', 'employee credentials did not resolve to employee role', profile.body);
  await expectStatus('employee permissions', { path: '/api/permissions/me', token });
  await expectStatus('employee config denied', { path: '/api/config/payment-methods', token }, 403);
  await expectStatus('employee audit denied', { path: '/api/audits/stats', token }, 403);
  await expectStatus('employee reports denied', { path: '/api/reports/dashboard', token }, 403);
  await expectStatus('employee payments denied', { path: '/api/payments?page=1&pageSize=5', token }, 403);
  await expectStatus('employee loans denied', { path: '/api/loans?page=1&pageSize=5', token }, 403);

  summary.employee = 'authenticated limited backoffice flow and guard denials passed';
};

const runRetiredLoginSmoke = async (summary) => {
  const customer = await expectLoginRejected({
    label: 'customer domain record',
    email: process.env.SMOKE_CUSTOMER_EMAIL,
    password: process.env.SMOKE_CUSTOMER_PASSWORD,
  });
  const socio = await expectLoginRejected({
    label: 'socio investor record',
    email: process.env.SMOKE_SOCIO_EMAIL,
    password: process.env.SMOKE_SOCIO_PASSWORD,
  });

  summary.retiredLogins = {
    customer: customer === 'skipped' ? 'skipped: set SMOKE_CUSTOMER_EMAIL and SMOKE_CUSTOMER_PASSWORD' : 'rejected as domain-only record',
    socio: socio === 'skipped' ? 'skipped: set SMOKE_SOCIO_EMAIL and SMOKE_SOCIO_PASSWORD' : 'rejected as domain-only record',
  };
};

const main = async () => {
  assert(
    isLocalBaseUrl(baseUrl) || allowRemote,
    `Refusing to run smoke against non-local URL ${baseUrl}. Set SMOKE_ALLOW_REMOTE=true only for explicit non-mutating remote checks.`,
  );
  assert(
    isLocalBaseUrl(baseUrl) || smokeOrigin,
    'SMOKE_ORIGIN is required for remote smoke checks so production CORS is exercised with an allowed frontend origin.',
  );
  requestTimeoutMs = parsePositiveInteger(requestTimeoutRaw, 'SMOKE_TIMEOUT_MS');

  const summary = {
    baseUrl,
    origin: smokeOrigin || 'not sent',
    timeoutMs: requestTimeoutMs,
    public: {},
  };

  await runPublicSmoke(summary);
  await runAdminSmoke(summary);
  await runEmployeeSmoke(summary);
  await runRetiredLoginSmoke(summary);

  console.log(JSON.stringify(summary, null, 2));
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    if (error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_BASE_URL,
  isLocalBaseUrl,
  main,
  parsePositiveInteger,
};
