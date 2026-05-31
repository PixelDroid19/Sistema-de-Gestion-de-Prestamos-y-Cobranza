const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const smokeScript = path.join(backendRoot, 'scripts/localSmokeTest.js');

const readJsonBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('error', reject);
  req.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8');
    resolve(text ? JSON.parse(text) : null);
  });
});

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const runSmokeScript = ({ baseUrl, envOverrides = {} }) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [smokeScript], {
    cwd: backendRoot,
    env: {
      ...process.env,
      SMOKE_API_BASE_URL: baseUrl,
      SMOKE_ADMIN_EMAIL: 'admin@example.test',
      SMOKE_ADMIN_PASSWORD: 'Admin123!',
      SMOKE_EMPLOYEE_EMAIL: 'employee@example.test',
      SMOKE_EMPLOYEE_PASSWORD: 'Admin123!',
      SMOKE_CUSTOMER_EMAIL: '',
      SMOKE_CUSTOMER_PASSWORD: '',
      SMOKE_SOCIO_EMAIL: '',
      SMOKE_SOCIO_PASSWORD: '',
      ...envOverrides,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
  child.on('error', reject);
  child.on('close', (status) => {
    resolve({ status, stdout, stderr });
  });
});

test('local API smoke rejects non-integer timeout values', async () => {
  const result = await runSmokeScript({
    baseUrl: 'http://127.0.0.1:1',
    envOverrides: {
      SMOKE_TIMEOUT_MS: '15000ms',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SMOKE_TIMEOUT_MS must be a positive integer/);
  assert.doesNotMatch(result.stderr, /^\s+at /m);
});

test('local API smoke verifies limited employees are denied sensitive surfaces', async () => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    requests.push({ method: req.method, path: `${url.pathname}${url.search}`, token });

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { status: 'success', message: 'ok' });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api') {
      sendJson(res, 200, {
        endpoints: {
          auth: '/api/auth',
          customers: '/api/customers',
          loans: '/api/loans',
          payments: '/api/payments',
          reports: '/api/reports',
          config: '/api/config',
        },
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/docs/openapi.json') {
      sendJson(res, 200, { info: { title: 'CrediCobranza API' }, paths: {} });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readJsonBody(req);
      if (body?.email === 'admin@example.test') {
        sendJson(res, 200, { data: { accessToken: 'admin-token' } });
        return;
      }
      if (body?.email === 'employee@example.test') {
        sendJson(res, 200, { data: { accessToken: 'employee-token' } });
        return;
      }
      sendJson(res, 401, { message: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/profile') {
      sendJson(res, 200, { data: { user: { role: token === 'admin-token' ? 'admin' : 'employee' } } });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/loans/calculations') {
      sendJson(res, 200, {
        data: {
          calculation: {
            method: 'FRENCH',
            schedule: Array.from({ length: 12 }, (_, index) => ({ installmentNumber: index + 1 })),
          },
        },
      });
      return;
    }

    if (token === 'employee-token' && [
      '/api/config/payment-methods',
      '/api/audits/stats',
      '/api/reports/dashboard',
      '/api/payments',
      '/api/loans',
    ].includes(url.pathname)) {
      sendJson(res, 403, { message: 'Forbidden' });
      return;
    }

    sendJson(res, 200, { data: [] });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const result = await runSmokeScript({ baseUrl: `http://127.0.0.1:${port}` });
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);

    const employeeRequests = requests
      .filter((request) => request.token === 'employee-token')
      .map((request) => `${request.method} ${request.path}`);

    assert(employeeRequests.includes('GET /api/config/payment-methods'));
    assert(employeeRequests.includes('GET /api/audits/stats'));
    assert(employeeRequests.includes('GET /api/reports/dashboard'));
    assert(employeeRequests.includes('GET /api/payments?page=1&pageSize=5'));
    assert(employeeRequests.includes('GET /api/loans?page=1&pageSize=5'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
