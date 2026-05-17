const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

const EMAIL_ELIGIBLE_NOTIFICATION_TYPES = new Set([
  'payment_registered',
  'promise_created',
  'promise_status',
  'loan_reminder',
]);

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const stripHtml = (value) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const normalizeEmailList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  const email = String(value || '').trim();
  return email ? [email] : [];
};

const isEmailEligibleNotification = (notification) => (
  EMAIL_ELIGIBLE_NOTIFICATION_TYPES.has(String(notification?.type || ''))
);

const buildNotificationSubject = (notification) => {
  const labels = {
    payment_registered: 'Pago registrado',
    promise_created: 'Compromiso de pago creado',
    promise_status: 'Compromiso de pago actualizado',
    loan_reminder: 'Recordatorio de credito',
  };

  return labels[String(notification?.type || '')] || 'Nueva notificacion';
};

const buildNotificationHtml = ({ notification, appUrl }) => {
  const safeMessage = escapeHtml(notification?.message || 'Tienes una nueva notificacion.');
  const safeType = escapeHtml(notification?.type || 'notification');
  const safeAction = appUrl
    ? `<p><a href="${escapeHtml(appUrl)}" target="_blank" rel="noopener noreferrer">Abrir CrediCobranza</a></p>`
    : '';

  return [
    '<div>',
    '<h1>CrediCobranza</h1>',
    `<p>${safeMessage}</p>`,
    `<p><strong>Tipo:</strong> ${safeType}</p>`,
    safeAction,
    '</div>',
  ].join('');
};

const buildIdempotencyKey = ({ notification, recipientEmail }) => {
  const base = [
    'notification-email',
    notification?.dedupeKey || notification?.id || Date.now(),
    recipientEmail,
  ].join(':');

  return base.slice(0, 256);
};

const parseErrorDetail = async (response) => {
  try {
    const payload = await response.json();
    return payload?.message || payload?.error?.message || JSON.stringify(payload);
  } catch (_error) {
    try {
      return await response.text();
    } catch (_textError) {
      return `resend_http_${response.status}`;
    }
  }
};

const createResendEmailProvider = ({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) => {
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  const from = String(env.RESEND_FROM_EMAIL || '').trim();
  const appUrl = String(env.APP_PUBLIC_URL || env.FRONTEND_URL || '').trim();
  const isEnabled = String(env.EMAIL_NOTIFICATIONS_ENABLED || '').toLowerCase() === 'true';
  const isConfigured = Boolean(isEnabled && apiKey && from && fetchImpl);

  return {
    key: 'resend',
    channel: 'email',
    isConfigured,
    supportsNotification: isEmailEligibleNotification,
    async send({ notification, recipient }) {
      if (!isConfigured) {
        return { status: 'skipped', detail: 'email_not_configured' };
      }

      if (!isEmailEligibleNotification(notification)) {
        return { status: 'skipped', detail: 'email_not_required' };
      }

      const recipients = normalizeEmailList(recipient?.email);
      if (recipients.length === 0) {
        return { status: 'skipped', detail: 'recipient_email_missing' };
      }

      const html = buildNotificationHtml({ notification, appUrl });
      const recipientEmail = recipients[0];
      const response = await fetchImpl(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'Idempotency-Key': buildIdempotencyKey({ notification, recipientEmail }),
        },
        body: JSON.stringify({
          from,
          to: recipients,
          subject: buildNotificationSubject(notification),
          html,
          text: stripHtml(html),
        }),
      });

      if (response.ok) {
        const payload = typeof response.json === 'function' ? await response.json() : {};
        return { status: 'delivered', providerMessageId: payload?.id || null };
      }

      return {
        status: 'transient_failure',
        detail: await parseErrorDetail(response),
      };
    },
  };
};

module.exports = {
  createResendEmailProvider,
  buildNotificationHtml,
  buildNotificationSubject,
  isEmailEligibleNotification,
};
