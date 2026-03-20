import { ApiError } from '@/lib/api/client';
import { useSessionStore } from '@/store/sessionStore';

const expireSession = () => {
  useSessionStore.getState().logout();
  window.dispatchEvent(new CustomEvent('sessionExpired'));
};

export const extractApiErrorDetails = (error) => {
  const payload = error?.payload?.error ?? error?.payload ?? {};

  return {
    status: error?.status,
    message: payload.message || error?.message || 'An unexpected error occurred.',
    code: payload.code || error?.code || null,
    denialReasons: Array.isArray(payload.denialReasons) ? payload.denialReasons : [],
    validationErrors: Array.isArray(payload.validationErrors) ? payload.validationErrors : [],
    payload,
  };
};

export const handleApiError = (error, setError = null) => {
  console.error('API Error:', error);

  const { status, message } = extractApiErrorDetails(error);
  let errorMessage = 'An unexpected error occurred.';

  if (status === 401) {
    expireSession();
    errorMessage = 'Session expired. Please log in again.';
  } else if (status === 403) {
    errorMessage = 'Access denied. You do not have permission to perform this action.';
  } else if (status === 404) {
    errorMessage = 'Resource not found.';
  } else if (status === 500) {
    errorMessage = 'Server error. Please try again later.';
  } else if (error instanceof ApiError) {
    errorMessage = message || errorMessage;
  } else if (error?.message) {
    errorMessage = error.message;
  }

  if (setError && typeof setError === 'function') {
    setError(errorMessage);
  }

  return errorMessage;
};
