export const sanitizeNumericInputNumber = (value: number | null | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return Number.NaN;
  }

  return value;
};

export const formatNumericInputValue = (value: number | null | undefined): string => (
  Number.isFinite(value) ? String(value) : ''
);
