import { useSessionStore } from '../store/sessionStore';

export const API_BASE_URL = '/api';

type Primitive = string | number | boolean;
type QueryParamValue = Primitive | Primitive[] | null | undefined;

export interface ApiRequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, QueryParamValue>;
  responseType?: 'json' | 'blob' | 'text';
  signal?: AbortSignal;
  _retry?: boolean;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
}

let refreshPromise: Promise<string> | null = null;

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const buildUrl = (path: string, params?: Record<string, QueryParamValue>): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const absolute = isAbsoluteUrl(path);
  const basePath = absolute ? path : `${API_BASE_URL}${normalizedPath}`;
  const url = new URL(basePath, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;

      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== null && item !== undefined) {
            url.searchParams.append(key, String(item));
          }
        });
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return absolute ? url.toString() : `${url.pathname}${url.search}`;
};

const normalizeError = async (response: Response): Promise<{ message: string; statusCode: number; details?: unknown }> => {
  let payload: any = null;

  try {
    payload = await response.clone().json();
  } catch {
    try {
      payload = await response.clone().text();
    } catch {
      payload = null;
    }
  }

  if (payload && typeof payload === 'object' && payload.success === false && payload.error) {
    return {
      message: payload.error.message || `HTTP ${response.status}`,
      statusCode: payload.error.statusCode || response.status,
      details: payload.error,
    };
  }

  const textMessage = typeof payload === 'string' && payload.trim().length > 0 ? payload : undefined;

  return {
    message: textMessage || response.statusText || `HTTP ${response.status}`,
    statusCode: response.status,
    details: payload,
  };
};

const parseResponseData = async <T>(response: Response, responseType: ApiRequestConfig['responseType']): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }

  if (responseType === 'blob') {
    return (await response.blob()) as T;
  }

  if (responseType === 'text') {
    return (await response.text()) as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
};

const refreshAccessToken = async (): Promise<string> => {
  const { refreshToken, updateAccessToken, logout } = useSessionStore.getState();

  if (!refreshToken) {
    logout();
    throw { message: 'No refresh token available', statusCode: 401 };
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    logout();
    throw await normalizeError(response);
  }

  const payload = await response.json();
  const accessToken = payload?.data?.accessToken as string | undefined;
  const newRefreshToken = (payload?.data?.refreshToken as string | undefined) ?? refreshToken;

  if (!accessToken) {
    logout();
    throw { message: 'Invalid refresh response', statusCode: 500 };
  }

  updateAccessToken(accessToken, newRefreshToken);
  return accessToken;
};

const getRefreshPromise = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

const request = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  config: ApiRequestConfig = {}
): Promise<ApiResponse<T>> => {
  const headers = new Headers(config.headers || {});
  const { accessToken } = useSessionStore.getState();

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const isFormData = body instanceof FormData;
  if (isFormData && headers.has('Content-Type')) {
    headers.delete('Content-Type');
  }

  if (!isFormData && body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildUrl(path, config.params), {
    method,
    headers,
    signal: config.signal,
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
  });

  const isRefreshRequest = path.includes('/auth/refresh');

  if (response.status === 401 && !config._retry && !isRefreshRequest) {
    try {
      const nextToken = await getRefreshPromise();
      const retryHeaders = {
        ...(config.headers || {}),
        Authorization: `Bearer ${nextToken}`,
      };

      return request<T>(method, path, body, { ...config, headers: retryHeaders, _retry: true });
    } catch (refreshError) {
      throw refreshError;
    }
  }

  if (!response.ok) {
    throw await normalizeError(response);
  }

  const data = await parseResponseData<T>(response, config.responseType);

  if (data && typeof data === 'object' && (data as any).success === false && (data as any).error) {
    const backendError = (data as any).error;
    throw {
      message: backendError.message || 'Request failed',
      statusCode: backendError.statusCode || response.status,
      details: backendError,
    };
  }

  return {
    data,
    status: response.status,
    headers: response.headers,
  };
};

export const apiClient = {
  baseURL: API_BASE_URL,
  get: <T = any>(path: string, config?: ApiRequestConfig) => request<T>('GET', path, undefined, config),
  post: <T = any>(path: string, body?: unknown, config?: ApiRequestConfig) => request<T>('POST', path, body, config),
  put: <T = any>(path: string, body?: unknown, config?: ApiRequestConfig) => request<T>('PUT', path, body, config),
  patch: <T = any>(path: string, body?: unknown, config?: ApiRequestConfig) => request<T>('PATCH', path, body, config),
  delete: <T = any>(path: string, config?: ApiRequestConfig) => request<T>('DELETE', path, undefined, config),
};
