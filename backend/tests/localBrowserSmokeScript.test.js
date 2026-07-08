const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const {
  buildAccessibilityAuditStep,
  buildButtonDisabledWaitStep,
  buildFailureScreenshotStep,
  buildBrowserSmokeSteps,
  formatAccessibilityViolations,
  parseAccessibilityAuditResult,
  resolveBrowserSmokeConfig,
  renderStepForLog,
  runBrowserSmoke,
} = require(path.join(repoRoot, 'scripts/localBrowserSmoke'));

test('local browser smoke defaults to the non-destructive local admin login flow', () => {
  const config = resolveBrowserSmokeConfig({});
  const steps = buildBrowserSmokeSteps(config);
  const commands = steps.map((step) => [step.command, ...step.args].join(' '));

  assert.equal(config.frontendUrl, 'http://127.0.0.1:3000');
  assert.equal(config.adminEmail, 'qa.admin.20260427@test.local');
  assert.equal(config.timeoutMs, 30000);
  assert.equal(config.dryRun, false);

  assert.deepEqual(commands.slice(0, 2), [
    'open http://127.0.0.1:3000/login',
    'wait --load networkidle',
  ]);
  assert.deepEqual(commands.slice(2, 5), [
    'storage session clear',
    'open http://127.0.0.1:3000/login',
    'wait --load networkidle',
  ]);
  assert(commands.includes('find label Correo electrónico fill qa.admin.20260427@test.local'));
  assert(commands.includes('find label Contraseña fill Admin123!'));
  assert(commands.includes('find role button click --name Iniciar sesión'));
  assert(commands.some((command) => (
    command.startsWith('wait --fn')
    && command.includes('window.location.pathname ===')
    && command.includes('/dashboard')
    && command.includes('No se pudo iniciar sesión')
  )));
  assert(commands.some((command) => (
    command.startsWith('eval ')
    && command.includes('Check local backend/proxy availability and QA credentials')
  )));
  assert(commands.includes('wait --text Dashboard'));
  assert(commands.includes('get url'));
  assert.equal(steps[steps.length - 1].command, 'close');
});

test('local browser smoke can include the main administrative route shell', () => {
  const config = resolveBrowserSmokeConfig({ BROWSER_SMOKE_INCLUDE_ADMIN_ROUTES: 'true' });
  const steps = buildBrowserSmokeSteps(config);
  const commands = steps.map((step) => [step.command, ...step.args].join(' '));

  assert.equal(config.includeAdminRoutes, true);
  assert(commands.includes('open http://127.0.0.1:3000/dashboard'));
  assert(commands.includes('open http://127.0.0.1:3000/customers'));
  assert(commands.includes('open http://127.0.0.1:3000/credits'));
  assert(commands.includes('open http://127.0.0.1:3000/credit-calculator'));
  assert(commands.includes('open http://127.0.0.1:3000/associates'));
  assert(commands.includes('open http://127.0.0.1:3000/payouts'));
  assert(commands.includes('open http://127.0.0.1:3000/notifications'));
  assert(commands.includes('open http://127.0.0.1:3000/audit-log'));
  assert(commands.includes('open http://127.0.0.1:3000/profile'));
  assert(commands.includes('wait --text Configuración operativa'));
});

test('local browser smoke can include a reports cashflow verification segment', () => {
  const config = resolveBrowserSmokeConfig({ BROWSER_SMOKE_INCLUDE_REPORTS: 'true' });
  const steps = buildBrowserSmokeSteps(config);
  const commands = steps.map((step) => [step.command, ...step.args].join(' '));

  assert(commands.includes('open http://127.0.0.1:3000/reports'));
  assert(commands.includes('wait --text Reportes operativos'));
  assert(commands.includes('find role tab click --name Cierre contable'));
  assert(commands.includes('wait --text Cierre contable mensual'));
  assert.equal(steps[steps.length - 1].command, 'close');
});

test('local browser smoke can include a settings payment methods verification segment', () => {
  const config = resolveBrowserSmokeConfig({ BROWSER_SMOKE_INCLUDE_SETTINGS: 'true' });
  const steps = buildBrowserSmokeSteps(config);
  const commands = steps.map((step) => [step.command, ...step.args].join(' '));

  assert.equal(config.includeSettings, true);
  assert(commands.includes('open http://127.0.0.1:3000/settings'));
  assert(commands.includes('wait --text Configuración operativa'));
  assert(commands.includes('find role tab click --name Métodos de pago'));
  assert(commands.includes('wait --text Métodos disponibles'));
  assert(commands.includes('find role button click --name Crear método'));
  assert(commands.includes('wait --text Nuevo método de pago'));
  assert(commands.includes('find role button click --name Cancelar'));
  assert.equal(steps[steps.length - 1].command, 'close');
});

