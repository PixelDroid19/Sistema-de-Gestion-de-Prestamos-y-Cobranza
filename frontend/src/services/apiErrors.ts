export type ApiValidationError = {
  field: string;
  message: string;
  value?: unknown;
};

type ApiErrorShape = {
  details?: {
    validationErrors?: ApiValidationError[];
  };
  response?: {
    data?: {
      error?: {
        validationErrors?: ApiValidationError[];
      };
    };
  };
};

/**
 * Extract validation errors from either the normalized fetch client error
 * shape or legacy Axios-like payloads used by older components/tests.
 */
export const extractValidationErrors = (error: unknown): ApiValidationError[] => {
  const typedError = error as ApiErrorShape | null | undefined;

  if (Array.isArray(typedError?.details?.validationErrors)) {
    return typedError.details.validationErrors;
  }

  if (Array.isArray(typedError?.response?.data?.error?.validationErrors)) {
    return typedError.response.data.error.validationErrors;
  }

  return [];
};
