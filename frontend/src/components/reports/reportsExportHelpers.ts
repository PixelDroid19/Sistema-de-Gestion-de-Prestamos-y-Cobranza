export type ReportExportType = 'credits' | 'payouts' | 'profitability';

export type ReportExportFormat = 'xlsx' | 'pdf';

export type ContextualExportParams = {
  fromDate?: string;
  toDate?: string;
  status?: string;
  format?: ReportExportFormat;
  paymentType?: string;
  customerId?: number;
  loanId?: number;
};

export const parseOptionalPositiveId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || !/^[1-9]\d*$/.test(trimmed)) {
    return undefined;
  }

  return Number(trimmed);
};

export const hasInvalidExportRange = (fromDate: string, toDate: string) => (
  Boolean(fromDate && toDate && fromDate > toDate)
);

export const buildContextualExportParams = (
  type: ReportExportType,
  input: {
    fromDate?: string;
    toDate?: string;
    status?: string;
    format?: ReportExportFormat;
    paymentType?: string;
    customerId?: number;
    loanId?: number;
  },
): ContextualExportParams => {
  const params: ContextualExportParams = {
    fromDate: input.fromDate || undefined,
    toDate: input.toDate || undefined,
  };

  if (type === 'profitability') {
    return params;
  }

  if (type === 'credits' || type === 'payouts') {
    if (input.status) {
      params.status = input.status;
    }
  }

  if (type === 'credits' || type === 'payouts') {
    params.format = input.format;
  }

  if (type === 'payouts' && input.paymentType) {
    params.paymentType = input.paymentType;
  }

  if ((type === 'credits' || type === 'payouts') && input.customerId) {
    params.customerId = input.customerId;
  }

  if ((type === 'credits' || type === 'payouts') && input.loanId) {
    params.loanId = input.loanId;
  }

  return params;
};
