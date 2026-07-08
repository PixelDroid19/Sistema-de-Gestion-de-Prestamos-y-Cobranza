#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const DEFAULT_FRONTEND_URL = 'http://127.0.0.1:3000';
const DEFAULT_ADMIN_EMAIL = 'qa.admin.20260427@test.local';
const DEFAULT_ADMIN_PASSWORD = 'Admin123!';
const DEFAULT_EMPLOYEE_EMAIL = 'qa.employee.20260427@test.local';
const DEFAULT_EMPLOYEE_PASSWORD = 'Admin123!';
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_ARTIFACT_DIR = path.join(rootDir, 'artifacts', 'browser-smoke');
const MOBILE_VIEWPORT_MAX_WIDTH = 767;
const BROWSER_ERRORS_CLEAR_COMMAND = 'browser-errors-clear';
const BROWSER_ERRORS_ASSERT_COMMAND = 'browser-errors-assert';
const ACCESSIBILITY_AUDIT_COMMAND = 'accessibility-audit';
const DEFAULT_LOGIN_ERROR_TEXT = 'No se pudo iniciar sesión';
const DEFAULT_LOGIN_SUCCESS_PATH = '/dashboard';
const DEFAULT_EMPLOYEE_GUARDED_PATHS = [
  '/settings',
  '/dashboard',
  '/reports',
  '/credits/new',
  '/customers',
  '/payouts',
  '/associates',
  '/audit-log',
  '/credit-calculator',
];

const DEFAULT_ADMIN_ROUTE_CHECKS = [
  { path: '/dashboard', text: 'Dashboard', label: 'Dashboard' },
  { path: '/customers', text: 'Clientes', label: 'Clientes' },
  { path: '/credits', text: 'Operación de créditos', label: 'Créditos' },
  { path: '/credit-calculator', text: 'Cálculo de crédito', label: 'Cálculo de crédito' },
  { path: '/reports', text: 'Reportes operativos', label: 'Reportes' },
  { path: '/associates', text: 'Socios', label: 'Socios' },
  { path: '/payouts', text: 'Pagos y cobranza', label: 'Pagos y cobranza' },
  { path: '/notifications', text: 'Notificaciones', label: 'Notificaciones' },
  { path: '/audit-log', text: 'Auditoría operativa', label: 'Auditoría' },
  { path: '/profile', text: 'Mi perfil', label: 'Perfil' },
  { path: '/settings', text: 'Configuración operativa', label: 'Configuración' },
];

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const isTrue = (value) => value === true || String(value || '').toLowerCase() === 'true';

const stripTrailingSlash = (value) => String(value).replace(/\/+$/, '');

const isLocalUrl = (value) => {
  try {
    const url = new URL(value);
    return LOCAL_HOSTNAMES.has(url.hostname);
  } catch (_error) {
    return false;
  }
};

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

const parseOptionalViewport = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;

  const match = normalized.match(/^(\d+)x(\d+)$/);
  if (!match) {
    throw new Error('BROWSER_SMOKE_VIEWPORT must use WIDTHxHEIGHT format, for example 390x844.');
  }

  return {
    width: parsePositiveInteger(match[1], 'BROWSER_SMOKE_VIEWPORT width'),
    height: parsePositiveInteger(match[2], 'BROWSER_SMOKE_VIEWPORT height'),
  };
};

