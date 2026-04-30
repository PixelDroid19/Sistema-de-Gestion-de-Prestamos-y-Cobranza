import { describe, expect, it } from 'vitest';
import { createIdempotencyKey, withIdempotencyKey } from '../idempotency';

describe('idempotency helpers', () => {
  it('creates unique bounded keys for financial mutation attempts', () => {
    const first = createIdempotencyKey('payment');
    const second = createIdempotencyKey('payment');

    expect(first).toMatch(/^payment:/);
    expect(second).toMatch(/^payment:/);
    expect(first).not.toBe(second);
    expect(first.length).toBeLessThanOrEqual(160);
  });

  it('adds an Idempotency-Key header without dropping existing headers', () => {
    const config = withIdempotencyKey('capital-payment', {
      headers: {
        Authorization: 'Bearer token',
      },
    });

    expect(config.headers?.Authorization).toBe('Bearer token');
    expect(config.headers?.['Idempotency-Key']).toMatch(/^capital-payment:/);
  });
});
