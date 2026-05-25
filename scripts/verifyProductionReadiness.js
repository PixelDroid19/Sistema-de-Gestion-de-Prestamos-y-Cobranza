const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const os = require('node:os');

const rootDir = path.resolve(__dirname, '..');

const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const renderYaml = read('render.yaml');
const packageJson = JSON.parse(read('package.json'));
const backendPackageJson = JSON.parse(read('backend/package.json'));
const backendDockerfile = read('backend/Dockerfile');
const backendSmoke = read('backend/scripts/localSmokeTest.js');
const resetProductionQaDataset = read('backend/scripts/resetProductionQaDataset.js');
const frontendRuntimeConfig = read('frontend/scripts/write-runtime-config.sh');
const frontendApiClient = read('frontend/src/api/client.ts');
const readme = read('README.md');

const forbiddenRenderKeys = ['DATABASE_URL', 'CORS_ORIGIN'];
for (const key of forbiddenRenderKeys) {
  assert(!renderYaml.includes(`key: ${key}`), `render.yaml must not declare obsolete ${key}`);
}

const requiredBackendEnvKeys = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DB_SCHEMA_MODE',
  'ALLOWED_ORIGINS',
  'JWT_SECRET',
];

for (const key of requiredBackendEnvKeys) {
  assert(renderYaml.includes(`key: ${key}`), `render.yaml is missing backend env ${key}`);
}

assert(
  /key:\s+DB_SCHEMA_MODE\s+value:\s+verify/s.test(renderYaml),
  'render.yaml must set DB_SCHEMA_MODE=verify for production deploys',
);
assert(
  /key:\s+JWT_SECRET\s+generateValue:\s+true/s.test(renderYaml),
  'render.yaml must generate JWT_SECRET instead of hardcoding it',
);
assert(
  /key:\s+VITE_API_URL\s+value:\s+https:\/\/[^/\s]+/s.test(renderYaml),
  'render.yaml frontend VITE_API_URL must be a backend origin',
);
assert(
  !/key:\s+VITE_API_URL\s+value:\s+https:\/\/[^ \n]+\/api\b/s.test(renderYaml),
  'render.yaml frontend VITE_API_URL must not include /api',
);

assert(
  packageJson.scripts?.['smoke:remote'] === 'cd backend && SMOKE_ALLOW_REMOTE=true npm run smoke:local',
  'package.json must expose the non-mutating smoke:remote command',
);
assert(
  packageJson.scripts?.['smoke:remote:check'] === 'node scripts/verifyRemoteSmokeEnv.js',
  'package.json must expose the remote smoke environment preflight command',
);
assert(
  packageJson.scripts?.['verify:release'] === 'npm run verify:production && npm run lint && npm run test && cd frontend && npm run build',
  'package.json must expose the full local release verification command',
);
assert(
  !Object.values(packageJson.scripts || {}).some((script) => String(script).includes('resetProductionQaDataset')),
  'root package scripts must not expose the destructive production QA reset',
);
assert(
  backendPackageJson.scripts?.test === 'NODE_ENV=test node --require module-alias/register --test',
  'backend/package.json test script must use the POSIX module-alias command',
);
assert(
  resetProductionQaDataset.includes('RESET_PRODUCTION_QA_DATASET_CONFIRM')
    && resetProductionQaDataset.includes('RESET_RAILWAY_QA_DATASET')
    && resetProductionQaDataset.includes('DB_SCHEMA_RESET_ALLOWED'),
  'destructive QA dataset reset must keep explicit confirmation and schema reset guard',
);
assert(
  backendDockerfile.includes('process.env.PORT || 5000')
    && backendDockerfile.includes('localhost:${port}/health')
    && backendDockerfile.includes(".on('error', () => process.exit(1))"),
  'backend Docker healthcheck must use PORT and fail on connection errors',
);
assert(backendSmoke.includes('SMOKE_ORIGIN'), 'remote smoke must support SMOKE_ORIGIN');
assert(backendSmoke.includes('requestHeaders.origin'), 'remote smoke must send Origin when configured');
assert(backendSmoke.includes('access-control-allow-origin'), 'remote smoke must assert the CORS allow-origin response header');
assert(backendSmoke.includes('SMOKE_ORIGIN is required for remote smoke checks'), 'remote smoke must require SMOKE_ORIGIN for remote URLs');
assert(backendSmoke.includes('SMOKE_TIMEOUT_MS'), 'remote smoke must expose a request timeout override');
assert(backendSmoke.includes('req.setTimeout'), 'remote smoke must enforce HTTP request timeouts');
assert(frontendRuntimeConfig.includes('with_api_path'), 'runtime config must append /api to backend origins');
assert(frontendRuntimeConfig.includes('reject_api_path_env'), 'runtime config must reject VITE_API_URL values that include /api');
assert(frontendRuntimeConfig.includes('RAILWAY_SERVICE_BACKEND_URL'), 'runtime config must support Railway backend URL');
assert(frontendApiClient.includes('appendApiPath'), 'frontend API client must append /api to VITE_API_URL origins');
assert(readme.includes('SMOKE_ORIGIN='), 'README must document SMOKE_ORIGIN for remote smoke');
assert(readme.includes('npm run smoke:remote:check'), 'README must document the remote smoke preflight');
assert(
  readme.includes('VITE_API_URL')
    && readme.includes('origen del backend')
    && readme.includes('agrega `/api`'),
  'README must document VITE_API_URL as backend origin',
);

const syntaxCheckedScripts = [
  'scripts/verifyProductionReadiness.js',
  'scripts/verifyRemoteSmokeEnv.js',
  'backend/scripts/localSmokeTest.js',
  'backend/scripts/resetQaCredentials.js',
  'backend/scripts/resetLocalDb.js',
  'backend/scripts/resetProductionQaDataset.js',
  'backend/scripts/railwayCreditSmokeTest.js',
];

for (const relativePath of syntaxCheckedScripts) {
  const result = spawnSync(process.execPath, ['--check', path.join(rootDir, relativePath)], {
    encoding: 'utf8',
  });
  assert(
    result.status === 0,
    `${relativePath} failed node --check:\n${result.stderr || result.stdout}`,
  );
}

const runRuntimeConfigScript = (envOverrides) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'credicobranza-runtime-'));
  const result = spawnSync('sh', [path.join(rootDir, 'frontend/scripts/write-runtime-config.sh'), outputDir], {
    cwd: rootDir,
    env: {
      ...process.env,
      VITE_API_URL: '',
      VITE_API_BASE_URL: '',
      RAILWAY_SERVICE_BACKEND_URL: '',
      ...envOverrides,
    },
    encoding: 'utf8',
  });

  return { outputDir, result };
};

{
  const { outputDir, result } = runRuntimeConfigScript({
    VITE_API_URL: 'https://backend-production-4d24.up.railway.app/',
  });
  assert(
    result.status === 0,
    `runtime config generation failed for VITE_API_URL origin:\n${result.stderr || result.stdout}`,
  );
  assert(
    fs.readFileSync(path.join(outputDir, 'runtime-config.js'), 'utf8').includes('"https://backend-production-4d24.up.railway.app/api"'),
    'runtime config must append /api to a VITE_API_URL backend origin',
  );
}

{
  const { result } = runRuntimeConfigScript({
    VITE_API_URL: 'https://backend-production-4d24.up.railway.app/api',
  });
  assert(
    result.status !== 0 && result.stderr.includes('VITE_API_URL must be the backend origin, without /api'),
    'runtime config must reject VITE_API_URL values that include /api',
  );
}

console.log('Production readiness contracts verified.');
