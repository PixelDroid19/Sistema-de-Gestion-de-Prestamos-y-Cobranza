import { useSessionStore } from '../../store/sessionStore';

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

const buildMessage = (payload, fallbackStatus) => {
  if (!payload) {
    return `HTTP error! status: ${fallbackStatus}`;
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      return [payload.message, ...payload.errors.map((error) => error.message)].join('\n');
    }
    return payload.message;
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return payload.errors.map((error) => error.message).join('\n');
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