const resolveBrowserSmokeConfig = (env = process.env, argv = []) => {
  const frontendUrl = stripTrailingSlash(env.BROWSER_SMOKE_FRONTEND_URL || DEFAULT_FRONTEND_URL);
  const allowRemote = isTrue(env.BROWSER_SMOKE_ALLOW_REMOTE);
  const timeoutMs = parsePositiveInteger(env.BROWSER_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS, 'BROWSER_SMOKE_TIMEOUT_MS');

  if (!isLocalUrl(frontendUrl) && !allowRemote) {
    throw new Error(
      `Refusing to run browser smoke against non-local URL ${frontendUrl}. `
      + 'Set BROWSER_SMOKE_ALLOW_REMOTE=true only for explicit non-mutating remote checks.',
    );
  }

  return {
    frontendUrl,
    allowRemote,
    timeoutMs,
    viewport: parseOptionalViewport(env.BROWSER_SMOKE_VIEWPORT),
    checkBrowserErrors: isTrue(env.BROWSER_SMOKE_CHECK_ERRORS),
    checkAccessibility: isTrue(env.BROWSER_SMOKE_CHECK_A11Y),
    dryRun: isTrue(env.BROWSER_SMOKE_DRY_RUN) || argv.includes('--dry-run'),
    agentBrowserBin: env.AGENT_BROWSER_BIN || 'agent-browser',
    artifactDir: env.BROWSER_SMOKE_ARTIFACT_DIR || DEFAULT_ARTIFACT_DIR,
    adminEmail: env.BROWSER_SMOKE_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL,
    adminPassword: env.BROWSER_SMOKE_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
    employeeEmail: env.BROWSER_SMOKE_EMPLOYEE_EMAIL || DEFAULT_EMPLOYEE_EMAIL,
    employeePassword: env.BROWSER_SMOKE_EMPLOYEE_PASSWORD || DEFAULT_EMPLOYEE_PASSWORD,
    emailLabel: env.BROWSER_SMOKE_EMAIL_LABEL || 'Correo electrónico',
    passwordLabel: env.BROWSER_SMOKE_PASSWORD_LABEL || 'Contraseña',
    submitButtonName: env.BROWSER_SMOKE_SUBMIT_NAME || 'Iniciar sesión',
    loginErrorText: env.BROWSER_SMOKE_LOGIN_ERROR_TEXT || DEFAULT_LOGIN_ERROR_TEXT,
    loginSuccessPath: env.BROWSER_SMOKE_LOGIN_SUCCESS_PATH || DEFAULT_LOGIN_SUCCESS_PATH,
    mobileMenuButtonName: env.BROWSER_SMOKE_MOBILE_MENU_BUTTON || 'Abrir menú',
    logoutButtonName: env.BROWSER_SMOKE_LOGOUT_NAME || 'Cerrar sesión',
    dashboardText: env.BROWSER_SMOKE_DASHBOARD_TEXT || 'Dashboard',
    includeAdminRoutes: isTrue(env.BROWSER_SMOKE_INCLUDE_ADMIN_ROUTES),
    adminRouteChecks: DEFAULT_ADMIN_ROUTE_CHECKS,
    includeNewCredit: isTrue(env.BROWSER_SMOKE_INCLUDE_NEW_CREDIT),
    newCreditPageText: env.BROWSER_SMOKE_NEW_CREDIT_TEXT || 'Nuevo crédito',
    newCreditParametersText: env.BROWSER_SMOKE_NEW_CREDIT_PARAMETERS_TEXT || 'Parámetros',
    newCreditCustomerFieldText: env.BROWSER_SMOKE_NEW_CREDIT_CUSTOMER_TEXT || 'Cliente',
    newCreditAmountFieldText: env.BROWSER_SMOKE_NEW_CREDIT_AMOUNT_TEXT || 'Monto del crédito',
    newCreditValidateButtonName: env.BROWSER_SMOKE_NEW_CREDIT_VALIDATE_BUTTON || 'Validar crédito',
    newCreditRegisterButtonName: env.BROWSER_SMOKE_NEW_CREDIT_REGISTER_BUTTON || 'Registrar crédito',
    newCreditEmptyStateText: env.BROWSER_SMOKE_NEW_CREDIT_EMPTY_STATE || 'Aún no hay cálculo generado',
    includeReports: isTrue(env.BROWSER_SMOKE_INCLUDE_REPORTS),
    reportsPageText: env.BROWSER_SMOKE_REPORTS_TEXT || 'Reportes operativos',
    reportsCashflowTab: env.BROWSER_SMOKE_REPORTS_CASHFLOW_TAB || 'Cierre contable',
    reportsCashflowHeading: env.BROWSER_SMOKE_REPORTS_CASHFLOW_HEADING || 'Cierre contable mensual',
    includeSettings: isTrue(env.BROWSER_SMOKE_INCLUDE_SETTINGS),
    settingsPageText: env.BROWSER_SMOKE_SETTINGS_TEXT || 'Configuración operativa',
    settingsPaymentMethodsTab: env.BROWSER_SMOKE_SETTINGS_PAYMENT_METHODS_TAB || 'Métodos de pago',
    settingsPaymentMethodsHeading: env.BROWSER_SMOKE_SETTINGS_PAYMENT_METHODS_HEADING || 'Métodos disponibles',
    settingsCreatePaymentMethodButton: env.BROWSER_SMOKE_SETTINGS_CREATE_PAYMENT_METHOD_BUTTON || 'Crear método',
    settingsCreatePaymentMethodModalTitle: env.BROWSER_SMOKE_SETTINGS_CREATE_PAYMENT_METHOD_MODAL_TITLE || 'Nuevo método de pago',
    settingsCancelButtonName: env.BROWSER_SMOKE_SETTINGS_CANCEL_BUTTON || 'Cancelar',
    includeEmployeeGuards: isTrue(env.BROWSER_SMOKE_INCLUDE_EMPLOYEE_GUARDS),
    employeeProfileText: env.BROWSER_SMOKE_EMPLOYEE_PROFILE_TEXT || 'Mi perfil',
    employeeGuardedPaths: DEFAULT_EMPLOYEE_GUARDED_PATHS,
  };
};

