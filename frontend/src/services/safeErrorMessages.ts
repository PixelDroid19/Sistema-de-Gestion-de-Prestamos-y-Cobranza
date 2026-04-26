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
  | 'dag'
  | 'generic';

export type SafeErrorAction =
  | 'login'
  | 'session'
  | 'profile.update'
  | 'password.change'
  | 'credit.create'
  | 'credit.simulate'
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
  | 'dag.load'
  | 'dag.save'
  | 'dag.simulate'
  | 'dag.validate'
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

const GENERIC_FALLBACK: SafeToastMessage = {
  title: 'No se pudo completar la acción',
  description: 'Intenta nuevamente en unos minutos.',
};

const DOMAIN_MESSAGES: Record<SafeErrorDomain, SafeToastMessage> = {
  auth: {
    title: 'No se pudo completar la autenticación',
    description: 'Verifica tus credenciales o vuelve a iniciar sesión.',
  },
  credits: {
    title: 'No se pudo completar la gestión del crédito',
    description: 'Revisa los datos y vuelve a intentarlo.',
  },
  payments: {
    title: 'No se pudo completar la operación de pago',
    description: 'Valida la información y vuelve a intentarlo.',
  },
  customers: {
    title: 'No se pudo completar la operación del cliente',
    description: 'Revisa la información e inténtalo nuevamente.',
  },
  associates: {
    title: 'No se pudo completar la operación del socio',
    description: 'Revisa la información e inténtalo nuevamente.',
  },
  users: {
    title: 'No se pudo completar la operación de usuario',
    description: 'Intenta nuevamente o contacta a un administrador.',
  },
  config: {
    title: 'No se pudo actualizar la configuración',
    description: 'Revisa los valores ingresados y vuelve a intentarlo.',
  },
  reports: {
    title: 'No se pudo completar la operación del reporte',
    description: 'Recarga la vista o inténtalo nuevamente en unos minutos.',
  },
  notifications: {
    title: 'No se pudieron cargar las notificaciones',
    description: 'Recarga la vista e inténtalo nuevamente.',
  },
  dag: {
    title: 'No se pudo completar la operación del grafo',
    description: 'Verifica la configuración e inténtalo nuevamente.',
  },
  generic: GENERIC_FALLBACK,
};

