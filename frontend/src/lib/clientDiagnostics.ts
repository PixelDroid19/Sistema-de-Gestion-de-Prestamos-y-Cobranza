import { extractStatusCode } from '../services/safeErrorMessages';

const getErrorName = (error: unknown): string => {
  if (error instanceof Error) return error.name;
  if (error && typeof error === 'object') {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return typeof error;
};

export const reportClientError = (scope: string, error: unknown) => {
  if (!import.meta.env.DEV) return;

  const statusCode = extractStatusCode(error);
  console.error(`[${scope}] client operation failed`, {
    errorName: getErrorName(error),
    ...(statusCode ? { statusCode } : {}),
  });
};