const buildAccessibilityAuditStep = (label) => ({
  command: ACCESSIBILITY_AUDIT_COMMAND,
  args: [label],
});

const buildAccessibilityAuditSteps = (config, label) => (
  config.checkAccessibility
    ? [
      {
        command: 'press',
        args: ['Tab'],
      },
      buildAccessibilityAuditStep(label),
    ]
    : []
);

const buildAccessibilityAuditExpression = (label) => `(() => {
  const context = ${JSON.stringify(label)};
  const violations = [];
  const push = (rule, element, message) => {
    violations.push({
      rule,
      selector: getSelector(element),
      message,
      context,
    });
  };
  const trimText = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
  const cssEscape = (value) => (
    window.CSS && typeof window.CSS.escape === 'function'
      ? window.CSS.escape(value)
      : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\\\$&')
  );
  const getSelector = (element) => {
    if (!element || element === document) return 'document';
    if (element.id) return '#' + cssEscape(element.id);
    const label = trimText(element.getAttribute?.('aria-label') || element.textContent).slice(0, 40);
    const tag = element.tagName ? element.tagName.toLowerCase() : 'unknown';
    const type = element.getAttribute?.('type');
    const role = element.getAttribute?.('role');
    const attrs = [
      type ? '[type="' + type + '"]' : '',
      role ? '[role="' + role + '"]' : '',
      label ? '[text="' + label + '"]' : '',
    ].join('');
    return tag + attrs;
  };
  const isAriaHidden = (element) => (
    element.closest?.('[aria-hidden="true"]') !== null
  );
  const isVisible = (element) => {
    if (!element || isAriaHidden(element)) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  };
  const referencedText = (element, attribute) => trimText(
    String(element.getAttribute(attribute) || '')
      .split(/\\s+/)
      .map((id) => document.getElementById(id)?.textContent || '')
      .join(' '),
  );
  const hasAriaReference = (element, attribute) => (
    String(element.getAttribute(attribute) || '')
      .split(/\\s+/)
      .filter(Boolean)
      .every((id) => document.getElementById(id))
  );
  const getAccessibleName = (element) => {
    if (!element) return '';
    const ariaLabel = trimText(element.getAttribute('aria-label'));
    if (ariaLabel) return ariaLabel;
    const ariaLabelledBy = referencedText(element, 'aria-labelledby');
    if (ariaLabelledBy) return ariaLabelledBy;
    if ('labels' in element && element.labels?.length) {
      const labelText = trimText(Array.from(element.labels).map((node) => node.textContent).join(' '));
      if (labelText) return labelText;
    }
    const title = trimText(element.getAttribute('title'));
    if (title) return title;
    const alt = trimText(element.getAttribute('alt'));
    if (alt) return alt;
    return trimText(element.textContent || element.value || element.placeholder);
  };
  const interactiveSelector = [
    'button',
    'a[href]',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="switch"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  if (!trimText(document.title)) {
    violations.push({
      rule: 'missing-document-title',
      selector: 'document',
      message: 'Document title is empty.',
      context,
    });
  }
  if (!trimText(document.documentElement.getAttribute('lang'))) {
    violations.push({
      rule: 'missing-document-lang',
      selector: 'html',
      message: 'Document language is not declared.',
      context,
    });
  }

  const ids = new Map();
  document.querySelectorAll('[id]').forEach((element) => {
    ids.set(element.id, (ids.get(element.id) || 0) + 1);
  });
  ids.forEach((count, id) => {
    if (count > 1) {
      violations.push({
        rule: 'duplicate-id',
        selector: '#' + cssEscape(id),
        message: 'Duplicate id "' + id + '" appears ' + count + ' times.',
        context,
      });
    }
  });

  document.querySelectorAll(interactiveSelector).forEach((element) => {
    if (!isVisible(element) || element.disabled) return;
    if (!getAccessibleName(element)) {
      push('missing-accessible-name', element, 'Visible interactive element has no accessible name.');
    }
    const tabIndex = Number(element.getAttribute('tabindex'));
    if (Number.isFinite(tabIndex) && tabIndex > 0) {
      push('positive-tabindex', element, 'Positive tabindex creates an unpredictable keyboard order.');
    }
  });

  document.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach((element) => {
    if (!isVisible(element) || element.disabled) return;
    if (!getAccessibleName(element)) {
      push('missing-form-label', element, 'Visible form control has no label or accessible name.');
    }
  });

  document.querySelectorAll('img').forEach((element) => {
    if (!isVisible(element)) return;
    if (element.getAttribute('role') === 'presentation' || element.getAttribute('aria-hidden') === 'true') return;
    if (!element.hasAttribute('alt')) {
      push('missing-image-alt', element, 'Visible image is missing alt text.');
    }
  });

  document.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls]').forEach((element) => {
    if (!isVisible(element)) return;
    ['aria-labelledby', 'aria-describedby', 'aria-controls'].forEach((attribute) => {
      if (element.hasAttribute(attribute) && !hasAriaReference(element, attribute)) {
        push('broken-aria-reference', element, attribute + ' references an id that is not present.');
      }
    });
  });

  const activeElement = document.activeElement;
  if (activeElement && activeElement !== document.body && isVisible(activeElement)) {
    const style = window.getComputedStyle(activeElement);
    const hasVisibleFocus = (
      style.outlineStyle !== 'none'
      && style.outlineWidth !== '0px'
    ) || style.boxShadow !== 'none';
    if (!hasVisibleFocus) {
      push('missing-visible-focus', activeElement, 'Focused element has no visible focus indicator.');
    }
  } else {
    violations.push({
      rule: 'keyboard-focus-not-reached',
      selector: 'document',
      message: 'Keyboard Tab did not reach a visible focusable control.',
      context,
    });
  }

  return {
    status: violations.length ? 'failed' : 'passed',
    context,
    violations,
  };
})()`;

