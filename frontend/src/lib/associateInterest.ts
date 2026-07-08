export type AssociateInterestType = 'monthly' | 'annual';

export const getAssociateInterestRateValue = (
  associate: { interestRate?: unknown } | null | undefined,
): number | null => {
  const rawRate = associate?.interestRate;

  if (rawRate === null || rawRate === undefined) {
    return null;
  }

  if (typeof rawRate === 'string' && rawRate.trim().length === 0) {
    return null;
  }

  const normalizedRate = Number(rawRate);
  return Number.isFinite(normalizedRate) ? normalizedRate : null;
};

export const getAssociateInterestTypeValue = (
  associate: { interestType?: unknown } | null | undefined,
): AssociateInterestType | null => {
  const rawType = String(associate?.interestType || '').trim().toLowerCase();

  if (rawType === 'monthly' || rawType === 'annual') {
    return rawType;
  }

  return null;
};
