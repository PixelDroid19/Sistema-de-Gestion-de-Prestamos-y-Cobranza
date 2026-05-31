import { tTerm, type TermKey } from '../i18n/terminology';

export type SafeErrorDomain =
  | 'auth'
  | 'credits'
  | 'payments'
  | 'customers'
  | 'associates'
  | 'users'
  | 'config'
  | 'reports'
  | 'notifications'
  | 'generic';

export type SafeErrorAction =
  | 'login'
  | 'session'
  | 'profile.update'
  | 'password.change'
  | 'credit.create'
  | 'credit.calculate'
  | 'payment.register'
  | 'payout.register'
  | 'customer.create'
  | 'customer.update'
  | 'customer.restore'
  | 'associate.create'
  | 'associate.update'
  | 'permission.grant'
  | 'permission.revoke'
  | 'config.update'
  | 'reports.load'
  | 'reports.export'
  | 'notifications.load'
  | 'generic';

export type SafeToastMessage = {
  title: string;
  description?: string;
};

export type SafeErrorContext = {
  domain?: SafeErrorDomain;
  action?: SafeErrorAction;
  fallbackMessage?: string;
};

type SafeToastMessageTemplate = {
  titleKey: TermKey;
  descriptionKey?: TermKey;
};

const GENERIC_FALLBACK: SafeToastMessageTemplate = {
  titleKey: 'safeError.generic.title',
  descriptionKey: 'safeError.generic.description',
};

const resolveTemplate = (template: SafeToastMessageTemplate): SafeToastMessage => ({
  title: tTerm(template.titleKey),
  description: template.descriptionKey ? tTerm(template.descriptionKey) : undefined,
});

const DOMAIN_MESSAGES: Record<SafeErrorDomain, SafeToastMessageTemplate> = {
  auth: {
    titleKey: 'safeError.domain.auth.title',
    descriptionKey: 'safeError.domain.auth.description',
  },
  credits: {
    titleKey: 'safeError.domain.credits.title',
    descriptionKey: 'safeError.domain.credits.description',
  },
  payments: {
    titleKey: 'safeError.domain.payments.title',
    descriptionKey: 'safeError.domain.payments.description',
  },
  customers: {
    titleKey: 'safeError.domain.customers.title',
    descriptionKey: 'safeError.domain.customers.description',
  },
  associates: {
    titleKey: 'safeError.domain.associates.title',
    descriptionKey: 'safeError.domain.associates.description',
  },
  users: {
    titleKey: 'safeError.domain.users.title',
    descriptionKey: 'safeError.domain.users.description',
  },
  config: {
    titleKey: 'safeError.domain.config.title',
    descriptionKey: 'safeError.domain.config.description',
  },
  reports: {
    titleKey: 'safeError.domain.reports.title',
    descriptionKey: 'safeError.domain.reports.description',
  },
  notifications: {
    titleKey: 'safeError.domain.notifications.title',
    descriptionKey: 'safeError.domain.notifications.description',
  },
  generic: GENERIC_FALLBACK,
};

const ACTION_MESSAGES: Partial<Record<SafeErrorAction, SafeToastMessageTemplate>> = {
  login: {
    titleKey: 'safeError.action.login.title',
    descriptionKey: 'safeError.action.login.description',
  },
  session: {
    titleKey: 'safeError.action.session.title',
    descriptionKey: 'safeError.action.session.description',
  },
  'profile.update': {
    titleKey: 'safeError.action.profileUpdate.title',
    descriptionKey: 'safeError.action.profileUpdate.description',
  },
  'password.change': {
    titleKey: 'safeError.action.passwordChange.title',
    descriptionKey: 'safeError.action.passwordChange.description',
  },
  'credit.create': {
    titleKey: 'safeError.action.creditCreate.title',
    descriptionKey: 'safeError.action.creditCreate.description',
  },
  'credit.calculate': {
    titleKey: 'safeError.action.creditCalculate.title',
    descriptionKey: 'safeError.action.creditCalculate.description',
  },
  'payment.register': {
    titleKey: 'safeError.action.paymentRegister.title',
    descriptionKey: 'safeError.action.paymentRegister.description',
  },
  'payout.register': {
    titleKey: 'safeError.action.payoutRegister.title',
    descriptionKey: 'safeError.action.payoutRegister.description',
  },
  'customer.create': {
    titleKey: 'safeError.action.customerCreate.title',
    descriptionKey: 'safeError.action.customerCreate.description',
  },
  'customer.update': {
    titleKey: 'safeError.action.customerUpdate.title',
    descriptionKey: 'safeError.action.customerUpdate.description',
  },
  'customer.restore': {
    titleKey: 'safeError.action.customerRestore.title',
    descriptionKey: 'safeError.action.customerRestore.description',
  },
  'associate.create': {
    titleKey: 'safeError.action.associateCreate.title',
    descriptionKey: 'safeError.action.associateCreate.description',
  },
  'associate.update': {
    titleKey: 'safeError.action.associateUpdate.title',
    descriptionKey: 'safeError.action.associateUpdate.description',
  },
  'permission.grant': {
    titleKey: 'safeError.action.permissionGrant.title',
    descriptionKey: 'safeError.action.permissionGrant.description',
  },
  'permission.revoke': {
    titleKey: 'safeError.action.permissionRevoke.title',
    descriptionKey: 'safeError.action.permissionRevoke.description',
  },
  'config.update': {
    titleKey: 'safeError.action.configUpdate.title',
    descriptionKey: 'safeError.action.configUpdate.description',
  },
  'reports.load': {
    titleKey: 'safeError.action.reportsLoad.title',
    descriptionKey: 'safeError.action.reportsLoad.description',
  },
  'reports.export': {
    titleKey: 'safeError.action.reportsExport.title',
    descriptionKey: 'safeError.action.reportsExport.description',
  },
  'notifications.load': {
    titleKey: 'safeError.action.notificationsLoad.title',
    descriptionKey: 'safeError.action.notificationsLoad.description',
  },
};