const buildReportsSmokeSteps = (config) => [
  {
    command: 'open',
    args: [`${config.frontendUrl}/reports`],
  },
  {
    command: 'wait',
    args: ['--load', 'networkidle'],
  },
  {
    command: 'wait',
    args: ['--text', config.reportsPageText],
  },
  {
    command: 'find',
    args: ['role', 'tab', 'click', '--name', config.reportsCashflowTab],
  },
  {
    command: 'wait',
    args: ['--text', config.reportsCashflowHeading],
  },
  ...buildAccessibilityAuditSteps(config, 'Reportes'),
];

const buildAdminRouteSmokeSteps = (config) => config.adminRouteChecks.flatMap((routeCheck) => [
  {
    command: 'open',
    args: [`${config.frontendUrl}${routeCheck.path}`],
  },
  {
    command: 'wait',
    args: ['--load', 'networkidle'],
  },
  {
    command: 'wait',
    args: ['--text', routeCheck.text],
  },
  ...buildAccessibilityAuditSteps(config, routeCheck.label),
]);

const buildButtonAccessibleNameWaitStep = (buttonName) => {
  const expected = JSON.stringify(buttonName);
  return {
    command: 'wait',
    args: [
      '--fn',
      `Array.from(document.querySelectorAll('button')).some((button) => {
        const ariaLabel = (button.getAttribute('aria-label') || '').trim();
        const text = (button.textContent || '').trim();
        return ariaLabel === ${expected} || text === ${expected} || text.includes(${expected});
      })`,
    ],
  };
};

