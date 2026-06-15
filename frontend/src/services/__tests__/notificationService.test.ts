import { describe, expect, it } from 'vitest';
import { getNotificationMessage, getNotificationTitle, resolveNotificationDestinationForUser } from '../notificationService';

describe('resolveNotificationDestinationForUser', () => {
  it('keeps notification destinations inside administrative login roles', () => {
    const notification = {
      data: {
        loanId: 42,
      },
    };

    expect(resolveNotificationDestinationForUser(notification, { role: 'admin' })).toBe('/credits/42');
    expect(resolveNotificationDestinationForUser(notification, { role: 'employee', permissions: ['CREDITS_VIEW_ALL'] })).toBe('/credits/42');
    expect(resolveNotificationDestinationForUser(notification, { role: 'employee', permissions: [] })).toBeNull();
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
    expect(resolveNotificationDestinationForUser(notification, { role: 'employee', permissions: ['SOCIOS_VIEW_ALL'] })).toBe('/associates/7');
    expect(resolveNotificationDestinationForUser(notification, { role: 'employee', permissions: [] })).toBeNull();
  });
});

describe('getNotificationMessage', () => {
  it('replaces technical backend notification messages with operational copy', () => {
    const message = getNotificationMessage({
      type: 'payment_registered',
      message: 'calculationProfileVersionId=7f4b78c3-0f55-4a9f-a4c0-22b7df24c521 loanId=44 payload={"policySnapshot":"raw"}',
    });

    expect(message).toBe('Pago registrado. Revisa el crédito asociado para ver el detalle.');
    expect(message).not.toContain('calculationProfileVersionId');
    expect(message).not.toContain('loanId');
    expect(message).not.toContain('policySnapshot');
  });

  it('preserves operational notification messages without internal entity numbers', () => {
    const message = getNotificationMessage({
      type: 'payment_registered',
      message: 'Pago registrado por $180000.',
    });

    expect(message).toBe('Pago registrado por $180000.');
  });

  it('replaces notification messages that expose internal entity numbers', () => {
    const message = getNotificationMessage({
      type: 'payment_registered',
      message: 'Pago registrado en el crédito #5 por $180000.',
    });

    expect(message).toBe('Pago registrado. Revisa el crédito asociado para ver el detalle.');
    expect(message).not.toContain('crédito #5');
  });
});

describe('getNotificationTitle', () => {
  it('replaces technical backend notification titles with operational labels', () => {
    const title = getNotificationTitle({
      type: 'payment_registered',
      title: 'PAYMENT_STATE_MACHINE_SYNC',
    });

    expect(title).toBe('Pago registrado');
    expect(title).not.toContain('PAYMENT_STATE_MACHINE_SYNC');
  });
});