const INTERNAL_ERROR_PATTERNS = [
  /sequelize|prisma|sql|constraint|foreign key|query failed/i,
  /stack|trace|exception|nullpointer|undefined/i,
  /state\s*machine|status\s*transition|payment\s*context/i,
  /Cannot\s+read\s+propert/i,
  /\bat\s+.+\(.+\)/,
  /internal\s+server\s+error|validation failed|domain rule/i,
];

export const extractRawErrorMessage = (error: unknown): string => {
  if (!error) return '';
  if (typeof error === 'string') return error;

  if (typeof error === 'object') {
    const candidate = error as {
      message?: string;
      details?: { message?: string };
      response?: {
        status?: number;
        data?: {
          message?: string;
          error?: { message?: string; code?: string; statusCode?: number };
        };
      };
    };

    return (
      candidate.response?.data?.error?.message
      || candidate.response?.data?.message
      || candidate.details?.message
      || candidate.message
      || ''
    );
  }

  return '';
};

export const extractStatusCode = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;

  const candidate = error as {
    statusCode?: number;
    details?: { statusCode?: number };
    response?: { status?: number; data?: { error?: { statusCode?: number } } };
  };

  return (
    candidate.statusCode
    || candidate.details?.statusCode
    || candidate.response?.data?.error?.statusCode
    || candidate.response?.status
  );
};

export const isSensitiveErrorMessage = (message: string): boolean => {
  if (!message.trim()) return false;
  return INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

const resolveBaseMessage = (context?: SafeErrorContext): SafeToastMessage => {
  if (context?.action && ACTION_MESSAGES[context.action]) {
    return resolveTemplate(ACTION_MESSAGES[context.action] as SafeToastMessageTemplate);
  }

  if (context?.domain && DOMAIN_MESSAGES[context.domain]) {
    return resolveTemplate(DOMAIN_MESSAGES[context.domain]);
  }

  if (context?.fallbackMessage?.trim()) {
    return {
      title: context.fallbackMessage.trim(),
      description: tTerm(GENERIC_FALLBACK.descriptionKey as TermKey),
    };
  }

  return resolveTemplate(GENERIC_FALLBACK);
};

export const getSafeErrorMessage = (error: unknown, context?: SafeErrorContext): SafeToastMessage => {
  const base = resolveBaseMessage(context);
  const statusCode = extractStatusCode(error);
  const rawMessage = extractRawErrorMessage(error);

  if (statusCode === 401) {
    if (context?.action === 'login') {
      return {
        title: tTerm('safeError.status.invalidCredentials.title'),
        description: tTerm('safeError.status.invalidCredentials.description'),
      };
    }

    if (context?.action === 'session' || context?.domain === 'auth') {
      return resolveTemplate(ACTION_MESSAGES.session as SafeToastMessageTemplate);
    }

    return {
      title: tTerm('safeError.action.session.title'),
      description: tTerm('safeError.action.session.description'),
    };
  }

  if (statusCode === 403) {
    return {
      title: tTerm('operational.error.title.permissionDenied'),
      description: tTerm('operational.error.description.permissionDenied'),
    };
  }

  if (statusCode === 404) {
    return {
      title: base.title,
      description: tTerm('safeError.status.notFound.description'),
    };
  }

  if (statusCode && statusCode >= 500) {
    return {
      title: base.title,
      description: tTerm('operational.error.description.server'),
    };
  }

  if (statusCode === 409 || isSensitiveErrorMessage(rawMessage)) {
    return base;
  }

  return base;
};

export const getSafeErrorText = (error: unknown, context?: SafeErrorContext): string => {
  const message = getSafeErrorMessage(error, context);
  return message.description ? `${message.title}. ${message.description}` : message.title;
};