const buildButtonDisabledWaitStep = (buttonName) => {
  const expected = JSON.stringify(buttonName);
  return {
    command: 'wait',
    args: [
      '--fn',
      `Array.from(document.querySelectorAll('button')).some((button) => {
        const ariaLabel = (button.getAttribute('aria-label') || '').trim();
        const text = (button.textContent || '').trim();
        const matchesName = ariaLabel === ${expected} || text === ${expected} || text.includes(${expected});
        return matchesName && button.disabled === true;
      })`,
    ],
  };
};

const buildLoginOutcomeWaitExpression = (config) => (
  `window.location.pathname === ${JSON.stringify(config.loginSuccessPath)} || document.body.innerText.includes(${JSON.stringify(config.loginErrorText)})`
);

const buildLoginOutcomeAssertExpression = (config) => (
  `(() => {
    if (window.location.pathname === ${JSON.stringify(config.loginSuccessPath)}) {
      return 'ok';
    }
    if (document.body.innerText.includes(${JSON.stringify(config.loginErrorText)})) {
      throw new Error('Login failed before reaching the dashboard. Check local backend/proxy availability and QA credentials.');
    }
    throw new Error('Login did not reach the dashboard or an explicit login error state.');
  })()`
);

const buildNewCreditSmokeSteps = (config) => [
  {
    command: 'open',
    args: [`${config.frontendUrl}/credits/new`],
  },
  {
    command: 'wait',
    args: ['--load', 'networkidle'],
  },
  {
    command: 'wait',
    args: ['--text', config.newCreditPageText],
  },
  {
    command: 'wait',
    args: ['--text', config.newCreditParametersText],
  },
  {
    command: 'wait',
    args: ['--text', config.newCreditCustomerFieldText],
  },
  {
    command: 'wait',
    args: ['--text', config.newCreditAmountFieldText],
  },
  buildButtonAccessibleNameWaitStep(config.newCreditValidateButtonName),
  buildButtonAccessibleNameWaitStep(config.newCreditRegisterButtonName),
  buildButtonDisabledWaitStep(config.newCreditRegisterButtonName),
  {
    command: 'wait',
    args: ['--text', config.newCreditEmptyStateText],
  },
  ...buildAccessibilityAuditSteps(config, 'Nuevo crédito'),
];

const buildSettingsSmokeSteps = (config) => [
  {
    command: 'open',
    args: [`${config.frontendUrl}/settings`],
  },
  {
    command: 'wait',
    args: ['--load', 'networkidle'],
  },
  {
    command: 'wait',
    args: ['--text', config.settingsPageText],
  },
  {
    command: 'find',
    args: ['role', 'tab', 'click', '--name', config.settingsPaymentMethodsTab],
  },
  {
    command: 'wait',
    args: ['--text', config.settingsPaymentMethodsHeading],
  },
  {
    command: 'find',
    args: ['role', 'button', 'click', '--name', config.settingsCreatePaymentMethodButton],
  },
  {
    command: 'wait',
    args: ['--text', config.settingsCreatePaymentMethodModalTitle],
  },
  {
    command: 'find',
    args: ['role', 'button', 'click', '--name', config.settingsCancelButtonName],
  },
  {
    command: 'wait',
    args: ['--text', config.settingsPaymentMethodsHeading],
  },
  ...buildAccessibilityAuditSteps(config, 'Configuración'),
];

const isMobileViewportSmoke = (config) => (
  config.viewport && Number(config.viewport.width) <= MOBILE_VIEWPORT_MAX_WIDTH
);

