import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useSessionStore } from '../store/sessionStore';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Queue for pending requests while a token refresh is in progress
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

/**
 * Process the queue of pending requests after token refresh completes.
 * @param {string} accessToken - The new access token
 * @param {any} error - Error if refresh failed
 */
const processQueue = (accessToken: string | null, error: any) => {
  failedQueue.forEach((prom) => {
    if (accessToken) {
      prom.resolve(accessToken);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

/**
 * Attempt to refresh the access token using the stored refresh token.
 * @returns {Promise<string>} The new access token
 */
const refreshAccessToken = async (): Promise<string> => {
  const { refreshToken, updateAccessToken, logout } = useSessionStore.getState();
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await axios.post('/api/auth/refresh', { refreshToken });
    const { accessToken, refreshToken: newRefreshToken } = response.data.data;
    
    // Update the stored tokens
    updateAccessToken(accessToken, newRefreshToken);
    
    return accessToken;
  } catch (refreshError) {
    // Refresh failed - logout the user
    logout();
    throw refreshError;
  }
};

apiClient.interceptors.request.use(
  (config) => {
    const accessToken = useSessionStore.getState().accessToken;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Another request is already refreshing - queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (accessToken: string) => {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              resolve(apiClient(originalRequest));
            },
            reject: (err: any) => {
              reject(err);
            },
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newAccessToken = await refreshAccessToken();
        processQueue(newAccessToken, null);
        
        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(null, refreshError);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Normalize backend error envelope
    const data = error.response?.data as any;
    if (data && data.success === false && data.error) {
      return Promise.reject(data.error);
    }

    return Promise.reject({
      message: error.message,
      statusCode: error.response?.status || 500,
    });
  }
);
