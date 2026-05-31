import { beforeEach, describe, expect, it } from 'vitest';
import { getSafeErrorMessage, getSafeErrorText } from '../safeErrorMessages';

describe('safeErrorMessages', () => {
  beforeEach(() => {
    localStorage.removeItem('app.locale');
  });

  it('does not expose sensitive backend internals in user-facing messages', () => {
    const backendError = {
      statusCode: 409,
      message: 'nearest cancellable installment is #4 in payment_state_machine with sql constraint violation',
    };

    const safe = getSafeErrorMessage(backendError, {
      domain: 'payments',
      action: 'payment.register',
    });

    expect(safe.title).toBe('No se pudo registrar el pago');
    expect(`${safe.title} ${safe.description ?? ''}`).not.toContain('payment_state_machine');
    expect(`${safe.title} ${safe.description ?? ''}`).not.toContain('sql');
  });

  it('returns auth/session-safe message for unauthorized errors', () => {
    const unauthorizedError = {
      response: {
        status: 401,
        data: {
          error: {
            message: 'JWT expired at 2026-04-01T10:20:00Z',
          },
        },
      },
    };

    const safe = getSafeErrorMessage(unauthorizedError, {
      domain: 'auth',
      action: 'session',
    });

    expect(safe.title).toBe('Tu sesión expiró o no es válida');
    expect(safe.description).toContain('Inicia sesión nuevamente');
  });

  it('returns login-safe copy for invalid credentials', () => {
    const loginError = {
      statusCode: 401,
      message: 'Please enter correct email/password',
    };

    const safe = getSafeErrorMessage(loginError, {
      domain: 'auth',
      action: 'login',
    });

    expect(safe.title).toBe('Correo o contraseña incorrectos');
    expect(safe.description).toContain('credenciales');
  });

  it('returns report-safe copy without backend raw details', () => {
    const reportError = {
      response: {
        data: {
          error: {
            message: 'Internal server error: reports_query failed with stack trace ...',
          },
        },
      },
    };

    const text = getSafeErrorText(reportError, {
      domain: 'reports',
      action: 'reports.load',
    });

    expect(text).toContain('No se pudieron cargar los reportes');
    expect(text).not.toContain('stack trace');
    expect(text).not.toContain('reports_query');
  });

  it('uses the active locale for safe messages', () => {
    localStorage.setItem('app.locale', 'en');

    const loginSafe = getSafeErrorMessage({ statusCode: 401, message: 'wrong password' }, {
      domain: 'auth',
      action: 'login',
    });
    const reportText = getSafeErrorText(new Error('stack trace reports_query failed'), {
      domain: 'reports',
      action: 'reports.load',
    });

    expect(loginSafe).toEqual({
      title: 'Incorrect email or password',
      description: 'Check your credentials and try again.',
    });
    expect(reportText).toContain('Could not load reports');
    expect(reportText).not.toContain('stack trace');
  });
});
