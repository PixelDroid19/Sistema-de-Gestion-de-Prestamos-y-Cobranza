import { describe, expect, it } from 'vitest';

import { getRoleLabel, getShellDestinationsForUser } from '../appShell';
import { PERMISSION } from '../permissionNames';

describe('appShell administrative roles', () => {
  it('does not present customer or socio records as backoffice roles', () => {
    expect(getRoleLabel('customer')).toBe('Usuario no autorizado');
    expect(getRoleLabel('socio')).toBe('Usuario no autorizado');
    expect(getShellDestinationsForUser({ role: 'customer' })).toEqual([]);
    expect(getShellDestinationsForUser({ role: 'socio' })).toEqual([]);
  });

  it('only shows new credit shortcut when the route permissions are complete', () => {
    const createOnlyDestinations = getShellDestinationsForUser({
      role: 'employee',
      permissions: [PERMISSION.CREDITS_CREATE],
    });

    expect(createOnlyDestinations.map((destination) => destination.view)).not.toContain('credits-new');

    const completeDestinations = getShellDestinationsForUser({
      role: 'employee',
      permissions: [PERMISSION.CREDITS_CREATE, PERMISSION.CREDITS_VIEW_ALL],
    });

    expect(completeDestinations.map((destination) => destination.view)).toContain('credits-new');
  });
});
