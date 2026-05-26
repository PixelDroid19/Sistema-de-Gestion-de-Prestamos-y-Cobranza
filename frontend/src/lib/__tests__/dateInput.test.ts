import { describe, expect, it } from 'vitest';
import { getLocalDateInputValue } from '../dateInput';

describe('getLocalDateInputValue', () => {
  it('uses the local calendar day instead of the UTC day', () => {
    const originalOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = () => 300;

    try {
      expect(getLocalDateInputValue(new Date('2026-05-26T02:30:00.000Z'))).toBe('2026-05-25');
    } finally {
      Date.prototype.getTimezoneOffset = originalOffset;
    }
  });
});
