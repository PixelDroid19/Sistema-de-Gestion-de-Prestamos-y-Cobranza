import axios, { AxiosError } from 'axios';
import { useSessionStore } from '../store/sessionStore';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = useSessionStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useSessionStore.getState().logout();
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
