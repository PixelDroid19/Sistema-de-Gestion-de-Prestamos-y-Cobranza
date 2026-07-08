import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatCurrency as formatCurrencyValue, formatDate as formatDateValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import {
  AppInput,
  CustomerSearchSelect,
  FormField,
  OperationalSelect,
} from '../shared/Surfaces';
import { ReportCollapsibleFilters } from './ReportCollapsibleFilters';
import { ReportDataTableSection } from './ReportDataTableSection';
import { ReportTabPanel } from './ReportTabPanel';
import { TableStatusPill } from '../shared/tables';

type CreditHistoryMonthlyFilters = {
  startDate: string;
  endDate: string;
  status: string;
  customerId: string;
};

type CreditHistoryMonthlyDataRow = Record<string, unknown>;

type CreditHistoryMonthlyData = {
  summary?: Record<string, unknown>;
  months?: CreditHistoryMonthlyDataRow[];
  credits?: CreditHistoryMonthlyDataRow[];
  payments?: CreditHistoryMonthlyDataRow[];
};

type CreditHistoryMonthlyTabProps = {
  filters: CreditHistoryMonthlyFilters;
  onFiltersChange: (filters: CreditHistoryMonthlyFilters) => void;
  data?: CreditHistoryMonthlyData;
  isLoading?: boolean;
  exportActions?: ReactNode;
};

const formatMoney = (value: unknown) => formatCurrencyValue(value);
const DETAIL_PAGE_SIZE_OPTIONS = [5, 10, 25];

const pickValue = (
  record: Record<string, unknown> | undefined,
  keys: string[],
  fallback: unknown = 0,
) => {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return fallback;
};

const formatDate = (value: unknown) => formatDateValue(value);
const getLoanStatusClassName = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('mora') || normalized.includes('vencid') || normalized.includes('default')) {
    return 'bg-red-100 text-red-700';
  }
  if (normalized.includes('pagad') || normalized.includes('finaliz') || normalized.includes('cerrad')) {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (normalized.includes('pend')) {
    return 'bg-amber-100 text-amber-700';
  }
  if (normalized.includes('aprobad') || normalized.includes('activ')) {
    return 'bg-blue-100 text-blue-700';
  }
  return 'bg-slate-100 text-slate-700';
};

const getLoanStatusLabel = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return tTerm('common.notAvailable');
  }

  const labels: Record<string, string> = {
    active: tTerm('common.status.active'),
    activo: tTerm('common.status.active'),
    pending: tTerm('schedule.status.pending'),
    pendiente: tTerm('schedule.status.pending'),
    approved: tTerm('credits.status.approved'),
    aprobado: tTerm('credits.status.approved'),
    overdue: tTerm('schedule.status.overdue'),
    vencido: tTerm('schedule.status.overdue'),
    defaulted: tTerm('credits.status.defaulted'),
    paid: tTerm('schedule.status.paid'),
    pagado: tTerm('schedule.status.paid'),
    closed: tTerm('common.status.closed'),
    cerrado: tTerm('common.status.closed'),
    completed: tTerm('common.status.closed'),
  };

  return labels[normalized] || tTerm('common.status.unknown');
};

const statusOptions = [
  { value: '', label: tTerm('credits.filter.all') },
  { value: 'approved', label: tTerm('credits.status.approved') },
  { value: 'active', label: tTerm('common.status.active') },
  { value: 'overdue', label: tTerm('schedule.status.overdue') },
  { value: 'defaulted', label: tTerm('credits.status.defaulted') },
  { value: 'closed', label: tTerm('common.status.closed') },
  { value: 'paid', label: tTerm('schedule.status.paid') },
];

