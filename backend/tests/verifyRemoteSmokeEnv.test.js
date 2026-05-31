const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const smokeEnvScript = path.join(repoRoot, 'scripts/verifyRemoteSmokeEnv.js');

const runRemoteSmokeEnvCheck = (envOverrides = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [smokeEnvScript], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SMOKE_API_BASE_URL: 'https://backend.example.test',
      SMOKE_ORIGIN: 'https://frontend.example.test',
      SMOKE_ADMIN_EMAIL: 'admin@example.test',
      SMOKE_ADMIN_PASSWORD: 'Admin123!',
      SMOKE_EMPLOYEE_EMAIL: 'employee@example.test',
      SMOKE_EMPLOYEE_PASSWORD: 'Admin123!',
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

test('remote smoke preflight rejects non-integer timeout values', async () => {
  const result = await runRemoteSmokeEnvCheck({
    SMOKE_TIMEOUT_MS: '15000ms',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SMOKE_TIMEOUT_MS must be a positive integer/);
});
