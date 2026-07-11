import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';
import { downloadBlob } from './blobDownload';
import { getLocalDateInputValue } from '../lib/dateInput';
import type {
  PaymentCalendarOverviewResponse,
  PaymentScheduleResponse,
  PayoutsReportFilters,
  PayoutsReportResponse,
} from '../types/reportSimulation';
import { tTerm } from '../i18n/terminology';
import type {
  CreditHistoryMonthlyFilters,
  MonthlyCashFlowFilters,
  OperatingExpenseListParams,
  PaymentCalendarOverviewFilters,
} from './queryKeys';

type ReportContextualType = 'credits' | 'payouts';
type ReportContextualFormat = 'xlsx' | 'pdf';
type ReportContextualFilters = {
  fromDate?: string;
  toDate?: string;
  customerId?: number;
  loanId?: number;
  financialProductId?: string;
  status?: string;
  paymentType?: string;
  employeeId?: string | number;
  format?: ReportContextualFormat;
};


export type OperatingExpenseStatus = 'completed' | 'annulled';

export type OperatingExpense = {
  id: number;
  amount: number | string;
  expenseDate: string;
  category: string;
  description: string;
  status: OperatingExpenseStatus;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
  annulmentReason?: string | null;
  createdBy?: { id?: number; name?: string; email?: string } | null;
  annulledBy?: { id?: number; name?: string; email?: string } | null;
};

export type OperatingExpensePayload = {
  amount: number;
  expenseDate: string;
  category: string;
  description: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
};

export type OperatingExpenseFilters = Pick<OperatingExpenseListParams, 'fromDate' | 'toDate' | 'status' | 'employeeId'>;
export type OperatingExpenseExportFormat = 'xlsx' | 'pdf';

export type CreditHistoryMonthlyReport = {
  summary?: Record<string, unknown>;
  months?: Array<Record<string, unknown>>;
  credits?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
};

const toArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value : [];

const toNumber = (value: unknown): number => {
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.-]/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toMonthLabel = (value: unknown, fallbackIndex: number): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return `${tTerm('reports.chart.disbursementRecovery.monthFallbackPrefix')} ${fallbackIndex + 1}`;
};

const pickMonthlyAmount = (entry: Record<string, unknown>, candidates: string[]): number => {
  for (const candidate of candidates) {
    if (candidate in entry) {
      return toNumber(entry[candidate]);
    }
  }

  return 0;
};

const normalizeMonthlyPerformance = (value: unknown) => {
  const rows = toArray<Record<string, unknown>>(value);

  return rows.map((entry, index) => {
    const month = toMonthLabel(entry.month ?? entry.label ?? entry.period, index);

    const disbursed = pickMonthlyAmount(entry, [
      'disbursed',
      'totalDisbursed',
      'disbursement',
      'loanAmount',
      'principal',
    ]);

    const recovered = pickMonthlyAmount(entry, [
      'recovered',
      'totalRecovered',
      'recovery',
      'collected',
      'totalCollected',
      'earnings',
      'totalEarnings',
      'value',
    ]);

    return {
      month,
      disbursed,
      recovered,
    };
  });
};

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

const toOperationalDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const getIsoWeekKey = (date: Date) => {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

const sumPayoutField = (payouts: Array<Record<string, unknown>>, keys: string[]): number => (
  payouts.reduce((total, payout) => {
    for (const key of keys) {
      if (key in payout) {
        return total + toNumber(payout[key]);
      }
    }
    return total;
  }, 0)
);

const buildPayoutCollectionAggregates = (payouts: Array<Record<string, unknown>>) => {
  const buildBuckets = () => ({
    daily: new Map<string, { installmentCount: number; totalAmount: number; totalInterest: number }>(),
    weekly: new Map<string, { installmentCount: number; totalAmount: number; totalInterest: number }>(),
    monthly: new Map<string, { installmentCount: number; totalAmount: number; totalInterest: number }>(),
  });
  const buckets = buildBuckets();

  payouts
    .filter((payout) => String(payout.status || '').toLowerCase() === 'completed')
    .forEach((payout) => {
      const paymentDate = toOperationalDate(payout.paymentDate ?? payout.date ?? payout.createdAt);
      if (!paymentDate) return;

      const keys = {
        daily: toDateKey(paymentDate),
        weekly: getIsoWeekKey(paymentDate),
        monthly: toDateKey(paymentDate).slice(0, 7),
      };

      (Object.entries(keys) as Array<[keyof typeof buckets, string]>).forEach(([bucketType, key]) => {
        const current = buckets[bucketType].get(key) || {
          installmentCount: 0,
          totalAmount: 0,
          totalInterest: 0,
        };
        current.installmentCount += 1;
        current.totalAmount += toNumber(payout.amount ?? payout.totalAmount);
        current.totalInterest += toNumber(payout.interestApplied ?? payout.interest);
        buckets[bucketType].set(key, current);
      });
    });

  return buckets;
};

const buildCollectionRowsFromAggregates = (
  aggregates: Map<string, { installmentCount: number; totalAmount: number; totalInterest: number }>,
) => (
  Array.from(aggregates.entries())
    .sort(([left], [right]) => String(right).localeCompare(String(left)))
    .map(([key, value]) => ({
      key,
      label: key,
      installmentCount: value.installmentCount,
      totalAmount: value.totalAmount,
      totalPrincipal: 0,
      totalInterest: value.totalInterest,
      totalPenalties: 0,
    }))
);

const normalizePayoutCollectionBucket = (
  value: unknown,
  fallbackLabel: string,
  aggregates?: Map<string, { installmentCount: number; totalAmount: number; totalInterest: number }>,
) => {
  const bucket = toRecord(value);
  const key = String(bucket.key ?? bucket.period ?? bucket.label ?? fallbackLabel);
  const aggregate = aggregates?.get(key);

  return {
    key,
    label: String(bucket.label ?? bucket.period ?? bucket.key ?? fallbackLabel),
    installmentCount: toNumber(bucket.installmentCount ?? bucket.installments ?? bucket.count ?? aggregate?.installmentCount),
    totalAmount: bucket.totalAmount ?? bucket.amount ?? aggregate?.totalAmount ?? 0,
    totalPrincipal: bucket.totalPrincipal ?? bucket.principal ?? 0,
    totalInterest: bucket.totalInterest ?? bucket.interest ?? aggregate?.totalInterest ?? 0,
    totalPenalties: bucket.totalPenalties ?? bucket.penalties ?? bucket.penaltyApplied ?? 0,
  };
};

const normalizePayoutCollectionBreakdown = (
  value: unknown,
  payouts: Array<Record<string, unknown>>,
) => {
  const source = toRecord(value);
  const aggregates = buildPayoutCollectionAggregates(payouts);
  const dailyBuckets = toArray(source.daily);
  const weeklyBuckets = toArray(source.weekly);
  const monthlyBuckets = toArray(source.monthly);
  return {
    daily: dailyBuckets.length > 0
      ? dailyBuckets.map((bucket) => normalizePayoutCollectionBucket(bucket, 'daily', aggregates.daily))
      : buildCollectionRowsFromAggregates(aggregates.daily),
    weekly: weeklyBuckets.length > 0
      ? weeklyBuckets.map((bucket) => normalizePayoutCollectionBucket(bucket, 'weekly', aggregates.weekly))
      : buildCollectionRowsFromAggregates(aggregates.weekly),
    monthly: monthlyBuckets.length > 0
      ? monthlyBuckets.map((bucket) => normalizePayoutCollectionBucket(bucket, 'monthly', aggregates.monthly))
      : buildCollectionRowsFromAggregates(aggregates.monthly),
  };
};

const normalizePayoutEntry = (value: unknown) => {
  const payout = toRecord(value);
  const creatorName = payout.createdByName ?? payout.createdByUserName ?? payout.registeredByName;
  const loanRecord = toRecord(payout.loan ?? payout.Loan);
  const customerRecord = toRecord(
    payout.customer
    ?? payout.Customer
    ?? loanRecord.customer
    ?? loanRecord.Customer,
  );
  const customerName = payout.customerName
    ?? payout.customerLabel
    ?? customerRecord.name;
  const loanId = payout.loanId
    ?? payout.creditId
    ?? loanRecord.id
    ?? null;

  return {
    ...payout,
    id: payout.id ?? payout.paymentId ?? payout.payoutId ?? null,
    loanId,
    creditId: loanId,
    customerName: customerName ? String(customerName) : '',
    amount: payout.amount ?? payout.totalAmount ?? 0,
    paymentDate: payout.paymentDate ?? payout.date ?? payout.createdAt ?? null,
    paymentType: payout.paymentType ?? payout.type ?? '',
    status: payout.status ?? payout.paymentStatus ?? '',
    principalApplied: payout.principalApplied ?? payout.principal ?? payout.capitalApplied ?? 0,
    interestApplied: payout.interestApplied ?? payout.interest ?? 0,
    penaltyApplied: payout.penaltyApplied ?? payout.penalties ?? payout.lateFeeApplied ?? 0,
    paymentMethod: payout.paymentMethod ?? payout.method ?? null,
    installmentNumber: payout.installmentNumber ?? payout.installment ?? null,
    createdBy: payout.createdBy
      ?? payout.CreatedBy
      ?? (creatorName ? { name: String(creatorName) } : null),
  };
};

const normalizePayoutSummary = (
  value: unknown,
  payouts: Array<Record<string, unknown>>,
) => {
  const summary = toRecord(value);
  const collectionSource = summary.collectionBreakdown ?? summary.collections;

  return {
    totalPayouts: toNumber(summary.totalPayouts ?? summary.totalPayments ?? summary.count ?? payouts.length),
    totalAmount: summary.totalAmount ?? summary.amount ?? sumPayoutField(payouts, ['amount', 'totalAmount']),
    totalPrincipal: summary.totalPrincipal ?? summary.principal ?? sumPayoutField(payouts, ['principalApplied', 'principal', 'capitalApplied']),
    totalInterest: summary.totalInterest ?? summary.interest ?? sumPayoutField(payouts, ['interestApplied', 'interest']),
    totalPenalties: summary.totalPenalties ?? summary.penalties ?? sumPayoutField(payouts, ['penaltyApplied', 'penalties', 'lateFeeApplied']),
    collectionBreakdown: normalizePayoutCollectionBreakdown(collectionSource, payouts),
  };
};

export const useReports = () => {
  const getOutstandingReport = useQuery({
    queryKey: queryKeys.reports.outstanding,
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/outstanding');
      return data;
    },
  });

  return {
    dashboardData: undefined,
    outstandingData: getOutstandingReport.data,
    recoveredData: undefined,
    recoveryData: undefined,
    monthlyPerformance: [],
    statusBreakdown: (() => {
      const backendStatuses = toArray<{ status: string; count: number }>(getOutstandingReport.data?.data?.byStatus);
      if (backendStatuses.length > 0) return backendStatuses;
      const loans = toArray<any>(getOutstandingReport.data?.data?.loans);
      const counts = loans.reduce<Record<string, number>>((acc, loan) => {
        const key = String(loan?.status || 'unknown');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return Object.entries(counts).map(([status, count]) => ({ status, count }));
    })(),
    overdueLoans: toArray<any>(
      getOutstandingReport.data?.data?.items
      ?? getOutstandingReport.data?.data?.overdueLoans
      ?? getOutstandingReport.data?.data?.loans,
    ).map((loan) => {
      const dueDate = loan?.nextInstallment?.dueDate ? new Date(loan.nextInstallment.dueDate) : null;
      const now = new Date();
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysOverdue = dueDate && dueDate.getTime() < now.getTime()
        ? Math.floor((now.getTime() - dueDate.getTime()) / msPerDay)
        : 0;

      return {
        ...loan,
        customerName: loan.customerName ?? loan.Customer?.name,
        daysOverdue,
        overdueAmount: toNumber(loan.overdueAmount ?? loan.outstandingAmount),
        remainingCapital: toNumber(loan.remainingCapital ?? loan.outstandingPrincipalAmount ?? loan.outstandingAmount),
      };
    }),
    isLoading: getOutstandingReport.isLoading,
    isError: getOutstandingReport.isError,
    error: getOutstandingReport.error,
  };
};

const normalizeDashboardData = (data: any) => {
  if (!data) return data;
  return {
    position: {
      availableCash: toNumber(data.position?.availableCash),
      receivables: toNumber(data.position?.receivables),
      capitalPlaced: toNumber(data.position?.capitalPlaced),
      associateCapital: toNumber(data.position?.associateCapital),
      associateLiabilities: toNumber(data.position?.associateLiabilities),
    },
    period: {
      collections: toNumber(data.period?.collections),
      disbursements: toNumber(data.period?.disbursements),
      operatingExpenses: toNumber(data.period?.operatingExpenses),
      associatePayments: toNumber(data.period?.associatePayments),
      netResult: toNumber(data.period?.netResult),
    },
    risk: {
      delinquentLoans: toNumber(data.risk?.delinquentLoans),
      capitalAtRisk: toNumber(data.risk?.capitalAtRisk),
      overdueAssociateObligations: toNumber(data.risk?.overdueAssociateObligations),
      overdueAssociateAmount: toNumber(data.risk?.overdueAssociateAmount),
      arrearsRate: toNumber(data.risk?.arrearsRate),
    },
    context: data.context || {},
    trend: Array.isArray(data.trend) ? data.trend : [],
  };
};

export const useDashboardReport = () => {
  const getDashboardMetrics = useQuery({
    queryKey: queryKeys.reports.dashboard,
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/dashboard');
      return data;
    },
  });

  return {
    dashboardData: normalizeDashboardData(getDashboardMetrics.data?.data),
    isLoading: getDashboardMetrics.isLoading,
    isError: getDashboardMetrics.isError,
    error: getDashboardMetrics.error,
    refetch: getDashboardMetrics.refetch,
  };
};

export const useCustomerReports = (customerId: number) => {
  const getCustomerHistory = useQuery({
    queryKey: queryKeys.reports.customerHistory(customerId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/reports/customer-history/${customerId}`);
      return data;
    },
    enabled: !!customerId,
  });

  const getCustomerCreditProfile = useQuery({
    queryKey: queryKeys.reports.customerCreditProfile(customerId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/reports/customer-credit-profile/${customerId}`);
      return data;
    },
    enabled: !!customerId,
  });

  return {
    history: getCustomerHistory.data,
    creditProfile: getCustomerCreditProfile.data,
    isLoading: getCustomerHistory.isLoading || getCustomerCreditProfile.isLoading,
  };
};

