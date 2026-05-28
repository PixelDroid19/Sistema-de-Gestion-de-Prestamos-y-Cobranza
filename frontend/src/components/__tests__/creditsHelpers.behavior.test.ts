import { describe, expect, it } from 'vitest';
import { getCreditLabel } from '../credits/creditsHelpers';

describe('creditsHelpers behavior', () => {
  it('preserves legitimate customer names that contain dev-like syllables', () => {
    expect(getCreditLabel({
      customerName: 'Devora Alvarez',
    })).toBe('Devora Alvarez');
  });
});
