import { apiRequest } from '@/lib/api/client';

export const configService = {
  listPaymentMethods: () => apiRequest('/api/config/payment-methods'),
  createPaymentMethod: (payload) => apiRequest('/api/config/payment-methods', { method: 'POST', body: payload }),
  updatePaymentMethod: (paymentMethodId, payload) => apiRequest(`/api/config/payment-methods/${paymentMethodId}`, { method: 'PUT', body: payload }),
  deletePaymentMethod: (paymentMethodId) => apiRequest(`/api/config/payment-methods/${paymentMethodId}`, { method: 'DELETE' }),
  listSettings: () => apiRequest('/api/config/settings'),
  saveSetting: (settingKey, payload) => apiRequest(`/api/config/settings/${settingKey}`, { method: 'PUT', body: payload }),
  listCatalogs: () => apiRequest('/api/config/catalogs'),
};
