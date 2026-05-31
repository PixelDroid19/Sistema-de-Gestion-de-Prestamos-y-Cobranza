import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportClientError } from '../clientDiagnostics';

describe('reportClientError', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    consoleError.mockClear();
  });

  afterEach(() => {
    consoleError.mockClear();
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it('logs only sanitized diagnostic metadata in development', () => {
    reportClientError('payments.register', {
      response: {
        status: 500,
        data: {
          error: {
            message: 'SequelizeUniqueConstraintError: payments_internal_key',
          },
        },
      },
    });

    if (import.meta.env.DEV) {
      expect(consoleError).toHaveBeenCalledWith('[payments.register] client operation failed', {
        errorName: 'object',
        statusCode: 500,
      });
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('Sequelize');
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('payments_internal_key');
    } else {
      expect(consoleError).not.toHaveBeenCalled();
    }
  });
});
