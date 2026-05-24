import { describe, expect, it } from 'vitest';
import { resolveNotificationDestinationForUser } from '../notificationService';

describe('resolveNotificationDestinationForUser', () => {
  it('keeps notification destinations inside administrative login roles', () => {
    const notification = {
      data: {
        loanId: 42,
      },
    };

    expect(resolveNotificationDestinationForUser(notification, { role: 'admin' })).toBe('/credits/42');
    expect(resolveNotificationDestinationForUser(notification, { role: 'employee' })).toBe('/credits/42');
    expect(resolveNotificationDestinationForUser(notification, { role: 'customer' })).toBeNull();
    expect(resolveNotificationDestinationForUser(notification, { role: 'socio', associateId: 7 })).toBeNull();
  });

  it('does not treat associate records as notification portal users', () => {
    const notification = {
      data: {
        associateId: 7,
      },
    };

    expect(resolveNotificationDestinationForUser(notification, { role: 'socio', associateId: 7 })).toBeNull();
    expect(resolveNotificationDestinationForUser(notification, { role: 'admin' })).toBe('/associates/7');
  });
});