const buildEmployeeGuardSmokeSteps = (config) => [
  ...(isMobileViewportSmoke(config) ? [{
    command: 'find',
    args: ['role', 'button', 'click', '--name', config.mobileMenuButtonName],
  }] : []),
  {
    command: 'find',
    args: ['role', 'button', 'click', '--name', config.logoutButtonName],
  },
  {
    command: 'wait',
    args: ['--fn', "window.location.pathname === '/login'"],
  },
  {
    command: 'find',
    args: ['label', config.emailLabel, 'fill', config.employeeEmail],
  },
  {
    command: 'find',
    args: ['label', config.passwordLabel, 'fill', config.employeePassword],
    sensitive: true,
    redactArgIndexes: [3],
  },
  {
    command: 'find',
    args: ['role', 'button', 'click', '--name', config.submitButtonName],
  },
  {
    command: 'wait',
    args: ['--fn', "window.location.pathname === '/profile'"],
  },
  {
    command: 'wait',
    args: ['--text', config.employeeProfileText],
  },
  ...buildAccessibilityAuditSteps(config, 'Perfil empleado'),
  ...config.employeeGuardedPaths.flatMap((guardedPath) => [
    {
      command: 'open',
      args: [`${config.frontendUrl}${guardedPath}`],
    },
    {
      command: 'wait',
      args: ['--load', 'networkidle'],
    },
    {
      command: 'wait',
      args: ['--fn', "window.location.pathname === '/profile'"],
    },
  ]),
];

const buildViewportSmokeSteps = (config) => (config.viewport
  ? [{
    command: 'set',
    args: ['viewport', String(config.viewport.width), String(config.viewport.height)],
  }]
  : []);

const buildBrowserErrorSmokeSteps = (config, position) => {
  if (!config.checkBrowserErrors) return [];
  return position === 'start'
    ? [{ command: BROWSER_ERRORS_CLEAR_COMMAND, args: ['--clear'] }]
    : [{ command: BROWSER_ERRORS_ASSERT_COMMAND, args: [] }];
};

const buildLoginPageResetSteps = (config) => [
  {
    command: 'open',
    args: [`${config.frontendUrl}/login`],
  },
  {
    command: 'wait',
    args: ['--load', 'networkidle'],
  },
  {
    command: 'storage',
    args: ['session', 'clear'],
  },
  {
    command: 'open',
    args: [`${config.frontendUrl}/login`],
  },
  {
    command: 'wait',
    args: ['--load', 'networkidle'],
  },
];

const buildBrowserSmokeSteps = (config) => [
  ...buildViewportSmokeSteps(config),
  ...buildBrowserErrorSmokeSteps(config, 'start'),
  ...buildLoginPageResetSteps(config),
  {
    command: 'find',
    args: ['label', config.emailLabel, 'fill', config.adminEmail],
  },
  {
    command: 'find',
    args: ['label', config.passwordLabel, 'fill', config.adminPassword],
    sensitive: true,
    redactArgIndexes: [3],
  },
  {
    command: 'find',
    args: ['role', 'button', 'click', '--name', config.submitButtonName],
  },
  {
    command: 'wait',
    args: ['--fn', buildLoginOutcomeWaitExpression(config)],
  },
  {
    command: 'eval',
    args: [buildLoginOutcomeAssertExpression(config)],
  },
  {
    command: 'wait',
    args: ['--text', config.dashboardText],
  },
  ...buildAccessibilityAuditSteps(config, 'Dashboard'),
  {
    command: 'get',
    args: ['url'],
  },
  ...(config.includeAdminRoutes ? buildAdminRouteSmokeSteps(config) : []),
  ...(config.includeNewCredit ? buildNewCreditSmokeSteps(config) : []),
  ...(config.includeReports ? buildReportsSmokeSteps(config) : []),
  ...(config.includeSettings ? buildSettingsSmokeSteps(config) : []),
  ...(config.includeEmployeeGuards ? buildEmployeeGuardSmokeSteps(config) : []),
  ...buildBrowserErrorSmokeSteps(config, 'end'),
  {
    command: 'close',
    args: [],
  },
];

const buildFailureScreenshotStep = (config, date = new Date()) => {
  const timestamp = date.toISOString().replace(/[:.]/g, '-');
  return {
    command: 'screenshot',
    args: [path.join(config.artifactDir, `browser-smoke-failure-${timestamp}.png`)],
  };
};

