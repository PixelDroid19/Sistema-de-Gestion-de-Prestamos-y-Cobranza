/** Returns the normal first due date without changing the disbursement day. */
export const getStandardFirstDueDate = (disbursementDate?: string): string | null => {
  if (!disbursementDate || !/^\d{4}-\d{2}-\d{2}$/.test(disbursementDate)) return null;
  const [year, month, day] = disbursementDate.split('-').map(Number);
  const source = new Date(Date.UTC(year, month - 1, day));
  if (source.getUTCFullYear() !== year || source.getUTCMonth() !== month - 1 || source.getUTCDate() !== day) return null;
  const targetMonth = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const due = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(day, lastDay)));
  return due.toISOString().slice(0, 10);
};