const ACTION_MESSAGES: Partial<Record<SafeErrorAction, SafeToastMessage>> = {
  login: {
    title: 'No se pudo iniciar sesión',
    description: 'Verifica tus credenciales e inténtalo de nuevo.',
  },
  session: {
    title: 'Tu sesión expiró o no es válida',
    description: 'Inicia sesión nuevamente para continuar.',
  },
  'profile.update': {
    title: 'No se pudo actualizar el perfil',
    description: 'Revisa los datos e inténtalo nuevamente.',
  },
  'password.change': {
    title: 'No se pudo cambiar la contraseña',
    description: 'Verifica la contraseña actual e inténtalo de nuevo.',
  },
  'credit.create': {
    title: 'No se pudo crear el crédito',
    description: 'Revisa los datos ingresados e inténtalo nuevamente.',
  },
  'credit.simulate': {
    title: 'No se pudo calcular el crédito',
    description: 'Verifica los datos ingresados e inténtalo nuevamente.',
  },
  'payment.register': {
    title: 'No se pudo registrar el pago',
    description: 'Verifica los datos del pago e inténtalo nuevamente.',
  },
  'payout.register': {
    title: 'No se pudo registrar el desembolso',
    description: 'Verifica los datos e inténtalo nuevamente.',
  },
  'customer.create': {
    title: 'No se pudo crear el cliente',
    description: 'Revisa los datos e inténtalo nuevamente.',
  },
  'customer.update': {
    title: 'No se pudo actualizar el cliente',
    description: 'Revisa los datos e inténtalo nuevamente.',
  },
  'customer.restore': {
    title: 'No se pudo restaurar el cliente',
    description: 'Recarga la lista e inténtalo nuevamente.',
  },
  'associate.create': {
    title: 'No se pudo crear el socio',
    description: 'Revisa los datos e inténtalo nuevamente.',
  },
  'associate.update': {
    title: 'No se pudo actualizar el socio',
    description: 'Revisa los datos e inténtalo nuevamente.',
  },
  'permission.grant': {
    title: 'No se pudo conceder el permiso',
    description: 'Intenta nuevamente o contacta a un administrador.',
  },
  'permission.revoke': {
    title: 'No se pudo revocar el permiso',
    description: 'Intenta nuevamente o contacta a un administrador.',
  },
  'config.update': {
    title: 'No se pudo actualizar la configuración',
    description: 'Verifica los valores e inténtalo nuevamente.',
  },
  'reports.load': {
    title: 'No se pudieron cargar los reportes',
    description: 'Recarga la vista e inténtalo nuevamente.',
  },
  'reports.export': {
    title: 'No se pudo generar la exportación',
    description: 'Intenta nuevamente en unos minutos.',
  },
  'notifications.load': {
    title: 'No se pudieron cargar las notificaciones',
    description: 'Recarga la vista e inténtalo nuevamente.',
  },
  'dag.load': {
    title: 'No se pudo cargar el grafo',
    description: 'Recarga la vista e inténtalo nuevamente.',
  },
  'dag.save': {
    title: 'No se pudo guardar el grafo',
    description: 'Verifica la configuración e inténtalo nuevamente.',
  },
  'dag.simulate': {
    title: 'No se pudo validar el cálculo',
    description: 'Revisa el grafo e inténtalo nuevamente.',
  },
  'dag.validate': {
    title: 'No se pudo validar el grafo',
    description: 'Revisa la estructura del grafo e inténtalo nuevamente.',
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
    return ACTION_MESSAGES[context.action] as SafeToastMessage;
  }

  if (context?.domain && DOMAIN_MESSAGES[context.domain]) {
    return DOMAIN_MESSAGES[context.domain];
  }

  if (context?.fallbackMessage?.trim()) {
    return {
      title: context.fallbackMessage.trim(),
      description: GENERIC_FALLBACK.description,
    };
  }

  return GENERIC_FALLBACK;
};

export const getSafeErrorMessage = (error: unknown, context?: SafeErrorContext): SafeToastMessage => {
  const base = resolveBaseMessage(context);
  const statusCode = extractStatusCode(error);
  const rawMessage = extractRawErrorMessage(error);

  if (statusCode === 401) {
    if (context?.action === 'login') {
      return {
        title: 'Correo o contraseña incorrectos',
        description: 'Verifica tus credenciales e inténtalo nuevamente.',
      };
    }

    if (context?.action === 'session' || context?.domain === 'auth') {
      return ACTION_MESSAGES.session as SafeToastMessage;
    }

    return {
      title: 'Tu sesión expiró o no es válida',
      description: 'Inicia sesión nuevamente para continuar.',
    };
  }

  if (statusCode === 403) {
    return {
      title: 'No tienes permisos para realizar esta acción',
      description: 'Si necesitas acceso, solicita apoyo a un administrador.',
    };
  }

  if (statusCode === 404) {
    return {
      title: base.title,
      description: 'La información ya no está disponible o cambió. Recarga e intenta nuevamente.',
    };
  }

  if (statusCode === 409 || isSensitiveErrorMessage(rawMessage)) {
    return base;
  }

  if (statusCode && statusCode >= 500) {
    return {
      title: base.title,
      description: 'Ocurrió un problema interno. Intenta nuevamente en unos minutos.',
    };
  }

  return base;
};

export const getSafeErrorText = (error: unknown, context?: SafeErrorContext): string => {
  const message = getSafeErrorMessage(error, context);
  return message.description ? `${message.title}. ${message.description}` : message.title;
};
