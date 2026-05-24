import { describe, expect, it } from 'vitest';

import { getRoleLabel, getShellDestinationsForUser } from '../appShell';

describe('appShell administrative roles', () => {
  it('does not present customer or socio records as backoffice roles', () => {
    expect(getRoleLabel('customer')).toBe('Usuario no autorizado');
    expect(getRoleLabel('socio')).toBe('Usuario no autorizado');
    expect(getShellDestinationsForUser({ role: 'customer' })).toEqual([]);
    expect(getShellDestinationsForUser({ role: 'socio' })).toEqual([]);
  });
});
