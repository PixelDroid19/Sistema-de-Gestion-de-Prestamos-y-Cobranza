import {
  formatDecimalMoneyInput,
  formatWholeMoneyInput,
  normalizeDecimalInput,
  normalizeDecimalMoneyInput,
  normalizeGroupedDecimalMoneyEdit,
  normalizeGroupedWholeMoneyEdit,
  normalizeIntegerInput,
  normalizePercentInput,
  normalizeTextInput,
  normalizeWholeMoneyInput,
} from '../../../lib/moneyInput';

export type AppInputVariant =
  | 'text'
  | 'money'
  | 'integer'
  | 'decimal'
  | 'percent'
  | 'date'
  | 'email'
  | 'tel'
  | 'password';  // for password fields; still emits canonical via onValueChange, supports icon/suffix for visibility toggle

export type AppInputChangeDetail = {
  value: string;
  displayValue: string;
  variant: AppInputVariant;
  numericValue: number | null;
};

export type AppInputNormalizeOptions = {
  allowZero?: boolean;
  minValue?: number;
  maxValue?: number;
  maxDigits?: number;
  maxDecimals?: number;
  trimText?: boolean;
  maxLength?: number;
  formatGroupedDecimals?: boolean;
};

export type AppInputDisplayOptions = Pick<AppInputNormalizeOptions, 'formatGroupedDecimals' | 'maxDecimals'>;

const ROLLBACK_SENSITIVE_VARIANTS = new Set<AppInputVariant>(['money', 'integer', 'decimal', 'percent']);
const NORMALIZED_INPUT_ROLLBACK_PATTERN = /[A-Za-z+\-]/;

export const isRollbackSensitiveVariant = (variant: AppInputVariant) => ROLLBACK_SENSITIVE_VARIANTS.has(variant);

export const shouldRollbackNumericEdit = (variant: AppInputVariant, insertedText: string | null | undefined) => {
  if (!isRollbackSensitiveVariant(variant) || !insertedText) {
    return false;
  }

  return NORMALIZED_INPUT_ROLLBACK_PATTERN.test(insertedText);
};

export const getAppInputMode = (variant: AppInputVariant) => {
  if (variant === 'money' || variant === 'integer') return 'numeric';
  if (variant === 'decimal' || variant === 'percent') return 'decimal';
  if (variant === 'email') return 'email';
  if (variant === 'tel') return 'tel';
  return undefined;
};

export const getAppInputHtmlType = (variant: AppInputVariant): 'text' | 'date' | 'email' | 'tel' | 'password' => {
  if (variant === 'date') return 'date';
  if (variant === 'email') return 'email';
  if (variant === 'tel') return 'tel';
  if (variant === 'password') return 'password';
  return 'text';
};

export const getAppInputDisplayValue = (
  variant: AppInputVariant,
  value: string,
  options: AppInputDisplayOptions = {},
) => {
  if (variant === 'money') return formatWholeMoneyInput(value);
  if (variant === 'decimal' && options.formatGroupedDecimals) {
    return formatDecimalMoneyInput(value, { maxDecimals: options.maxDecimals ?? 2 });
  }
  return value;
};

export const normalizeAppInputValue = (
  variant: AppInputVariant,
  value: string,
  options: AppInputNormalizeOptions,
  editContext?: {
    previousCanonical?: string;
    previousDisplay?: string;
    nextDisplay?: string;
  },
): string | null => {
  if (variant === 'date' || variant === 'email' || variant === 'tel') {
    return value;
  }

  if (variant === 'money') {
    if (
      editContext?.previousCanonical !== undefined
      && editContext.previousDisplay !== undefined
      && editContext.nextDisplay !== undefined
    ) {
      return normalizeGroupedWholeMoneyEdit(
        editContext.previousCanonical,
        editContext.previousDisplay,
        editContext.nextDisplay,
      );
    }

    return normalizeWholeMoneyInput(value);
  }

  if (variant === 'integer') {
    return normalizeIntegerInput(value, {
      allowZero: options.allowZero,
      min: options.minValue,
      max: options.maxValue,
      maxDigits: options.maxDigits,
    });
  }

  if (variant === 'decimal') {
    const decimalOptions = {
      allowZero: options.allowZero,
      min: options.minValue,
      max: options.maxValue,
      maxDigits: options.maxDigits,
      maxDecimals: options.maxDecimals,
    };

    if (options.formatGroupedDecimals) {
      if (
        editContext?.previousCanonical !== undefined
        && editContext.previousDisplay !== undefined
        && editContext.nextDisplay !== undefined
      ) {
        return normalizeGroupedDecimalMoneyEdit(
        editContext.previousCanonical,
        editContext.previousDisplay,
        editContext.nextDisplay,
        decimalOptions,
      );
      }

      return normalizeDecimalMoneyInput(value, decimalOptions);
    }

    return normalizeDecimalInput(value, decimalOptions);
  }

  if (variant === 'percent') {
    return normalizePercentInput(value, {
      allowZero: options.allowZero,
      min: options.minValue,
      max: options.maxValue,
      maxDigits: options.maxDigits,
      maxDecimals: options.maxDecimals,
    });
  }

  return normalizeTextInput(value, {
    trim: options.trimText,
    maxLength: typeof options.maxLength === 'number' ? options.maxLength : undefined,
  });
};

const getNormalizedNumericValue = (variant: AppInputVariant, value: string): number | null => {
  if (!value || variant === 'text' || variant === 'email' || variant === 'tel' || variant === 'date') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) || (variant !== 'money' && Number.isFinite(numericValue))
    ? numericValue
    : null;
};

export const buildAppInputChangeDetail = (
  variant: AppInputVariant,
  value: string,
  options: AppInputDisplayOptions = {},
): AppInputChangeDetail => ({
  value,
  displayValue: getAppInputDisplayValue(variant, value, options),
  variant,
  numericValue: getNormalizedNumericValue(variant, value),
});

export const resolveFormatGroupedDecimals = (
  variant: AppInputVariant,
  formatGroupedDecimals: boolean | undefined,
  prefix: unknown,
) => {
  if (formatGroupedDecimals !== undefined) {
    return formatGroupedDecimals;
  }

  return variant === 'decimal' && prefix !== undefined && prefix !== null && prefix !== '';
};
