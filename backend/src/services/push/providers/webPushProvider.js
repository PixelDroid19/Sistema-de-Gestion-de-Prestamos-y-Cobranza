const webpush = require('web-push');

const INVALID_STATUS_CODES = new Set([404, 410]);

const createWebPushProvider = ({
  client = webpush,
  env = process.env,
} = {}) => {
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = env.WEB_PUSH_VAPID_SUBJECT;
  const isConfigured = Boolean(publicKey && privateKey && subject);

  if (isConfigured) {
    client.setVapidDetails(subject, publicKey, privateKey);
  }

  return {
    key: 'webpush',
    channel: 'web',
    isConfigured,
    async send({ notification, subscription }) {
      if (!isConfigured) {
        return { status: 'transient_failure', detail: 'web_push_not_configured' };
      }

      try {
        await client.sendNotification(subscription.subscription, JSON.stringify({
          title: 'LendFlow',
          body: notification.message,
          notificationId: notification.id,
          type: notification.type,
          data: notification.data || {},
          createdAt: notification.createdAt,
        }));

        return { status: 'delivered' };
      } catch (error) {
        if (INVALID_STATUS_CODES.has(Number(error.statusCode))) {
          return {
            status: 'invalid',
            detail: error.body || error.message || 'subscription_invalid',
          };
        }

        return {
          status: 'transient_failure',
          detail: error.body || error.message || 'web_push_delivery_failed',
        };
      }
    },
  };
};

module.exports = {
  createWebPushProvider,
};
