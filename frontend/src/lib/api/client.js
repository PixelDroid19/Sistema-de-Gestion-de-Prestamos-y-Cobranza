import { useSessionStore } from '@/store/sessionStore';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.payload = options.payload;
  }
}

const getToken = () => useSessionStore.getState().token || localStorage.getItem('token');

const collectValidationMessages = (validationErrors = []) => validationErrors
  .map((error) => error?.message)
  .filter((message) => typeof message === 'string' && message.trim());

const buildMessage = (payload, fallbackStatus) => {
  if (!payload) {
    return `HTTP error! status: ${fallbackStatus}`;
  }

  const nestedError = payload.error && typeof payload.error === 'object' ? payload.error : null;
  const topLevelValidationMessages = Array.isArray(payload.validationErrors)
    ? collectValidationMessages(payload.validationErrors)
    : [];
  const nestedValidationMessages = Array.isArray(nestedError?.validationErrors)
    ? collectValidationMessages(nestedError.validationErrors)
    : [];
  const combinedValidationMessages = [...topLevelValidationMessages, ...nestedValidationMessages];

  if (typeof payload.message === 'string' && payload.message.trim()) {
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      return [payload.message, ...payload.errors.map((error) => error.message)].join('\n');
    }
    if (combinedValidationMessages.length > 0) {
      return [payload.message, ...combinedValidationMessages].join('\n');
    }
    return payload.message;
  }

  if (typeof nestedError?.message === 'string' && nestedError.message.trim()) {
    if (combinedValidationMessages.length > 0) {
      return [nestedError.message, ...combinedValidationMessages].join('\n');
    }
    return nestedError.message;
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return payload.errors.map((error) => error.message).join('\n');
  }

  if (combinedValidationMessages.length > 0) {
    return combinedValidationMessages.join('\n');
  }

  return `HTTP error! status: ${fallbackStatus}`;
};

const parseJsonSafely = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

export const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const {
    method = 'GET',
    body,
    headers = {},
    responseType = 'json',
  } = options;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestHeaders = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : isFormData || typeof body === 'string' ? body : JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await parseJsonSafely(response);
    throw new ApiError(buildMessage(payload, response.status), {
      status: response.status,
      payload,
    });
  }

  if (responseType === 'blob') {
    return response.blob();
  }

  if (response.status === 204) {
    return null;
  }

  return parseJsonSafely(response);
};