export default function CreditHistoryMonthlyTab({
  filters,
  onFiltersChange,
  data,
  isLoading = false,
  exportActions,
}: CreditHistoryMonthlyTabProps) {
  const credits = data?.credits || [];
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [creditPage, setCreditPage] = useState(1);
  const [creditPageSize, setCreditPageSize] = useState(DETAIL_PAGE_SIZE_OPTIONS[0]);
  const normalizedCredits = useMemo(() => credits.map((credit) => ({
    key: String(pickValue(credit, ['creditId', 'loanId', 'id'], 'credit')),
    creditId: pickValue(credit, ['creditId', 'loanId', 'id'], '-'),
    customerName: String(pickValue(credit, ['customerName', 'customer', 'customerLabel'], '')),
    status: pickValue(credit, ['status', 'statusLabel'], ''),
    creditDate: pickValue(credit, ['creditDate', 'createdAt', 'disbursementDate'], ''),
    amount: pickValue(credit, ['amount', 'principal', 'principalAmount']),
  })), [credits]);
  const advancedFilterCount = filters.customerId.trim().length > 0 ? 1 : 0;

  useEffect(() => {
    setCreditPage(1);
  }, [
    filters.startDate,
    filters.endDate,
    filters.status,
    filters.customerId,
  ]);

  const creditTotalPages = Math.max(1, Math.ceil(normalizedCredits.length / creditPageSize));
  const currentCreditPage = Math.min(creditPage, creditTotalPages);
  const paginatedCredits = useMemo(() => {
    const startIndex = (currentCreditPage - 1) * creditPageSize;
    return normalizedCredits.slice(startIndex, startIndex + creditPageSize);
  }, [creditPageSize, currentCreditPage, normalizedCredits]);
  const creditPagination = normalizedCredits.length > 0
    ? {
      page: currentCreditPage,
      pageSize: creditPageSize,
      totalItems: normalizedCredits.length,
      totalPages: creditTotalPages,
      onPrev: () => setCreditPage((page) => Math.max(1, page - 1)),
      onNext: () => setCreditPage((page) => Math.min(creditTotalPages, page + 1)),
      onPageSizeChange: (pageSize: number) => {
        setCreditPageSize(pageSize);
        setCreditPage(1);
      },
      pageSizeOptions: DETAIL_PAGE_SIZE_OPTIONS,
    }
    : undefined;

  const updateFilter = (key: keyof CreditHistoryMonthlyFilters, value: string) => {
    if (key === 'customerId' && !/^\d*$/.test(value.trim())) {
      return;
    }
    if (key === 'startDate' && value && filters.endDate && value > filters.endDate) {
      return;
    }
    if (key === 'endDate' && value && filters.startDate && value < filters.startDate) {
      return;
    }

    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="report-tab-layout">
      <ReportTabPanel
        filterColumns={3}
        headerActions={exportActions}
        filters={(
          <>
            <FormField label={tTerm('reports.creditHistory.fromDate')}>
              <AppInput
                variant="date"
                value={filters.startDate}
                onValueChange={(v) => updateFilter('startDate', v)}
              />
            </FormField>
            <FormField label={tTerm('reports.creditHistory.toDate')}>
              <AppInput
                variant="date"
                value={filters.endDate}
                onValueChange={(v) => updateFilter('endDate', v)}
              />
            </FormField>
            <FormField label={tTerm('reports.creditHistory.status')}>
              <OperationalSelect
                value={filters.status}
                onChange={(event) => updateFilter('status', event.target.value)}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </OperationalSelect>
            </FormField>
          </>
        )}
        secondaryFilters={(
          <ReportCollapsibleFilters
            activeCount={advancedFilterCount}
            defaultOpen={advancedFilterCount > 0}
            filterColumns={3}
          >
            <FormField label={tTerm('reports.creditHistory.customerId')}>
              <CustomerSearchSelect
                id="credit-history-customer"
                selectedCustomerId={filters.customerId}
                searchValue={customerSearchQuery}
                onSearchValueChange={setCustomerSearchQuery}
                onSelectedCustomerIdChange={(value) => updateFilter('customerId', value)}
                placeholder={tTerm('reports.creditHistory.customerSearch.placeholder')}
                listboxLabel={tTerm('reports.creditHistory.customerSearch.results')}
              />
            </FormField>
          </ReportCollapsibleFilters>
        )}
      />
      <ReportDataTableSection
        title={tTerm('reports.creditHistory.creditsDetail.title')}
        subtitle={tTerm('reports.creditHistory.subtitle')}
        recordsLabel={tTerm('reports.creditHistory.creditsDetail.recordsLabel')}
        pagination={creditPagination}
        isLoading={isLoading}
        hasData={normalizedCredits.length > 0}
        emptyContent={<div className="table-empty-state">{tTerm('reports.creditHistory.creditsDetail.empty')}</div>}
        loadingContent={<div className="table-empty-state">{tTerm('reports.creditHistory.table.loading')}</div>}
        minWidthClassName="min-w-[640px]"
      >
        <thead>
          <tr>
            <th>{tTerm('reports.creditHistory.creditsDetail.customer')}</th>
            <th>{tTerm('reports.creditHistory.creditsDetail.status')}</th>
            <th>{tTerm('reports.creditHistory.creditsDetail.creditDate')}</th>
            <th>{tTerm('reports.creditHistory.creditsDetail.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {paginatedCredits.map((credit) => (
            <tr key={`credit-history-detail-${credit.key}`}>
              <td>
                <div className="report-record-stack">
                  <p className="report-record-stack__title">
                    {credit.customerName || tTerm('credits.label.customerFallback', { id: String(credit.creditId) })}
                  </p>
                  <p className="report-record-stack__meta">
                    {tTerm('reports.creditHistory.collectionHistory.loanReference', { id: String(credit.creditId) })}
                  </p>
                </div>
              </td>
              <td>
                <TableStatusPill className={getLoanStatusClassName(credit.status)}>
                  {getLoanStatusLabel(credit.status)}
                </TableStatusPill>
              </td>
              <td>{formatDate(credit.creditDate) || tTerm('common.notAvailable')}</td>
              <td className="font-bold">{formatMoney(credit.amount)}</td>
            </tr>
          ))}
        </tbody>
      </ReportDataTableSection>
    </div>
  );
}