test('local browser smoke can include a new credit screen verification segment', () => {
  const config = resolveBrowserSmokeConfig({ BROWSER_SMOKE_INCLUDE_NEW_CREDIT: 'true' });
  const steps = buildBrowserSmokeSteps(config);
  const commands = steps.map((step) => [step.command, ...step.args].join(' '));

  assert.equal(config.includeNewCredit, true);
  assert(commands.includes('open http://127.0.0.1:3000/credits/new'));
  assert(commands.includes('wait --text Nuevo crédito'));
  assert(commands.includes('wait --text Parámetros'));
  assert(commands.includes('wait --text Cliente'));
  assert(commands.includes('wait --text Monto del crédito'));
  assert(commands.some((command) => (
    command.startsWith('wait --fn')
    && command.includes('aria-label')
    && command.includes('Validar crédito')
  )));
  assert(commands.some((command) => (
    command.startsWith('wait --fn')
    && command.includes('aria-label')
    && command.includes('Registrar crédito')
  )));
  const disabledStep = buildButtonDisabledWaitStep('Registrar crédito');
  assert.equal(disabledStep.command, 'wait');
  assert.equal(disabledStep.args[0], '--fn');
  assert(disabledStep.args[1].includes('button.disabled === true'));
  assert(commands.some((command) => (
    command.startsWith('wait --fn')
    && command.includes('button.disabled === true')
    && command.includes('Registrar crédito')
  )));
  assert(!commands.includes('wait --text Registrar crédito'));
  assert(commands.includes('wait --text Aún no hay cálculo generado'));
  assert.equal(steps[steps.length - 1].command, 'close');
});

test('local browser smoke can verify employee route guards after the admin flow', () => {
  const config = resolveBrowserSmokeConfig({ BROWSER_SMOKE_INCLUDE_EMPLOYEE_GUARDS: 'true' });
  const steps = buildBrowserSmokeSteps(config);
  const commands = steps.map((step) => [step.command, ...step.args].join(' '));

  assert.equal(config.employeeEmail, 'qa.employee.20260427@test.local');
  assert.equal(config.includeEmployeeGuards, true);

  assert(commands.includes('find role button click --name Cerrar sesión'));
  assert(commands.includes("wait --fn window.location.pathname === '/login'"));
  assert(commands.includes('find label Correo electrónico fill qa.employee.20260427@test.local'));
  assert(commands.includes('find label Contraseña fill Admin123!'));
  assert(commands.includes("wait --fn window.location.pathname === '/profile'"));
  assert(commands.includes('wait --text Mi perfil'));
  assert(commands.includes('open http://127.0.0.1:3000/settings'));
  const firstGuardedOpenIndex = commands.indexOf('open http://127.0.0.1:3000/settings');
  assert.equal(commands[firstGuardedOpenIndex + 1], 'wait --load networkidle');
  assert.equal(commands[firstGuardedOpenIndex + 2], "wait --fn window.location.pathname === '/profile'");
  assert(commands.includes('open http://127.0.0.1:3000/dashboard'));
  assert(commands.includes('open http://127.0.0.1:3000/reports'));
  assert(commands.includes('open http://127.0.0.1:3000/credits/new'));
  assert(commands.includes('open http://127.0.0.1:3000/customers'));
  assert(commands.includes('open http://127.0.0.1:3000/payouts'));
  assert(commands.includes('open http://127.0.0.1:3000/associates'));
  assert(commands.includes('open http://127.0.0.1:3000/audit-log'));
  assert(commands.includes('open http://127.0.0.1:3000/credit-calculator'));
  assert.equal(steps[steps.length - 1].command, 'close');
});

test('local browser smoke opens the mobile sidebar before logging out in responsive runs', () => {
  const config = resolveBrowserSmokeConfig({
    BROWSER_SMOKE_INCLUDE_EMPLOYEE_GUARDS: 'true',
    BROWSER_SMOKE_VIEWPORT: '390x844',
  });
  const commands = buildBrowserSmokeSteps(config).map((step) => [step.command, ...step.args].join(' '));

  const openMenuIndex = commands.indexOf('find role button click --name Abrir menú');
  const logoutIndex = commands.indexOf('find role button click --name Cerrar sesión');

  assert(openMenuIndex >= 0, 'expected mobile smoke to open the drawer before logout');
  assert(logoutIndex > openMenuIndex, 'expected logout to run after opening the mobile drawer');
});

test('local browser smoke refuses remote URLs unless explicitly allowed', () => {
  assert.throws(
    () => resolveBrowserSmokeConfig({
      BROWSER_SMOKE_FRONTEND_URL: 'https://frontend-production-3058.up.railway.app',
    }),
    /Refusing to run browser smoke against non-local URL/,
  );

  const config = resolveBrowserSmokeConfig({
    BROWSER_SMOKE_FRONTEND_URL: 'https://frontend-production-3058.up.railway.app',
    BROWSER_SMOKE_ALLOW_REMOTE: 'true',
  });

  assert.equal(config.frontendUrl, 'https://frontend-production-3058.up.railway.app');
});

test('local browser smoke validates timeout and supports dry-run mode', () => {
  assert.throws(
    () => resolveBrowserSmokeConfig({ BROWSER_SMOKE_TIMEOUT_MS: '0' }),
    /BROWSER_SMOKE_TIMEOUT_MS must be a positive integer/,
  );
  assert.throws(
    () => resolveBrowserSmokeConfig({ BROWSER_SMOKE_TIMEOUT_MS: '15000ms' }),
    /BROWSER_SMOKE_TIMEOUT_MS must be a positive integer/,
  );

  const config = resolveBrowserSmokeConfig({ BROWSER_SMOKE_DRY_RUN: 'true' });

  assert.equal(config.dryRun, true);
});