const renderStepForLog = (step, agentBrowserBin = 'agent-browser') => {
  if (step.command === BROWSER_ERRORS_CLEAR_COMMAND || step.command === BROWSER_ERRORS_ASSERT_COMMAND) {
    return [agentBrowserBin, '--json', 'errors', ...step.args].join(' ');
  }

  if (step.command === ACCESSIBILITY_AUDIT_COMMAND) {
    return `${agentBrowserBin} eval [accessibility audit: ${step.args[0]}]`;
  }

  const redactIndexes = new Set(step.redactArgIndexes || []);
  const args = step.args.map((arg, index) => (redactIndexes.has(index) ? '[redacted]' : arg));
  return [agentBrowserBin, step.command, ...args].join(' ');
};

const parseBrowserErrorsResult = (stdout) => {
  const payload = JSON.parse(stdout || '{}');
  const errors = Array.isArray(payload?.data?.errors) ? payload.data.errors : [];
  return errors
    .map((error) => String(error?.text || error?.message || '').trim())
    .filter(Boolean);
};

const parseAccessibilityAuditResult = (stdout) => {
  const payload = JSON.parse(stdout || '{}');
  return Array.isArray(payload?.violations) ? payload.violations : [];
};

const formatAccessibilityViolations = (violations) => violations
  .map((violation) => {
    const rule = String(violation.rule || 'accessibility').trim();
    const selector = String(violation.selector || 'unknown element').trim();
    const message = String(violation.message || 'Accessibility issue detected.').trim();
    return `${rule} at ${selector}: ${message}`;
  })
  .join(' | ');

const runStep = (config, step) => {
  const safeCommand = renderStepForLog(step, config.agentBrowserBin);
  console.log(`$ ${safeCommand}`);

  if (step.command === 'screenshot' && step.args[0]) {
    fs.mkdirSync(path.dirname(step.args[0]), { recursive: true });
  }

  const isBrowserErrorCheck = step.command === BROWSER_ERRORS_CLEAR_COMMAND || step.command === BROWSER_ERRORS_ASSERT_COMMAND;
  const isAccessibilityAudit = step.command === ACCESSIBILITY_AUDIT_COMMAND;
  const commandArgs = isBrowserErrorCheck
    ? ['--json', 'errors', ...step.args]
    : isAccessibilityAudit
      ? ['eval', buildAccessibilityAuditExpression(step.args[0])]
    : [step.command, ...step.args];
  const result = spawnSync(config.agentBrowserBin, commandArgs, {
    encoding: 'utf8',
    timeout: config.timeoutMs,
    env: process.env,
  });

  if (result.error) {
    const detail = result.error.code === 'ENOENT'
      ? 'Install the agent-browser CLI or set AGENT_BROWSER_BIN to its executable path.'
      : result.error.message;
    throw new Error(`${safeCommand} failed: ${detail}`);
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    throw new Error(`${safeCommand} exited with status ${result.status}.`);
  }

  if (step.command === BROWSER_ERRORS_ASSERT_COMMAND) {
    const errors = parseBrowserErrorsResult(result.stdout);
    if (errors.length > 0) {
      throw new Error(`Browser page errors captured: ${errors.join(' | ')}`);
    }
    return;
  }

  if (step.command === BROWSER_ERRORS_CLEAR_COMMAND) {
    return;
  }

  if (step.command === ACCESSIBILITY_AUDIT_COMMAND) {
    const violations = parseAccessibilityAuditResult(result.stdout);
    if (violations.length > 0) {
      throw new Error(`Accessibility issues captured: ${formatAccessibilityViolations(violations)}`);
    }
  }
};

