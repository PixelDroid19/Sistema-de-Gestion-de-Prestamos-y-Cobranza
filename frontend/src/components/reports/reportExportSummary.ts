import { tTerm } from '../../i18n/terminology';

export const buildDateRangeSummary = (fromDate?: string, toDate?: string) => {
  if (fromDate && toDate) {
    return `${fromDate} – ${toDate}`;
  }
  if (fromDate) {
    return `${tTerm('reports.export.from')} ${fromDate}`;
  }
  if (toDate) {
    return `${tTerm('reports.export.to')} ${toDate}`;
  }
  return tTerm('reports.export.rangeAny');
};

export const buildCreditHistoryExportSummary = (filters: {
  startDate: string;
  endDate: string;
  status: string;
  customerId: string;
  loanId: string;
}) => {
  const parts = [buildDateRangeSummary(filters.startDate, filters.endDate)];

  if (filters.status) {
    parts.push(tTerm('reports.export.summary.status', { status: filters.status }));
  }
  if (filters.customerId.trim()) {
    parts.push(tTerm('reports.export.summary.customer', { id: filters.customerId.trim() }));
  }
  if (filters.loanId.trim()) {
    parts.push(tTerm('reports.export.summary.loan', { id: filters.loanId.trim() }));
  }

  return parts.join(' · ');
};

export const buildPayoutExportSummary = (filters: {
  fromDate?: string;
  toDate?: string;
  paymentType?: string;
  status?: string;
}) => {
  const parts = [buildDateRangeSummary(filters.fromDate, filters.toDate)];

  if (filters.paymentType) {
    parts.push(tTerm('reports.export.summary.paymentType', { type: filters.paymentType }));
  }
  if (filters.status) {
    parts.push(tTerm('reports.export.summary.payoutStatus', { status: filters.status }));
  }

  return parts.join(' · ');
};
