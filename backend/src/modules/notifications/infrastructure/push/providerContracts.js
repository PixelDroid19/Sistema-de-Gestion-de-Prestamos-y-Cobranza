const PUSH_PROVIDER_CHANNELS = Object.freeze({
  webpush: 'web',
});

const PUSH_PROVIDER_KEYS = new Set(Object.keys(PUSH_PROVIDER_CHANNELS));
const PUSH_CHANNELS = new Set(['web', 'mobile']);
const PUSH_CHANNEL_LABELS = Object.freeze({
  web: 'web',
  mobile: 'móvil',
});

const isSupportedPushProvider = (providerKey) => PUSH_PROVIDER_KEYS.has(providerKey);

const getExpectedPushChannel = (providerKey) => PUSH_PROVIDER_CHANNELS[providerKey] || null;

module.exports = {
  PUSH_PROVIDER_CHANNELS,
  PUSH_PROVIDER_KEYS,
  PUSH_CHANNELS,
  PUSH_CHANNEL_LABELS,
  isSupportedPushProvider,
  getExpectedPushChannel,
};
