import { describe, expect, it } from 'vitest';
import { installmentActionClass, tableIconButtonBase, tableIconButtonDanger } from '../tableActionStyles';

describe('tableActionStyles', () => {
  it('uses bordered action-button shells for all installment tones', () => {
    expect(tableIconButtonBase).toContain('action-button--ghost');
    expect(installmentActionClass('blue')).toContain('action-button--ghost');
    expect(installmentActionClass('emerald')).toContain('action-button--ghost');
    expect(installmentActionClass('rose')).toBe(tableIconButtonDanger);
    expect(tableIconButtonDanger).toContain('action-button--danger');
  });
});