export const useCreditReports = (loanId: number) => {
  const getCreditHistory = useQuery({
    queryKey: queryKeys.reports.creditHistory(loanId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/reports/credit-history/loan/${loanId}`);
      return data;
    },
    enabled: !!loanId,
  });

  return {
    history: getCreditHistory.data?.data?.history,
    isLoading: getCreditHistory.isLoading,
  };
};

export const useMonthlyCashFlow = (year?: number, filters: MonthlyCashFlowFilters = {}) => {
  const getMonthlyCashFlow = useQuery({
    queryKey: queryKeys.reports.monthlyCashFlow(year, filters),
    queryFn: async () => {
      const params = { ...(year ? { year } : {}), ...filters };
      const { data } = await apiClient.get('/reports/cash-flow/monthly', { params });
      return data;
    },
  });

  return {
    data: getMonthlyCashFlow.data?.data,
    isLoading: getMonthlyCashFlow.isLoading,
    isError: getMonthlyCashFlow.isError,
    error: getMonthlyCashFlow.error,
  };
};

export const useCreditHistoryMonthly = (filters: CreditHistoryMonthlyFilters = {}) => {
  const getCreditHistoryMonthly = useQuery({
    queryKey: queryKeys.reports.creditHistoryMonthly(filters),
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/credit-history/monthly', { params: filters });
      return data;
    },
  });

  return {
    data: getCreditHistoryMonthly.data?.data as CreditHistoryMonthlyReport | undefined,
    isLoading: getCreditHistoryMonthly.isLoading,
    isError: getCreditHistoryMonthly.isError,
    error: getCreditHistoryMonthly.error,
  };
};

export const usePayoutsReport = (filters: PayoutsReportFilters = {}, page = 1, pageSize = 20) => {
  const getPayouts = useQuery({
    queryKey: queryKeys.reports.payouts(filters, page, pageSize),
    queryFn: async () => {
      const params = {
        ...filters,
        page,
        pageSize,
      };
      const { data } = await apiClient.get('/reports/payouts', { params });
      return data as PayoutsReportResponse;
    },
  });

  const normalizedPayouts = toArray<Record<string, unknown>>(getPayouts.data?.data?.payouts)
    .map(normalizePayoutEntry);

  const normalizedSummary = getPayouts.data?.summary || normalizedPayouts.length > 0
    ? normalizePayoutSummary(getPayouts.data?.summary, normalizedPayouts)
    : undefined;

  return {
    data: getPayouts.data?.data
      ? { ...getPayouts.data.data, payouts: normalizedPayouts }
      : undefined,
    summary: normalizedSummary,
    payouts: normalizedPayouts,
    pagination: getPayouts.data?.data?.pagination,
    isLoading: getPayouts.isLoading,
    isError: getPayouts.isError,
    error: getPayouts.error,
  };
};

export const usePaymentCalendarOverview = (
  filters: PaymentCalendarOverviewFilters = {},
  enabled = true,
) => {
  const getCalendarOverview = useQuery({
    queryKey: queryKeys.reports.paymentCalendarOverview(filters),
    queryFn: async () => {
      const { data } = await apiClient.get('/loans/calendar/overview', { params: filters });
      return (data?.data?.calendar ?? data?.data ?? {
        summary: {},
        agenda: [],
        actionableEntries: [],
        entries: [],
        nextAction: null,
      }) as PaymentCalendarOverviewResponse;
    },
    enabled,
  });

  return {
    data: getCalendarOverview.data,
    summary: getCalendarOverview.data?.summary,
    agenda: getCalendarOverview.data?.agenda || [],
    actionableEntries: getCalendarOverview.data?.actionableEntries || getCalendarOverview.data?.agenda || [],
    nextAction: getCalendarOverview.data?.nextAction || null,
    entries: getCalendarOverview.data?.entries || [],
    isLoading: getCalendarOverview.isLoading,
    isError: getCalendarOverview.isError,
    error: getCalendarOverview.error,
    refetch: getCalendarOverview.refetch,
  };
};

const normalizeScheduleStatus = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || 'pending';
};

const isPaidScheduleStatus = (value: unknown) => {
  const normalized = normalizeScheduleStatus(value);
  return normalized === 'paid' || normalized === 'completed';
};

const normalizeRatePercent = (value: unknown) => {
  const rate = toNumber(value);
  if (rate > 0 && rate <= 1) {
    return rate * 100;
  }
  return rate;
};

const normalizePaymentScheduleLoanRecord = (
  value: unknown,
  normalizedSchedule: Array<Record<string, unknown>>,
) => {
  const loan = toRecord(value);
  return {
    id: toNumber(loan.id),
    customerId: toNumber(loan.customerId),
    customerName: String(
      loan.customerName
      ?? toRecord(loan.customer).name
      ?? toRecord(loan.Customer).name
      ?? '',
    ) || null,
    amount: toNumber(loan.amount ?? loan.loanAmount ?? loan.principalAmount),
    interestRate: normalizeRatePercent(loan.interestRate ?? loan.rate),
    termMonths: toNumber(loan.termMonths ?? loan.totalInstallments ?? normalizedSchedule.length),
    startDate: String(loan.startDate ?? loan.disbursementDate ?? '') || null,
    status: String(loan.status ?? ''),
    installmentAmount: toNumber(
      loan.installmentAmount
      ?? loan.installment
      ?? normalizedSchedule[0]?.scheduledPayment,
    ) || null,
  };
};

const normalizePaymentScheduleRows = (
  value: unknown,
  baseAmount: number,
) => {
  let previousRemainingBalance = baseAmount;

  return toArray<Record<string, unknown>>(value).map((entry, index) => {
    const scheduledPayment = toNumber(entry.scheduledPayment ?? entry.amount ?? entry.payment);
    const interestComponent = toNumber(
      entry.interestComponent
      ?? entry.interestAmount
      ?? entry.interest
      ?? entry.remainingInterest,
    );
    const principalComponent = toNumber(
      entry.principalComponent
      ?? entry.principalAmount
      ?? entry.principal
      ?? Math.max(0, scheduledPayment - interestComponent),
    );

    const explicitOpeningBalance = Number(
      entry.openingBalance
      ?? entry.initialBalance
      ?? entry.balanceBefore,
    );
    const openingBalance = Number.isFinite(explicitOpeningBalance)
      ? explicitOpeningBalance
      : (index === 0 ? baseAmount : previousRemainingBalance);

    const explicitRemainingBalance = Number(
      entry.remainingBalance
      ?? entry.closingBalance
      ?? entry.balanceAfter,
    );
    const remainingBalance = Number.isFinite(explicitRemainingBalance)
      ? explicitRemainingBalance
      : Math.max(0, openingBalance - principalComponent);

    previousRemainingBalance = remainingBalance;

    const status = normalizeScheduleStatus(entry.status);
    const paidAmount = entry.paidAmount ?? entry.paidTotal ?? (isPaidScheduleStatus(status) ? scheduledPayment : null);

    return {
      ...entry,
      installmentNumber: toNumber(entry.installmentNumber ?? entry.period ?? index + 1),
      dueDate: String(entry.dueDate ?? '') || null,
      openingBalance,
      scheduledPayment,
      principalComponent,
      interestComponent,
      paidPrincipal: toNumber(entry.paidPrincipal ?? (isPaidScheduleStatus(status) ? principalComponent : 0)),
      paidInterest: toNumber(entry.paidInterest ?? (isPaidScheduleStatus(status) ? interestComponent : 0)),
      paidTotal: toNumber(paidAmount),
      remainingPrincipal: toNumber(entry.remainingPrincipal ?? Math.max(0, remainingBalance)),
      remainingInterest: toNumber(entry.remainingInterest ?? 0),
      remainingBalance,
      status,
      paidAmount: paidAmount === null ? null : toNumber(paidAmount),
      paidDate: String(entry.paidDate ?? '') || null,
      paymentId: entry.paymentId ?? null,
    };
  });
};

const normalizePaymentScheduleSummaryRecord = (
  value: unknown,
  normalizedSchedule: Array<Record<string, unknown>>,
  normalizedLoan: Record<string, unknown>,
) => {
  const summary = toRecord(value);
  const totalPrincipal = normalizedSchedule.reduce((total, entry) => total + toNumber(entry.principalComponent), 0);
  const totalInterest = normalizedSchedule.reduce((total, entry) => total + toNumber(entry.interestComponent), 0);
  const totalPayment = normalizedSchedule.reduce((total, entry) => total + toNumber(entry.scheduledPayment), 0);
  const paidInstallments = normalizedSchedule.filter((entry) => isPaidScheduleStatus(entry.status)).length;
  const totalInstallments = toNumber(
    summary.totalInstallments
    ?? normalizedLoan.termMonths
    ?? normalizedSchedule.length,
  ) || normalizedSchedule.length;
  const pendingInstallments = toNumber(
    summary.pendingInstallments
    ?? Math.max(totalInstallments - paidInstallments, 0),
  );

  return {
    totalPrincipal: (summary.totalPrincipal ?? totalPrincipal).toString(),
    totalInterest: (summary.totalInterest ?? totalInterest).toString(),
    totalPayment: (summary.totalPayment ?? summary.totalDue ?? totalPayment).toString(),
    capitalPrepayments: summary.capitalPrepayments ? String(summary.capitalPrepayments) : undefined,
    paidInstallments: toNumber(summary.paidInstallments ?? paidInstallments),
    pendingInstallments,
    totalInstallments,
  };
};

export const normalizePaymentSchedulePayload = (value: unknown) => {
  const payload = toRecord(value);
  const loanSeed = toRecord(payload.loan);
  const seedAmount = toNumber(loanSeed.amount ?? loanSeed.loanAmount ?? loanSeed.principalAmount);
  const normalizedSchedule = normalizePaymentScheduleRows(payload.schedule, seedAmount);
  const normalizedLoan = normalizePaymentScheduleLoanRecord(payload.loan, normalizedSchedule);
  const normalizedSummary = normalizePaymentScheduleSummaryRecord(
    payload.summary,
    normalizedSchedule,
    normalizedLoan,
  );

  return {
    loan: normalizedLoan,
    summary: normalizedSummary,
    schedule: normalizedSchedule,
  };
};

export const usePaymentSchedule = (loanId: number | null) => {
  const getSchedule = useQuery({
    queryKey: queryKeys.reports.paymentSchedule(loanId),
    queryFn: async () => {
      if (!loanId) throw new Error(tTerm('reports.export.invalidLoan'));
      const { data } = await apiClient.get(`/reports/payment-schedule/${loanId}`);
      return {
        ...data,
        data: normalizePaymentSchedulePayload(data?.data),
      } as PaymentScheduleResponse;
    },
    enabled: !!loanId,
  });

  return {
    data: getSchedule.data?.data,
    loan: getSchedule.data?.data?.loan,
    summary: getSchedule.data?.data?.summary,
    schedule: getSchedule.data?.data?.schedule || [],
    isLoading: getSchedule.isLoading,
    isError: getSchedule.isError,
    error: getSchedule.error,
    refetch: getSchedule.refetch,
  };
};

export const useOperatingExpenses = (
  filters: OperatingExpenseFilters = {},
  page = 1,
  pageSize = 20,
  enabled = true,
) => {
  const params = {
    ...filters,
    page,
    pageSize,
  };

  const getOperatingExpenses = useQuery({
    queryKey: queryKeys.operatingExpenses.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/operating-expenses', { params });
      return data;
    },
    enabled,
  });

  return {
    data: getOperatingExpenses.data?.data,
    expenses: (getOperatingExpenses.data?.data?.expenses || []) as OperatingExpense[],
    pagination: getOperatingExpenses.data?.data?.pagination,
    isLoading: getOperatingExpenses.isLoading,
    isError: getOperatingExpenses.isError,
    error: getOperatingExpenses.error,
  };
};

export const createOperatingExpense = async (payload: OperatingExpensePayload) => {
  const { data } = await apiClient.post('/operating-expenses', payload);
  return data;
};

export const annulOperatingExpense = async (expenseId: number, reason: string) => {
  const { data } = await apiClient.post(`/operating-expenses/${expenseId}/annul`, { reason });
  return data;
};

// === Export Functions ===

export const exportCreditsExcel = async (filters: ReportContextualFilters = {}): Promise<void> => {
  await downloadBlobWithParams({
    url: '/reports/credits/excel',
    fileName: 'credits-export.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    params: {
      startDate: filters.fromDate,
      endDate: filters.toDate,
      customerId: filters.customerId,
      loanId: filters.loanId,
    },
  });
};

export const exportCreditExcel = async (loanId: number): Promise<void> => {
  await downloadBlobWithParams({
    url: '/reports/credits/excel',
    fileName: `reporte-credito-${loanId}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    params: { loanId },
  });
};

export const downloadCreditReport = async (loanId: number): Promise<void> => {
  await downloadBlob({
    url: `/reports/credit-history/loan/${loanId}/export?format=pdf`,
    fileName: `credit-${loanId}-report.pdf`,
    mimeType: 'application/pdf',
  });
};

export const exportMonthlyCashFlowExcel = async (
  year?: number,
  filters: MonthlyCashFlowFilters = {},
): Promise<void> => {
  await downloadBlobWithParams({
    url: '/reports/cash-flow/monthly/excel',
    fileName: `cierre-contable-mensual-${year || new Date().getFullYear()}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    params: { year, ...filters },
  });
};

export const exportMonthlyCashFlowPdf = async (
  year?: number,
  filters: MonthlyCashFlowFilters = {},
): Promise<void> => {
  await downloadBlobWithParams({
    url: '/reports/cash-flow/monthly/pdf',
    fileName: `cierre-contable-mensual-${year || new Date().getFullYear()}.pdf`,
    mimeType: 'application/pdf',
    params: { year, ...filters },
  });
};

export const exportOperatingExpensesReport = async (
  format: OperatingExpenseExportFormat,
  filters: OperatingExpenseFilters = {},
): Promise<void> => {
  const fromDate = filters.fromDate || undefined;
  const toDate = filters.toDate || undefined;
  const suffix = `${fromDate || 'inicio'}_${toDate || 'hoy'}`;
  const extension = format === 'pdf' ? 'pdf' : 'xlsx';
  const mimeType = format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  await downloadBlobWithParams({
    url: '/reports/operating-expenses/export',
    fileName: `gastos_operativos_${suffix}.${extension}`,
    mimeType,
    params: {
      format,
      fromDate,
      toDate,
      status: filters.status,
      employeeId: filters.employeeId,
    },
  });
};

export const exportOutstandingReport = async (format: 'xlsx' | 'pdf'): Promise<void> => {
  const stamp = getLocalDateInputValue();
  const mimeType = format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  await downloadBlobWithParams({
    url: '/reports/outstanding/export',
    fileName: `cartera_por_cobrar_${stamp}.${format}`,
    mimeType,
    params: { format },
  });
};

const downloadBlobWithParams = async ({
  url,
  fileName,
  mimeType,
  params,
}: {
  url: string;
  fileName: string;
  mimeType: string;
  params?: Record<string, string | number | boolean | null | undefined>;
}): Promise<void> => {
  const response = await apiClient.get(url, {
    responseType: 'blob',
    params,
  });

  const blob = new Blob([response.data], { type: mimeType });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
};

export const exportContextualReport = async (
  type: ReportContextualType,
  filters: ReportContextualFilters = {},
): Promise<void> => {
  const fromDate = filters.fromDate || undefined;
  const toDate = filters.toDate || undefined;
  const suffix = `${fromDate || 'inicio'}_${toDate || 'hoy'}`;
  const format: ReportContextualFormat = filters.format || 'xlsx';

  if (type === 'credits') {
    const extension = format === 'pdf' ? 'pdf' : 'xlsx';
    const mimeType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    await downloadBlobWithParams({
      url: '/reports/credit-history/monthly/export',
      fileName: `historial_creditos_${suffix}.${extension}`,
      mimeType,
      params: {
        format,
        startDate: fromDate,
        endDate: toDate,
        customerId: filters.customerId,
        loanId: filters.loanId,
        financialProductId: filters.financialProductId,
        status: filters.status,
      },
    });
    return;
  }

  const extension = format === 'pdf' ? 'pdf' : 'xlsx';
  const mimeType = format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  await downloadBlobWithParams({
    url: '/reports/payouts/export',
    fileName: `reporte_pagos_${suffix}.${extension}`,
    mimeType,
    params: {
      format,
      startDate: fromDate,
      endDate: toDate,
      customerId: filters.customerId,
      loanId: filters.loanId,
      status: filters.status,
      paymentType: filters.paymentType,
      employeeId: filters.employeeId,
    },
  });
};
