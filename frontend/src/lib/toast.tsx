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
import { extractValidationErrors } from '../services/apiErrors';
import { getSafeErrorMessage, type SafeErrorContext } from '../services/safeErrorMessages';
import { tTerm, type TermKey } from '../i18n/terminology';

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
  title: 'text-white! normal-case!',  // White text
  description: 'text-white/75!',
  badge: 'bg-white/10!',
  button: 'bg-white/10! hover:bg-white/15!',
};

const lightTheme: ToastTheme = {
  fill: '#FFFFFF',        // Light background
  title: 'text-gray-900! normal-case!',
  description: 'text-gray-600!',
  badge: 'bg-gray-100!',
  button: 'bg-gray-100! hover:bg-gray-200!',
};

const VALIDATION_FIELD_LABEL_KEYS: Record<string, TermKey> = {
  amount: 'toast.validation.field.amount',
  capital: 'toast.validation.field.capital',
  email: 'toast.validation.field.email',
  firstName: 'toast.validation.field.firstName',
  interestRate: 'toast.validation.field.interestRate',
  lastName: 'toast.validation.field.lastName',
  name: 'toast.validation.field.name',
  password: 'toast.validation.field.password',
  paymentDate: 'toast.validation.field.paymentDate',
  paymentMethod: 'toast.validation.field.paymentMethod',
  phone: 'toast.validation.field.phone',
  role: 'toast.validation.field.role',
  startDate: 'toast.validation.field.startDate',
  status: 'toast.validation.field.status',
  termMonths: 'toast.validation.field.termMonths',
  annualLateFeeRate: 'toast.validation.field.annualLateFeeRate',
};

const getSafeValidationFieldLabel = (field: string) => {
  const normalizedField = field
    .replace(/\[(.*?)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .at(-1)
    ?.trim();

  if (!normalizedField) return tTerm('toast.validation.field.generic');
  return tTerm(VALIDATION_FIELD_LABEL_KEYS[normalizedField] ?? 'toast.validation.field.generic');
};

const getSafeValidationMessage = (message: string) => {
  if (/required|missing|oblig/i.test(message)) {
    return tTerm('toast.validation.message.required');
  }

  if (/email|correo/i.test(message)) {
    return tTerm('toast.validation.message.email');
  }

  if (/date|fecha/i.test(message)) {
    return tTerm('toast.validation.message.date');
  }

  if (/amount|monto|number|numeric|greater|less|positive|zero|range|between|mayor|menor|rango|valor/i.test(message)) {
    return tTerm('toast.validation.message.number');
  }

  if (/permission|permiso/i.test(message)) {
    return tTerm('toast.validation.message.permission');
  }

  return tTerm('toast.validation.message.generic');
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
      title: options.title || tTerm('toast.title.success'),
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
      title: options.title || tTerm('toast.title.error'),
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
      title: options.title || tTerm('toast.title.warning'),
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
      title: options.title || tTerm('toast.title.info'),
      description: options.description,
      duration: options.duration ?? 4000,
      position: options.position,
    });
  },

  /**
   * Validation errors toast - shows multiple field errors
   * Use for: form validation errors from backend
   */
  validationErrors: (errors: ValidationError[], title = tTerm('toast.validation.title')) => {
    const description = errors
      .map((err) => `${getSafeValidationFieldLabel(err.field)}: ${getSafeValidationMessage(err.message)}`)
      .join('\n');
    return sileo.error({
      title,
      description,
      duration: 8000,
    });
  },

  /**
   * API error toast - safe by default (no backend leakage)
   * Use for: HTTP client error responses
   */
  apiError: (error: unknown, fallbackMessage = tTerm('toast.api.fallback')) => {
    const safeMessage = getSafeErrorMessage(error, {
      domain: 'generic',
      fallbackMessage,
    });

    return sileo.error({
      title: safeMessage.title,
      description: safeMessage.description,
      duration: 6000,
    });
  },

  /**
   * API error toast with contextual safe messaging
   */
  apiErrorSafe: (error: unknown, context?: SafeErrorContext) => {
    const validationErrors = extractValidationErrors(error);
    if (Array.isArray(validationErrors) && validationErrors.length > 0) {
      return toast.validationErrors(validationErrors);
    }

    const safeMessage = getSafeErrorMessage(error, context);

    return sileo.error({
      title: safeMessage.title,
      description: safeMessage.description,
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
    errorTitle = tTerm('toast.api.fallback')
  ) => {
    return sileo.promise(promise, {
      loading: { title: loadingTitle, duration: null },
      success: typeof successTitle === 'function' 
        ? (data) => ({ title: successTitle(data) })
        : { title: successTitle },
      error: (err) => {
        const safeMessage = getSafeErrorMessage(err, {
          fallbackMessage: errorTitle,
        });
        return {
          title: safeMessage.title,
          description: safeMessage.description,
        };
      },
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
