/**
 * Toast Notification System
 * 
 * Wrapper around Sileo toast library with platform-specific styling.
 * All toast calls should go through this module to ensure consistency
 * and make future migration easier (e.g., to another toast library).
 * 
 * Usage:
 *   import { toast } from '../lib/toast';
 *   toast.success('Operation completed!');
 *   toast.error('Something went wrong');
 *   toast.validationErrors([{ field: 'email', message: 'Invalid email' }]);
 */

import { sileo, Toaster } from 'sileo';

// =============================================================================
// Types
// =============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface ToastOptions {
  title?: string;
  description?: string | React.ReactNode;
  duration?: number | null;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

export interface ToastTheme {
  fill: string;
  title: string;
  description: string;
  badge: string;
  button: string;
}

// =============================================================================
// Theme Configuration - matches platform color scheme
// =============================================================================

const platformTheme: ToastTheme = {
  fill: '#171717',        // Dark background (matches dark mode)
  title: 'text-white!',  // White text
  description: 'text-white/75!',
  badge: 'bg-white/10!',
  button: 'bg-white/10! hover:bg-white/15!',
};

const lightTheme: ToastTheme = {
  fill: '#FFFFFF',        // Light background
  title: 'text-gray-900!',
  description: 'text-gray-600!',
  badge: 'bg-gray-100!',
  button: 'bg-gray-100! hover:bg-gray-200!',
};

// =============================================================================
// Toast API - Single export for all toast types
// =============================================================================

export const toast = {
  /**
   * Success toast - green
   * Use for: successful operations, saved data, completed actions
   */
  success: (options: ToastOptions) => {
    return sileo.success({
      title: options.title || 'Éxito',
      description: options.description,
      duration: options.duration ?? 4000,
      position: options.position,
    });
  },

  /**
   * Error toast - red
   * Use for: failed operations, validation errors, server errors
   */
  error: (options: ToastOptions) => {
    return sileo.error({
      title: options.title || 'Error',
      description: options.description,
      duration: options.duration ?? 6000,
      position: options.position,
    });
  },

  /**
   * Warning toast - amber
   * Use for: cautionary actions, potential issues
   */
  warning: (options: ToastOptions) => {
    return sileo.warning({
      title: options.title || 'Advertencia',
      description: options.description,
      duration: options.duration ?? 5000,
      position: options.position,
    });
  },

  /**
   * Info toast - blue
   * Use for: informational messages, tips
   */
  info: (options: ToastOptions) => {
    return sileo.info({
      title: options.title || 'Información',
      description: options.description,
      duration: options.duration ?? 4000,
      position: options.position,
    });
  },

  /**
   * Validation errors toast - shows multiple field errors
   * Use for: form validation errors from backend
   */
  validationErrors: (errors: ValidationError[], title = 'Error de validación') => {
    const description = errors.map(err => `${err.field}: ${err.message}`).join('\n');
    return sileo.error({
      title,
      description,
      duration: 8000,
    });
  },

  /**
   * API error toast - extracts message from error response
   * Use for: Axios/fetch error responses
   */
  apiError: (error: any, fallbackMessage = 'Error de conexión') => {
    // Try to extract validation errors
    const validationErrors = error?.response?.data?.error?.validationErrors;
    if (validationErrors && Array.isArray(validationErrors)) {
      return toast.validationErrors(validationErrors);
    }

    // Try to extract simple error message
    const message = error?.response?.data?.error?.message 
      || error?.message 
      || fallbackMessage;

    return sileo.error({
      title: 'Error',
      description: message,
      duration: 6000,
    });
  },

  /**
   * Promise toast - loading -> success/error flow
   * Use for: async operations with loading state
   */
  promise: <T,>(
    promise: Promise<T>,
    loadingTitle: string,
    successTitle: string | ((data: T) => string),
    errorTitle = 'Operation failed'
  ) => {
    return sileo.promise(promise, {
      loading: { title: loadingTitle, duration: null },
      success: typeof successTitle === 'function' 
        ? (data) => ({ title: successTitle(data) })
        : { title: successTitle },
      error: (err) => ({ 
        title: errorTitle,
        description: err instanceof Error ? err.message : String(err)
      }),
    });
  },

  /**
   * Custom toast with full control
   */
  show: (options: ToastOptions) => {
    return sileo.show({
      title: options.title,
      description: options.description,
      duration: options.duration ?? 5000,
      position: options.position,
    });
  },

  /**
   * Dismiss a specific toast by id
   */
  dismiss: (id: string) => {
    return sileo.dismiss(id);
  },

  /**
   * Clear all toasts
   */
  clear: () => {
    return sileo.clear();
  },
};

// =============================================================================
// Toaster Component - add once to your app root
// =============================================================================

export { Toaster, platformTheme, lightTheme };

export default toast;
