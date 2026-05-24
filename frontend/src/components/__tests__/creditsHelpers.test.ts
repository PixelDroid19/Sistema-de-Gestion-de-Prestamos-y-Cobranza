import { describe, expect, it } from 'vitest';

import { getLoanStatusDescription, getLoanStatusLabel, getRecoveryStatusLabel } from '../credits/creditsHelpers';

describe('creditsHelpers', () => {
  it('uses an operational fallback for unknown loan and recovery statuses', () => {
    expect(getLoanStatusLabel('written_off')).toBe('Estado no clasificado');
    expect(getLoanStatusDescription('written_off')).toBe('Estado no clasificado');
    expect(getRecoveryStatusLabel({ recoveryStatus: 'manual_hold' })).toBe('Estado no clasificado');
  });
});
