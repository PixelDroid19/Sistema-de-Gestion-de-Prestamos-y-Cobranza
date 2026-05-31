import { beforeEach, describe, expect, it } from 'vitest';
import { getSafeOperationalGuardMessage, getSafeOperationalMessage } from '../operationalErrorMessages';

describe('getSafeOperationalMessage', () => {
  beforeEach(() => {
    localStorage.removeItem('app.locale');
  });

  it('keeps known operator-facing capital-payment denials', () => {
    const message = getSafeOperationalMessage('capital.payment', {
      response: {
        status: 400,
        data: {
          error: {
            message: 'El abono a capital no puede exceder el capital vivo del crédito',
          },
        },
      },
    });

    expect(message).toEqual({
      title: 'No se pudo registrar el abono a capital',
      description: 'El abono a capital no puede exceder el capital vivo del crédito',
    });
  });

  it('does not expose raw technical capital-payment denials', () => {
    const message = getSafeOperationalMessage('capital.payment', {
      response: {
        status: 400,
        data: {
          error: {
            message: 'Loan has no outstanding balance for capital payment; calculationProfileVersionId=7f4b78c3-0f55-4a9f-a4c0-22b7df24c521',
          },
        },
      },
    });

    expect(message).toEqual({
      title: 'No se pudo registrar el abono a capital',
      description: 'Verifica el estado de la operación y vuelve a intentarlo.',
    });
    expect(`${message.title} ${message.description}`).not.toContain('Loan has no outstanding balance');
    expect(`${message.title} ${message.description}`).not.toContain('calculationProfileVersionId');
  });

  it('uses the server-safe description for internal operational failures', () => {
    const message = getSafeOperationalMessage('installment.pay', {
      response: {
        status: 500,
        data: {
          error: {
            message: 'Internal server error: payment query failed with stack trace',
          },
        },
      },
    });

    expect(message).toEqual({
      title: 'No se pudo registrar el pago de la cuota',
      description: 'Ocurrió un problema interno. Intenta nuevamente en unos minutos.',
    });
    expect(`${message.title} ${message.description}`).not.toContain('stack trace');
  });

  it('uses the active locale for safe operational errors', () => {
    localStorage.setItem('app.locale', 'en');

    expect(getSafeOperationalMessage('installment.pay')).toEqual({
      title: 'Could not record the installment payment',
      description: 'Check the operation status and try again.',
    });
    expect(getSafeOperationalGuardMessage('credit.view')).toEqual({
      title: 'Action unavailable',
      description: 'Check permissions and operation status before trying again.',
    });
  });
});
