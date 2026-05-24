/**
 * Parses report year controls using the same literal year shape accepted by
 * backend report filters. This intentionally rejects JavaScript numeric
 * coercions such as exponent notation or partially numeric text.
 * @param value Raw input value from a report year control.
 * @returns The parsed calendar year, or null when the input is not a strict year.
 */
export const parseReportYearInput = (value: unknown): number | null => {
  const normalizedValue = String(value ?? '').trim();
  if (!/^\d{4}$/.test(normalizedValue)) {
    return null;
  }

  const year = Number(normalizedValue);
  if (!Number.isSafeInteger(year) || year < 1900 || year > 9999) {
    return null;
  }

  return year;
};
