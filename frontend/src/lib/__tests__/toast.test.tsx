import { readFileSync } from 'node:fs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sileo } from 'sileo';
import { toast } from '../toast';

vi.mock('sileo', () => ({
  Toaster: () => null,
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    promise: vi.fn(),
    show: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn(),
  },
}));

const mockSileo = vi.mocked(sileo);

describe('toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('app.locale');
  });

  it('does not expose raw backend validation fields or messages', () => {
    toast.validationErrors([
      {
        field: 'calculationProfileVersionId',
        message: 'calculationProfileVersionId must be a valid UUID',
      },
      {
        field: 'amount',
        message: 'Amount must be greater than zero',
      },
    ]);

    expect(mockSileo.error).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Error de validación',
      description: expect.not.stringMatching(/calculationProfileVersionId|valid UUID|Amount must/i),
    }));
    expect(mockSileo.error).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('Monto: Ingresa un valor válido.'),
    }));
  });

  it('does not expose raw promise rejection messages', () => {
    toast.promise(Promise.resolve(), 'Guardando', 'Listo');

    const promiseConfig = mockSileo.promise.mock.calls[0]?.[1] as {
      error: (error: unknown) => { title: string; description?: string };
    };
    const renderedError = promiseConfig.error(new Error('SequelizeUniqueConstraintError: users_email_key'));

    expect(renderedError.title).toBe('No se pudo completar la operación');
    expect(renderedError.description).toBe('Intenta nuevamente en unos minutos.');
    expect(renderedError.description).not.toMatch(/Sequelize|users_email_key/i);
  });

  it('does not classify non-validation API failures as validation errors', () => {
    toast.apiErrorSafe({
      response: {
        status: 500,
        data: {
          error: {
            message: 'Internal server error',
          },
        },
      },
    }, { domain: 'auth', action: 'login' });

    expect(mockSileo.error).toHaveBeenCalledWith(expect.objectContaining({
      title: 'No se pudo iniciar sesión',
      description: 'Ocurrió un problema interno. Intenta nuevamente en unos minutos.',
    }));
  });

  it('uses the active locale for default toast titles and validation messages', () => {
    localStorage.setItem('app.locale', 'en');

    toast.success({});
    toast.validationErrors([{ field: 'amount', message: 'Amount must be greater than zero' }]);

    expect(mockSileo.success).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Success',
    }));
    expect(mockSileo.error).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Validation error',
      description: 'Amount: Enter a valid value.',
    }));
  });

  it('keeps shared toast copy in terminology dictionaries', () => {
    const source = readFileSync(`${process.cwd()}/src/lib/toast.tsx`, 'utf8');

    [
      'Éxito',
      'Información',
      'Error de validación',
      'Ingresa un correo válido.',
      'No se pudo completar la operación',
    ].forEach((text) => {
      expect(source).not.toContain(text);
    });
  });
});