const runBrowserSmoke = (config = resolveBrowserSmokeConfig(), stepRunner = runStep) => {
  const steps = buildBrowserSmokeSteps(config);

  if (config.dryRun) {
    for (const step of steps) {
      console.log(renderStepForLog(step, config.agentBrowserBin));
    }
    return { status: 'dry-run', steps: steps.length };
  }

  const closeStep = steps.find((step) => step.command === 'close');
  try {
    for (const step of steps) {
      if (step.command === 'close') {
        continue;
      }
      stepRunner(config, step);
    }
    if (closeStep) {
      stepRunner(config, closeStep);
    }
  } catch (error) {
    const screenshotStep = buildFailureScreenshotStep(config);
    try {
      stepRunner(config, screenshotStep);
      console.error(`Failure screenshot saved to ${screenshotStep.args[0]}`);
    } catch (screenshotError) {
      console.error(`Could not capture failure screenshot: ${screenshotError.message}`);
    }
    if (closeStep) {
      try {
        stepRunner(config, closeStep);
      } catch (closeError) {
        console.error(closeError.message);
      }
    }
    throw error;
  }

  return { status: 'passed', steps: steps.length };
};

const printHelp = () => {
  console.log(`Usage: node scripts/localBrowserSmoke.js [--dry-run]

Runs a non-destructive browser smoke through agent-browser:
  1. Open the local login page.
  2. Sign in with the local admin QA credentials.
  3. Assert the admin dashboard is reached.

Environment:
  BROWSER_SMOKE_FRONTEND_URL   Frontend origin, defaults to ${DEFAULT_FRONTEND_URL}
  BROWSER_SMOKE_ADMIN_EMAIL    Admin email, defaults to ${DEFAULT_ADMIN_EMAIL}
  BROWSER_SMOKE_ADMIN_PASSWORD Admin password, defaults to the local QA password
  BROWSER_SMOKE_EMPLOYEE_EMAIL Employee email, defaults to ${DEFAULT_EMPLOYEE_EMAIL}
  BROWSER_SMOKE_EMPLOYEE_PASSWORD Employee password, defaults to the local QA password
  BROWSER_SMOKE_MOBILE_MENU_BUTTON Mobile drawer button name, defaults to Abrir menú
  BROWSER_SMOKE_TIMEOUT_MS     Per-step timeout, defaults to ${DEFAULT_TIMEOUT_MS}
  BROWSER_SMOKE_VIEWPORT       Optional responsive viewport as WIDTHxHEIGHT, for example 390x844
  BROWSER_SMOKE_CHECK_ERRORS   Set to true to fail when browser page errors are captured
  BROWSER_SMOKE_CHECK_A11Y     Set to true to run lightweight DOM accessibility audits
  BROWSER_SMOKE_DRY_RUN        Print commands without opening a browser
  BROWSER_SMOKE_ARTIFACT_DIR   Failure screenshot directory
  AGENT_BROWSER_BIN            agent-browser executable, defaults to agent-browser
  BROWSER_SMOKE_INCLUDE_ADMIN_ROUTES Set to true to open the main admin route shells
  BROWSER_SMOKE_INCLUDE_NEW_CREDIT Set to true to open /credits/new and verify the form shell
  BROWSER_SMOKE_INCLUDE_REPORTS Set to true to open /reports and verify the cashflow tab
  BROWSER_SMOKE_INCLUDE_SETTINGS Set to true to open /settings and verify payment methods
  BROWSER_SMOKE_INCLUDE_EMPLOYEE_GUARDS Set to true to verify employee route redirects
`);
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
  } else {
    try {
      const summary = runBrowserSmoke(resolveBrowserSmokeConfig(process.env, argv));
      console.log(JSON.stringify(summary, null, 2));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}

module.exports = {
  buildAccessibilityAuditExpression,
  buildAccessibilityAuditStep,
  buildFailureScreenshotStep,
  buildAdminRouteSmokeSteps,
  buildEmployeeGuardSmokeSteps,
  buildNewCreditSmokeSteps,
  buildButtonAccessibleNameWaitStep,
  buildButtonDisabledWaitStep,
  buildSettingsSmokeSteps,
  buildReportsSmokeSteps,
  buildBrowserSmokeSteps,
  buildBrowserErrorSmokeSteps,
  buildLoginPageResetSteps,
  buildViewportSmokeSteps,
  isMobileViewportSmoke,
  isLocalUrl,
  formatAccessibilityViolations,
  parseAccessibilityAuditResult,
  parseBrowserErrorsResult,
  renderStepForLog,
  resolveBrowserSmokeConfig,
  runBrowserSmoke,
};
