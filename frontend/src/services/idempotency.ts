import type { ApiRequestConfig } from '../api/client';

const MAX_IDEMPOTENCY_KEY_LENGTH = 160;

const randomSuffix = () => {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(4);
    cryptoApi.getRandomValues(values);
    return Array.from(values, (value) => value.toString(36)).join('');
  }

  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
};

export const createIdempotencyKey = (scope: string): string => (
  `${scope}:${Date.now().toString(36)}:${randomSuffix()}`
).slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);

export const withIdempotencyKey = (scope: string, config: ApiRequestConfig = {}): ApiRequestConfig => ({
  ...config,
  headers: {
    ...(config.headers || {}),
    'Idempotency-Key': createIdempotencyKey(scope),
  },
});
