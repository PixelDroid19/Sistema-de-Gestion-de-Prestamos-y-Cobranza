const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createResendEmailProvider,
  buildNotificationHtml,
  buildNotificationSubject,
  isEmailEligibleNotification,
} = require('@/services/email/providers/resendEmailProvider');

test('createResendEmailProvider stays disabled until explicitly configured', async () => {
  let fetchCalled = false;
  const provider = createResendEmailProvider({
    env: {},
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true };
    },
  });

  const result = await provider.send({
    notification: { id: 1, message: 'Pago recibido', type: 'payment_registered' },
    recipient: { email: 'customer@test.local' },
  });

  assert.equal(provider.isConfigured, false);
  assert.deepEqual(result, { status: 'skipped', detail: 'email_not_configured' });
  assert.equal(fetchCalled, false);
});

test('createResendEmailProvider sends Resend-compatible payloads with idempotency header', async () => {
  const calls = [];
  const provider = createResendEmailProvider({
    env: {
      EMAIL_NOTIFICATIONS_ENABLED: 'true',
      RESEND_API_KEY: 're_test_xxxxxxxxx',
      RESEND_FROM_EMAIL: 'CrediCobranza <onboarding@resend.dev>',
      APP_PUBLIC_URL: 'https://app.example.test',
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        async json() {
          return { id: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794' };
        },
      };
    },
  });

  const result = await provider.send({
    notification: {
      id: 55,
      dedupeKey: 'loan-payment:55',
      message: 'Pago recibido',
      type: 'payment_registered',
      data: { loanId: 55 },
    },
    recipient: { email: 'customer@test.local' },
  });

  assert.equal(provider.isConfigured, true);
  assert.deepEqual(result, {
    status: 'delivered',
    providerMessageId: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.authorization, 'Bearer re_test_xxxxxxxxx');
  assert.match(calls[0].options.headers['Idempotency-Key'], /^notification-email:loan-payment:55:customer@test\.local/);

  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.from, 'CrediCobranza <onboarding@resend.dev>');
  assert.deepEqual(body.to, ['customer@test.local']);
  assert.equal(body.subject, 'Pago registrado');
  assert.match(body.html, /Pago recibido/);
  assert.match(body.html, /https:\/\/app\.example\.test/);
  assert.equal(body.text.includes('<'), false);
});

test('createResendEmailProvider converts provider errors to transient failures', async () => {
  const provider = createResendEmailProvider({
    env: {
      EMAIL_NOTIFICATIONS_ENABLED: 'true',
      RESEND_API_KEY: 're_test_xxxxxxxxx',
      RESEND_FROM_EMAIL: 'CrediCobranza <onboarding@resend.dev>',
    },
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      async json() {
        return { message: 'rate limit exceeded' };
      },
    }),
  });

  const result = await provider.send({
    notification: { id: 3, message: 'Recordatorio', type: 'loan_reminder' },
    recipient: { email: 'customer@test.local' },
  });

  assert.deepEqual(result, { status: 'transient_failure', detail: 'rate limit exceeded' });
});

test('createResendEmailProvider treats invalid API keys as transient email failures', async () => {
  const provider = createResendEmailProvider({
    env: {
      EMAIL_NOTIFICATIONS_ENABLED: 'true',
      RESEND_API_KEY: 're_test_xxxxxxxxx',
      RESEND_FROM_EMAIL: 'CrediCobranza <onboarding@resend.dev>',
    },
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async json() {
        return { message: 'API key is invalid' };
      },
    }),
  });

  const result = await provider.send({
    notification: { id: 4, message: 'Pago recibido', type: 'payment_registered' },
    recipient: { email: 'customer@test.local' },
  });

  assert.deepEqual(result, { status: 'transient_failure', detail: 'API key is invalid' });
});

test('createResendEmailProvider skips non-actionable notification types without calling Resend', async () => {
  let fetchCalled = false;
  const provider = createResendEmailProvider({
    env: {
      EMAIL_NOTIFICATIONS_ENABLED: 'true',
      RESEND_API_KEY: 're_test_xxxxxxxxx',
      RESEND_FROM_EMAIL: 'CrediCobranza <onboarding@resend.dev>',
    },
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true };
    },
  });

  const result = await provider.send({
    notification: { id: 5, message: 'Configuracion actualizada', type: 'config_changed' },
    recipient: { email: 'admin@test.local' },
  });

  assert.deepEqual(result, { status: 'skipped', detail: 'email_not_required' });
  assert.equal(provider.supportsNotification({ type: 'config_changed' }), false);
  assert.equal(fetchCalled, false);
});

test('email notification content escapes unsafe notification values', () => {
  const html = buildNotificationHtml({
    notification: { message: '<script>alert(1)</script>', type: 'loan_reminder' },
    appUrl: 'https://app.example.test/?q=<bad>',
  });

  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal(buildNotificationSubject({ type: 'loan_reminder' }), 'Recordatorio de credito');
  assert.equal(isEmailEligibleNotification({ type: 'loan_reminder' }), true);
  assert.equal(isEmailEligibleNotification({ type: 'config_changed' }), false);
});
