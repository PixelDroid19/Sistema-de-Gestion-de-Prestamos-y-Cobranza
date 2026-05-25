const REQUIRED_KEYS = [
  'SMOKE_API_BASE_URL',
  'SMOKE_ORIGIN',
  'SMOKE_ADMIN_EMAIL',
  'SMOKE_ADMIN_PASSWORD',
  'SMOKE_EMPLOYEE_EMAIL',
  'SMOKE_EMPLOYEE_PASSWORD',
];

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const readEnv = (key) => String(process.env[key] || '').trim();

const parseUrl = (key) => {
  const value = readEnv(key);
  assert(value, `${key} is required for remote smoke verification.`);

  try {
    return new URL(value);
  } catch (_error) {
    throw new Error(`${key} must be a valid URL.`);
  }
};

const isLocalHost = (hostname) => ['localhost', '127.0.0.1', '::1'].includes(hostname);

const main = () => {
  for (const key of REQUIRED_KEYS) {
    assert(readEnv(key), `${key} is required for remote smoke verification.`);
  }

  const apiUrl = parseUrl('SMOKE_API_BASE_URL');
  const originUrl = parseUrl('SMOKE_ORIGIN');

  assert(apiUrl.protocol === 'https:', 'SMOKE_API_BASE_URL must use https for production smoke checks.');
  assert(originUrl.protocol === 'https:', 'SMOKE_ORIGIN must use https for production smoke checks.');
  assert(!isLocalHost(apiUrl.hostname), 'SMOKE_API_BASE_URL must point to a remote backend, not localhost.');
  assert(!isLocalHost(originUrl.hostname), 'SMOKE_ORIGIN must point to a remote frontend, not localhost.');
  assert(!apiUrl.pathname.replace(/\/+$/, '').endsWith('/api'), 'SMOKE_API_BASE_URL must be the backend origin, without /api.');
  assert(originUrl.pathname === '/' || originUrl.pathname === '', 'SMOKE_ORIGIN must be a frontend origin without a path.');
  assert(apiUrl.origin !== originUrl.origin, 'SMOKE_API_BASE_URL and SMOKE_ORIGIN should point to backend and frontend origins respectively.');

  const timeoutRaw = readEnv('SMOKE_TIMEOUT_MS');
  if (timeoutRaw) {
    const timeoutMs = Number.parseInt(timeoutRaw, 10);
    assert(Number.isInteger(timeoutMs) && timeoutMs > 0, 'SMOKE_TIMEOUT_MS must be a positive integer when provided.');
  }

  console.log(JSON.stringify({
    status: 'ready',
    baseUrl: apiUrl.origin,
    origin: originUrl.origin,
    timeoutMs: timeoutRaw || 'default',
  }, null, 2));
};

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
