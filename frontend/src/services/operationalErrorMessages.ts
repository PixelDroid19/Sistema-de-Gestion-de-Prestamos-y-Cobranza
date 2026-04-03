import type { GuardedAction } from './operationalGuards';
import { extractRawErrorMessage, extractStatusCode, isSensitiveErrorMessage } from './safeErrorMessages';

type OperationalAction =
  | GuardedAction
  | 'installment.annul'
  | 'capital.payment'
  | 'lateFee.update'
  | 'payout.register'
  | 'operational.guard';

type SafeMessage = {
  title: string;
  description?: string;
};

const GENERIC_DESCRIPTION = 'Verifica el estado de la operación y vuelve a intentarlo.';

const ACTION_MESSAGES: Record<OperationalAction, SafeMessage> = {
  'installment.pay': {
    title: 'No se pudo registrar el pago de la cuota',
    description: GENERIC_DESCRIPTION,
  },
  'installment.editPaymentMethod': {
    title: 'No se pudo actualizar el método de pago',
    description: GENERIC_DESCRIPTION,
  },
  'installment.promise': {
    title: 'No se pudo registrar la promesa',
    description: GENERIC_DESCRIPTION,
  },
  'installment.followUp': {
    title: 'No se pudo registrar el seguimiento',
    description: GENERIC_DESCRIPTION,
  },
  'payout.voucher.download': {
    title: 'No se pudo descargar el comprobante',
    description: 'Intenta nuevamente en unos minutos.',
  },
  'payout.credit.view': {
    title: 'No se pudo abrir el crédito asociado',
    description: GENERIC_DESCRIPTION,
  },
  'payout.metadata.edit': {
    title: 'No se pudo actualizar el pago',
    description: GENERIC_DESCRIPTION,
  },
  'payout.delete': {
    title: 'Acción no disponible',
    description: GENERIC_DESCRIPTION,
  },
  'credit.view': {
    title: 'No se pudo completar la acción',
    description: GENERIC_DESCRIPTION,
  },
  'credit.delete': {
    title: 'No se pudo completar la acción',
    description: GENERIC_DESCRIPTION,
  },
  'credit.status.update': {
    title: 'No se pudo actualizar el estado del crédito',
    description: GENERIC_DESCRIPTION,
  },
  'credit.report.download': {
    title: 'No se pudo completar la acción',
    description: GENERIC_DESCRIPTION,
  },
  'credit.payouts.navigate': {
    title: 'No se pudo completar la acción',
    description: GENERIC_DESCRIPTION,
  },
  'installment.annul': {
    title: 'No se pudo anular la cuota',
    description: GENERIC_DESCRIPTION,
  },
  'capital.payment': {
    title: 'No se pudo registrar el abono a capital',
    description: GENERIC_DESCRIPTION,
  },
  'lateFee.update': {
    title: 'No se pudo actualizar la tasa de mora',
    description: GENERIC_DESCRIPTION,
  },
  'payout.register': {
    title: 'No se pudo registrar el pago',
    description: GENERIC_DESCRIPTION,
  },
  'operational.guard': {
    title: 'Acción no disponible',
    description: 'Verifica permisos y estado de la operación antes de intentar nuevamente.',
  },
};

export const getSafeOperationalMessage = (action: OperationalAction, error?: unknown): SafeMessage => {
  const base = ACTION_MESSAGES[action] || ACTION_MESSAGES['operational.guard'];
  const statusCode = extractStatusCode(error);
  const rawMessage = extractRawErrorMessage(error);

  if (statusCode === 401 || statusCode === 403) {
    return {
      title: 'No tienes permisos para realizar esta acción',
      description: 'Si necesitas acceso, solicita apoyo a un administrador.',
    };
  }

  if (statusCode === 404) {
    return {
      title: base.title,
      description: 'La información cambió o ya no está disponible. Recarga e intenta de nuevo.',
    };
  }

  if (statusCode === 409 || isSensitiveErrorMessage(rawMessage)) {
    return {
      title: base.title,
      description: GENERIC_DESCRIPTION,
    };
  }

  if (statusCode && statusCode >= 500) {
    return {
      title: base.title,
      description: 'Ocurrió un problema interno. Intenta nuevamente en unos minutos.',
    };
  }

  return base;
};

export const getSafeOperationalGuardMessage = (action: OperationalAction): SafeMessage => {
  const base = ACTION_MESSAGES[action] || ACTION_MESSAGES['operational.guard'];
  return {
    title: base.title === 'Acción no disponible' ? base.title : 'Acción no disponible',
    description: 'Verifica permisos y estado de la operación antes de intentar nuevamente.',
  };
};
