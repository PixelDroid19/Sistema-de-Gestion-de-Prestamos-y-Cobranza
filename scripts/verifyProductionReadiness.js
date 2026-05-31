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
const remoteSmokeEnv = read('scripts/verifyRemoteSmokeEnv.js');
const browserSmoke = read('scripts/localBrowserSmoke.js');
const resetProductionQaDataset = read('backend/scripts/resetProductionQaDataset.js');
const resetQaCredentialsScript = read('backend/scripts/resetQaCredentials.js');
const resetLocalDbScript = read('backend/scripts/resetLocalDb.js');
const clearRateLimitScript = read('backend/scripts/clear-rate.js');
const repairCapitalPaymentSchedulesScript = read('backend/scripts/repairCapitalPaymentSchedules.js');
const migrateLoansToProductsScript = read('backend/src/scripts/migrateLoansToProducts.js');
const migrateToAliasScript = read('backend/scripts/migrateToAlias.js');
const frontendRuntimeConfig = read('frontend/scripts/write-runtime-config.sh');
const frontendApiClient = read('frontend/src/api/client.ts');
const readme = read('README.md');
const setupGuide = read('setup.md');
const associateTrainingGuide = read('docs/training/notifications-profile-associates.md');

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
  packageJson.scripts?.['smoke:browser:local'] === 'node scripts/localBrowserSmoke.js',
  'package.json must expose the local browser smoke command',
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
    && resetProductionQaDataset.includes('DB_SCHEMA_RESET_ALLOWED')
    && resetProductionQaDataset.includes('require.main === module'),
  'destructive QA dataset reset must keep explicit confirmation, schema reset guard, and import-safe CLI mode',
);
assert(
  resetQaCredentialsScript.includes('RESET_QA_CREDENTIALS_CONFIRM')
    && resetQaCredentialsScript.includes('RESET_RAILWAY_QA_CREDENTIALS')
    && resetQaCredentialsScript.includes('require.main === module'),
  'QA credential reset must keep explicit confirmation and import-safe CLI mode',
);
assert(
  resetLocalDbScript.includes('RESET_LOCAL_DB_ALLOW_NONLOCAL')
    && resetLocalDbScript.includes('RESET_LOCAL_DB_CONFIRM')
    && resetLocalDbScript.includes('assertLocalDatabaseTarget();')
    && resetLocalDbScript.includes('require.main === module'),
  'local database reset must refuse non-local hosts by default and stay import-safe',
);
assert(
  clearRateLimitScript.includes('CLEAR_AUTH_RATE_LIMIT_CONFIRM')
    && clearRateLimitScript.includes('CLEAR_AUTH_RATE_LIMIT')
    && clearRateLimitScript.includes('require.main === module'),
  'auth rate-limit clearing script must require explicit confirmation and stay import-safe',
);
assert(
  repairCapitalPaymentSchedulesScript.includes('REPAIR_CAPITAL_PAYMENT_SCHEDULES_CONFIRM')
    && repairCapitalPaymentSchedulesScript.includes('REPAIR_CAPITAL_PAYMENT_SCHEDULES')
    && repairCapitalPaymentSchedulesScript.includes('assertApplyConfirmed({ apply })')
    && repairCapitalPaymentSchedulesScript.includes('require.main === module'),
  'capital payment repair script must guard --apply mode and stay import-safe',
);
assert(
  migrateLoansToProductsScript.includes('MIGRATE_LOANS_TO_PRODUCTS_CONFIRM')
    && migrateLoansToProductsScript.includes('MIGRATE_LOANS_TO_PRODUCTS')
    && migrateLoansToProductsScript.includes('assertConfirmed();')
    && migrateLoansToProductsScript.includes('require.main === module'),
  'loan product migration script must require explicit confirmation in CLI mode',
);
assert(
  migrateToAliasScript.includes('require.main === module')
    && migrateToAliasScript.includes('module.exports'),
  'module-alias migration utility must stay import-safe',
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
assert(backendSmoke.includes('require.main === module'), 'local API smoke must stay import-safe');
assert(remoteSmokeEnv.includes('require.main === module'), 'remote smoke preflight must stay import-safe');
assert(browserSmoke.includes('agent-browser'), 'local browser smoke must use the agent-browser CLI');
assert(browserSmoke.includes('BROWSER_SMOKE_DRY_RUN'), 'local browser smoke must support dry-run mode');
assert(browserSmoke.includes('BROWSER_SMOKE_ARTIFACT_DIR'), 'local browser smoke must support failure artifact configuration');
assert(browserSmoke.includes('BROWSER_SMOKE_ALLOW_REMOTE'), 'local browser smoke must guard non-local URLs');
assert(browserSmoke.includes('BROWSER_SMOKE_VIEWPORT'), 'local browser smoke must support explicit responsive viewport checks');
assert(browserSmoke.includes('BROWSER_SMOKE_CHECK_ERRORS'), 'local browser smoke must support browser page error checks');
assert(browserSmoke.includes('BROWSER_SMOKE_CHECK_A11Y'), 'local browser smoke must support lightweight accessibility checks');
assert(browserSmoke.includes('BROWSER_SMOKE_INCLUDE_ADMIN_ROUTES'), 'local browser smoke must support main admin route shell checks');
assert(browserSmoke.includes('DEFAULT_TIMEOUT_MS = 30000'), 'local browser smoke must keep a 30 second default step timeout');
assert(frontendRuntimeConfig.includes('with_api_path'), 'runtime config must append /api to backend origins');
assert(frontendRuntimeConfig.includes('reject_api_path_env'), 'runtime config must reject VITE_API_URL values that include /api');
assert(frontendRuntimeConfig.includes('RAILWAY_SERVICE_BACKEND_URL'), 'runtime config must support Railway backend URL');
assert(frontendApiClient.includes('appendApiPath'), 'frontend API client must append /api to VITE_API_URL origins');
assert(readme.includes('SMOKE_ORIGIN='), 'README must document SMOKE_ORIGIN for remote smoke');
assert(readme.includes('npm run smoke:remote:check'), 'README must document the remote smoke preflight');
assert(readme.includes('smoke API local') && readme.includes('denegaciones 403'), 'README must document local API smoke employee denials');
assert(readme.includes('npm run smoke:browser:local'), 'README must document the local browser smoke');
assert(readme.includes('BROWSER_SMOKE_DRY_RUN=true'), 'README must document browser smoke dry-run mode');
assert(readme.includes('artifacts/browser-smoke'), 'README must document browser smoke failure artifacts');
assert(readme.includes('BROWSER_SMOKE_INCLUDE_ADMIN_ROUTES'), 'README must document browser smoke main admin route checks');
assert(readme.includes('BROWSER_SMOKE_INCLUDE_NEW_CREDIT'), 'README must document browser smoke new credit check');
assert(readme.includes('BROWSER_SMOKE_INCLUDE_SETTINGS'), 'README must document browser smoke settings check');
assert(readme.includes('BROWSER_SMOKE_INCLUDE_EMPLOYEE_GUARDS'), 'README must document browser smoke employee guard checks');
assert(readme.includes('BROWSER_SMOKE_VIEWPORT=390x844'), 'README must document browser smoke responsive viewport checks');
assert(readme.includes('BROWSER_SMOKE_CHECK_ERRORS=true'), 'README must document browser smoke page error checks');
assert(readme.includes('BROWSER_SMOKE_CHECK_A11Y=true'), 'README must document browser smoke accessibility checks');
assert(readme.includes('`BROWSER_SMOKE_TIMEOUT_MS`: timeout por paso, por defecto `30000`.'), 'README must document the browser smoke default timeout');
assert(setupGuide.includes('Roles de login administrativos: `admin`, `employee`.'), 'setup guide must document only administrative login roles');
assert(!setupGuide.includes('Roles validos: `admin`, `customer`, `socio`.'), 'setup guide must not document customer/socio login roles');
assert(!setupGuide.includes('grafo DAG'), 'setup guide must not describe retired DAG setup as current behavior');
assert(associateTrainingGuide.includes('detalle administrativo del socio'), 'associate training guide must describe administrative associate details');
assert(!/portal del socio/i.test(associateTrainingGuide), 'associate training guide must not reference a socio portal');
assert(
  readme.includes('VITE_API_URL')
    && readme.includes('origen del backend')
    && readme.includes('agrega `/api`'),
  'README must document VITE_API_URL as backend origin',
);

const syntaxCheckedScripts = [
  'scripts/verifyProductionReadiness.js',
  'scripts/verifyRemoteSmokeEnv.js',
  'scripts/localBrowserSmoke.js',
  'backend/scripts/localSmokeTest.js',
  'backend/scripts/resetQaCredentials.js',
  'backend/scripts/resetLocalDb.js',
  'backend/scripts/resetProductionQaDataset.js',
  'backend/scripts/migrateToAlias.js',
  'backend/scripts/clear-rate.js',
  'backend/scripts/repairCapitalPaymentSchedules.js',
  'backend/scripts/railwayCreditSmokeTest.js',
  'backend/scripts/payoffSmokeTest.js',
  'backend/scripts/seedAssociatePortalData.js',
  'backend/src/scripts/migrateLoansToProducts.js',
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
