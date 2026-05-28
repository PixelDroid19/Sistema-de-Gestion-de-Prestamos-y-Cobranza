export const normalizeVisibleName = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
};
