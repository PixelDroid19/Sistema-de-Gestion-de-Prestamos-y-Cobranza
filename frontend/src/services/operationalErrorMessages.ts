import type { GuardedAction } from './operationalGuards';
import { extractRawErrorMessage, extractStatusCode, isSensitiveErrorMessage } from './safeErrorMessages';
import { tTerm, type TermKey } from '../i18n/terminology';

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

type SafeMessageTemplate = {
  titleKey: TermKey;
  descriptionKey?: TermKey;
};

const GENERIC_DESCRIPTION_KEY: TermKey = 'operational.error.description.generic';

const resolveSafeMessage = (template: SafeMessageTemplate): SafeMessage => ({
  title: tTerm(template.titleKey),
  description: template.descriptionKey ? tTerm(template.descriptionKey) : undefined,
});

const OPERATOR_FACING_CAPITAL_DENIALS = [
  /^Debe existir al menos la primera cuota pagada/i,
  /^El abono a capital no puede exceder/i,
  /^El crédito (?:tiene|no tiene|ya está|cuenta)/i,
  /^El estado del crédito no permite/i,
  /^La cuota #?\d+ tiene/i,
];

const isOperatorFacingCapitalDenial = (message: string): boolean => (
  !isSensitiveErrorMessage(message)
  && OPERATOR_FACING_CAPITAL_DENIALS.some((pattern) => pattern.test(message.trim()))
);

const ACTION_MESSAGES: Record<OperationalAction, SafeMessageTemplate> = {
  'installment.pay': {
    titleKey: 'operational.error.title.installmentPay',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'installment.editPaymentMethod': {
    titleKey: 'operational.error.title.installmentEditPaymentMethod',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'installment.promise': {
    titleKey: 'operational.error.title.installmentPromise',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'installment.followUp': {
    titleKey: 'operational.error.title.installmentFollowUp',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'payout.voucher.download': {
    titleKey: 'operational.error.title.payoutVoucherDownload',
    descriptionKey: 'operational.error.description.retryLater',
  },
  'payout.credit.view': {
    titleKey: 'operational.error.title.payoutCreditView',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'payout.metadata.edit': {
    titleKey: 'operational.error.title.payoutMetadataEdit',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'payout.delete': {
    titleKey: 'operational.error.title.actionUnavailable',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'credit.view': {
    titleKey: 'operational.error.title.genericAction',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'credit.delete': {
    titleKey: 'operational.error.title.genericAction',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'credit.status.update': {
    titleKey: 'operational.error.title.creditStatusUpdate',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'credit.report.download': {
    titleKey: 'operational.error.title.genericAction',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'credit.payouts.navigate': {
    titleKey: 'operational.error.title.genericAction',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'installment.annul': {
    titleKey: 'operational.error.title.installmentAnnul',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'capital.payment': {
    titleKey: 'operational.error.title.capitalPayment',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'lateFee.update': {
    titleKey: 'operational.error.title.lateFeeUpdate',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'payout.register': {
    titleKey: 'operational.error.title.payoutRegister',
    descriptionKey: GENERIC_DESCRIPTION_KEY,
  },
  'operational.guard': {
    titleKey: 'operational.error.title.actionUnavailable',
    descriptionKey: 'operational.error.description.guard',
  },
};

export const getSafeOperationalMessage = (action: OperationalAction, error?: unknown): SafeMessage => {
  const base = ACTION_MESSAGES[action] || ACTION_MESSAGES['operational.guard'];
  const baseMessage = resolveSafeMessage(base);
  const statusCode = extractStatusCode(error);
  const rawMessage = extractRawErrorMessage(error);

  if (statusCode === 401 || statusCode === 403) {
    return {
      title: tTerm('operational.error.title.permissionDenied'),
      description: tTerm('operational.error.description.permissionDenied'),
    };
  }

  if (statusCode === 404) {
    return {
      title: baseMessage.title,
      description: tTerm('operational.error.description.notFound'),
    };
  }

  if (statusCode && statusCode >= 500) {
    return {
      title: baseMessage.title,
      description: tTerm('operational.error.description.server'),
    };
  }

  if (statusCode === 409 || isSensitiveErrorMessage(rawMessage)) {
    return {
      title: baseMessage.title,
      description: tTerm(GENERIC_DESCRIPTION_KEY),
    };
  }

  if (action === 'capital.payment' && rawMessage && isOperatorFacingCapitalDenial(rawMessage)) {
    return {
      title: baseMessage.title,
      description: rawMessage,
    };
  }

  return baseMessage;
};

export const getSafeOperationalGuardMessage = (_action: OperationalAction): SafeMessage => {
  return {
    title: tTerm('operational.error.title.actionUnavailable'),
    description: tTerm('operational.error.description.guard'),
  };
};