test('local browser smoke can include browser page error checks', () => {
  const config = resolveBrowserSmokeConfig({ BROWSER_SMOKE_CHECK_ERRORS: 'true' });
  const steps = buildBrowserSmokeSteps(config);
  const commands = steps.map((step) => renderStepForLog(step));

  assert.equal(config.checkBrowserErrors, true);
  assert.equal(commands[0], 'agent-browser --json errors --clear');
  assert.equal(commands[commands.length - 2], 'agent-browser --json errors');
  assert.equal(commands[commands.length - 1], 'agent-browser close');
});

test('local browser smoke can include lightweight accessibility audits', () => {
  const config = resolveBrowserSmokeConfig({
    BROWSER_SMOKE_CHECK_A11Y: 'true',
    BROWSER_SMOKE_INCLUDE_NEW_CREDIT: 'true',
  });
  const steps = buildBrowserSmokeSteps(config);
  const commands = steps.map((step) => renderStepForLog(step));

  assert.equal(config.checkAccessibility, true);
  assert.deepEqual(buildAccessibilityAuditStep('Dashboard'), {
    command: 'accessibility-audit',
    args: ['Dashboard'],
  });
  assert(commands.includes('agent-browser press Tab'));
  assert(commands.includes('agent-browser eval [accessibility audit: Dashboard]'));
  assert(commands.includes('agent-browser eval [accessibility audit: Nuevo crédito]'));
  assert(commands[commands.length - 1], 'agent-browser close');
});

test('local browser smoke formats accessibility audit violations for failed runs', () => {
  const stdout = JSON.stringify({
    status: 'failed',
    violations: [
      {
        rule: 'missing-accessible-name',
        selector: 'button:nth-of-type(3)',
        message: 'Visible interactive element has no accessible name.',
      },
    ],
  });

  const violations = parseAccessibilityAuditResult(stdout);

  assert.deepEqual(violations, [
    {
      rule: 'missing-accessible-name',
      selector: 'button:nth-of-type(3)',
      message: 'Visible interactive element has no accessible name.',
    },
  ]);
  assert.equal(
    formatAccessibilityViolations(violations),
    'missing-accessible-name at button:nth-of-type(3): Visible interactive element has no accessible name.',
  );
});

test('local browser smoke can run at an explicit responsive viewport', () => {
  assert.throws(
    () => resolveBrowserSmokeConfig({ BROWSER_SMOKE_VIEWPORT: 'mobile' }),
    /BROWSER_SMOKE_VIEWPORT must use WIDTHxHEIGHT format/,
  );
  assert.throws(
    () => resolveBrowserSmokeConfig({ BROWSER_SMOKE_VIEWPORT: '390x0' }),
    /BROWSER_SMOKE_VIEWPORT height must be a positive integer/,
  );

  const config = resolveBrowserSmokeConfig({ BROWSER_SMOKE_VIEWPORT: '390x844' });
  const steps = buildBrowserSmokeSteps(config);

  assert.deepEqual(config.viewport, { width: 390, height: 844 });
  assert.deepEqual(steps[0], {
    command: 'set',
    args: ['viewport', '390', '844'],
  });
  assert.equal(renderStepForLog(steps[0]), 'agent-browser set viewport 390 844');
  assert.equal(steps[1].command, 'open');
  assert.equal(steps[1].args[0], 'http://127.0.0.1:3000/login');
});

test('local browser smoke redacts sensitive step values from logs', () => {
  const [passwordStep] = buildBrowserSmokeSteps(resolveBrowserSmokeConfig({}))
    .filter((step) => step.sensitive);

  assert(passwordStep, 'expected the password fill step to be marked sensitive');
  assert.equal(
    renderStepForLog(passwordStep),
    'agent-browser find label Contraseña fill [redacted]',
  );
});

test('local browser smoke builds ignored failure screenshots for diagnostics', () => {
  const config = resolveBrowserSmokeConfig({});
  const screenshotStep = buildFailureScreenshotStep(config, new Date('2026-05-30T01:02:03.456Z'));

  assert.equal(screenshotStep.command, 'screenshot');
  assert.match(
    screenshotStep.args[0],
    /artifacts\/browser-smoke\/browser-smoke-failure-2026-05-30T01-02-03-456Z\.png$/,
  );
  assert.equal(renderStepForLog(screenshotStep), `agent-browser screenshot ${screenshotStep.args[0]}`);
});

test('local browser smoke closes the browser session after early failures', () => {
  const calls = [];
  const originalConsoleError = console.error;

  try {
    console.error = () => {};
    assert.throws(
      () => runBrowserSmoke(resolveBrowserSmokeConfig({}), (_config, step) => {
        calls.push(step.command);
        if (step.command === 'open') {
          throw new Error('open failed');
        }
      }),
      /open failed/,
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(calls, ['open', 'screenshot', 'close']);
});
