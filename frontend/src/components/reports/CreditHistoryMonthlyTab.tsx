import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CreditCard, DollarSign, ReceiptText, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency as formatCurrencyValue, formatDate as formatDateValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import {
  AppInput,
  CustomerSearchSelect,
  FormField,
  LoanSearchSelect,
  OperationalSelect,
} from '../shared/Surfaces';
import { ReportCollapsibleFilters } from './ReportCollapsibleFilters';
import { ReportDataTableSection } from './ReportDataTableSection';
import { ReportMetricsSection } from './ReportMetricsSection';
import { ReportTabPanel } from './ReportTabPanel';
import { TableStatusPill } from '../shared/tables';

type CreditHistoryMonthlyFilters = {
  startDate: string;
  endDate: string;
  status: string;
  customerId: string;
  loanId: string;
  financialProductId: string;
};

type CreditHistoryFinancialProductOption = {
  value: string;
  label: string;
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
  financialProductOptions?: CreditHistoryFinancialProductOption[];
  isLoading?: boolean;
  exportActions?: ReactNode;
};

const formatMoney = (value: unknown) => formatCurrencyValue(value);
const DETAIL_PAGE_SIZE_OPTIONS = [5, 10, 25];

const formatNumberValue = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? new Intl.NumberFormat('es-CO').format(number) : '0';
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
  if (normalized.includes('aprobad') || normalized.includes('activ')) {
    return 'bg-blue-100 text-blue-700';
  }
  return 'bg-slate-100 text-slate-700';
};

const getPaymentStatusClassName = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('anulad')) {
    return 'bg-slate-100 text-slate-700';
  }
  if (normalized.includes('pendient')) {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-emerald-100 text-emerald-700';
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
  financialProductOptions = [],
  isLoading = false,
  exportActions,
}: CreditHistoryMonthlyTabProps) {
  const summary = data?.summary || {};
  const months = data?.months || [];
  const credits = data?.credits || [];
  const payments = data?.payments || [];
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [loanSearchQuery, setLoanSearchQuery] = useState('');
  const [creditPage, setCreditPage] = useState(1);
  const [creditPageSize, setCreditPageSize] = useState(DETAIL_PAGE_SIZE_OPTIONS[0]);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentPageSize, setPaymentPageSize] = useState(DETAIL_PAGE_SIZE_OPTIONS[0]);
  const advancedFilterCount = [filters.customerId, filters.loanId, filters.financialProductId]
    .filter((value) => value.trim().length > 0)
    .length;

  useEffect(() => {
    setCreditPage(1);
    setPaymentPage(1);
  }, [
    filters.startDate,
    filters.endDate,
    filters.status,
    filters.customerId,
    filters.loanId,
    filters.financialProductId,
  ]);

  const creditTotalPages = Math.max(1, Math.ceil(credits.length / creditPageSize));
  const currentCreditPage = Math.min(creditPage, creditTotalPages);
  const paginatedCredits = useMemo(() => {
    const startIndex = (currentCreditPage - 1) * creditPageSize;
    return credits.slice(startIndex, startIndex + creditPageSize);
  }, [credits, creditPageSize, currentCreditPage]);
  const creditPagination = credits.length > 0
    ? {
      page: currentCreditPage,
      pageSize: creditPageSize,
      totalItems: credits.length,
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

  const paymentTotalPages = Math.max(1, Math.ceil(payments.length / paymentPageSize));
  const currentPaymentPage = Math.min(paymentPage, paymentTotalPages);
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPaymentPage - 1) * paymentPageSize;
    return payments.slice(startIndex, startIndex + paymentPageSize);
  }, [payments, paymentPageSize, currentPaymentPage]);
  const paymentPagination = payments.length > 0
    ? {
      page: currentPaymentPage,
      pageSize: paymentPageSize,
      totalItems: payments.length,
      totalPages: paymentTotalPages,
      onPrev: () => setPaymentPage((page) => Math.max(1, page - 1)),
      onNext: () => setPaymentPage((page) => Math.min(paymentTotalPages, page + 1)),
      onPageSizeChange: (pageSize: number) => {
        setPaymentPageSize(pageSize);
        setPaymentPage(1);
      },
      pageSizeOptions: DETAIL_PAGE_SIZE_OPTIONS,
    }
    : undefined;
  const updateFilter = (key: keyof CreditHistoryMonthlyFilters, value: string) => {
    if ((key === 'customerId' || key === 'loanId') && !/^\d*$/.test(value.trim())) {
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
        title={tTerm('reports.creditHistory.title')}
        subtitle={tTerm('reports.creditHistory.subtitle')}
        filterColumns={3}
        headerActions={exportActions}
        filters={(
          <>
            <FormField label={tTerm('reports.creditHistory.fromDate')}>
              <AppInput
                variant="date"
                value={filters.startDate}
                onValueChange={(v, _d, e) => updateFilter('startDate', v)}
              />
            </FormField>
            <FormField label={tTerm('reports.creditHistory.toDate')}>
              <AppInput
                variant="date"
                value={filters.endDate}
                onValueChange={(v, _d, e) => updateFilter('endDate', v)}
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
            <FormField label={tTerm('reports.creditHistory.financialProduct')}>
              <OperationalSelect
                value={filters.financialProductId}
                onChange={(event) => updateFilter('financialProductId', event.target.value)}
              >
                <option value="">{tTerm('reports.creditHistory.financialProduct.all')}</option>
                {financialProductOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </OperationalSelect>
            </FormField>
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
            <FormField label={tTerm('reports.creditHistory.loanId')}>
              <LoanSearchSelect
                id="credit-history-loan"
                selectedLoanId={filters.loanId}
                searchValue={loanSearchQuery}
                onSearchValueChange={setLoanSearchQuery}
                onSelectedLoanIdChange={(value) => updateFilter('loanId', value)}
                placeholder={tTerm('reports.creditHistory.loanSearch.placeholder')}
                listboxLabel={tTerm('reports.creditHistory.loanSearch.results')}
              />
            </FormField>
          </ReportCollapsibleFilters>
        )}
      />

      <ReportMetricsSection
        primaryAriaLabel={tTerm('reports.creditHistory.summary.aria')}
        secondaryAriaLabel={tTerm('reports.creditHistory.summary.aria')}
        primaryItems={[
          {
            id: 'credit-history-created',
            label: tTerm('reports.creditHistory.summary.created.label'),
            value: formatNumberValue(summary.creditsCreated),
            helper: tTerm('reports.creditHistory.summary.created.helper'),
            icon: <CreditCard size={18} />,
            accent: 'blue',
          },
          {
            id: 'credit-history-principal',
            label: tTerm('reports.creditHistory.summary.principal.label'),
            value: formatMoney(summary.totalPrincipalCreated),
            helper: tTerm('reports.creditHistory.summary.principal.helper'),
            icon: <DollarSign size={18} />,
            accent: 'slate',
          },
          {
            id: 'credit-history-received',
            label: tTerm('reports.creditHistory.summary.received.label'),
            value: formatMoney(summary.totalPaymentsReceived),
            helper: tTerm('reports.creditHistory.summary.received.helper'),
            icon: <Wallet size={18} />,
            accent: 'emerald',
          },
          {
            id: 'credit-history-gains',
            label: tTerm('reports.creditHistory.summary.gains.label'),
            value: formatMoney(summary.gains),
            helper: tTerm('reports.creditHistory.summary.gains.helper'),
            icon: <TrendingUp size={18} />,
            accent: 'amber',
          },
        ]}
        secondaryItems={[
          {
            id: 'credit-history-operating-expenses',
            label: tTerm('reports.creditHistory.summary.operatingExpenses.label'),
            value: formatMoney(summary.totalOperatingExpenses),
            helper: tTerm('reports.creditHistory.summary.operatingExpenses.helper'),
            icon: <ReceiptText size={18} />,
            accent: 'amber',
          },
        ]}
      />

      <ReportDataTableSection
        title={tTerm('reports.creditHistory.table.title')}
        subtitle={tTerm('reports.creditHistory.table.subtitle')}
      >
            <thead>
              <tr>
                <th>{tTerm('reports.creditHistory.table.month')}</th>
                <th>{tTerm('reports.creditHistory.table.created')}</th>
                <th>{tTerm('reports.creditHistory.table.principal')}</th>
                <th>{tTerm('reports.creditHistory.table.installments')}</th>
                <th>{tTerm('reports.creditHistory.table.received')}</th>
                <th>{tTerm('reports.creditHistory.table.operatingExpenses')}</th>
                <th>{tTerm('reports.creditHistory.table.gains')}</th>
                <th>{tTerm('reports.creditHistory.table.losses')}</th>
                <th>{tTerm('reports.creditHistory.table.available')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="table-empty-state">{tTerm('reports.creditHistory.table.loading')}</td>
                </tr>
              ) : months.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-empty-state">{tTerm('reports.creditHistory.table.empty')}</td>
                </tr>
              ) : (
                months.map((month) => (
                  <tr key={String(month.month)}>
                    <td className="font-medium">{String(month.month || month.monthLabel || '-')}</td>
                    <td>{formatNumberValue(month.creditsCreated)}</td>
                    <td>{formatMoney(month.createdPrincipal)}</td>
                    <td>{formatNumberValue(month.installmentsReceived)}</td>
                    <td>{formatMoney(month.paymentsReceived)}</td>
                    <td className="text-rose-600">{formatMoney(month.operatingExpenses)}</td>
                    <td className="text-emerald-600">{formatMoney(month.gains)}</td>
                    <td className="text-rose-600">{formatMoney(month.lossesAtRisk)}</td>
                    <td className="font-semibold">{formatMoney(month.availableCash)}</td>
                  </tr>
                ))
              )}
            </tbody>
      </ReportDataTableSection>

      <ReportDataTableSection
        title={tTerm('reports.creditHistory.creditsDetail.title')}
        subtitle={tTerm('reports.creditHistory.creditsDetail.subtitle')}
        recordsLabel={tTerm('reports.creditHistory.creditsDetail.recordsLabel')}
        pagination={creditPagination}
        isLoading={isLoading}
        hasData={credits.length > 0}
        emptyContent={<div className="table-empty-state">{tTerm('reports.creditHistory.creditsDetail.empty')}</div>}
        loadingContent={<div className="table-empty-state">{tTerm('reports.creditHistory.table.loading')}</div>}
        minWidthClassName="min-w-[1080px]"
      >
        <thead>
          <tr>
            <th>{tTerm('reports.creditHistory.creditsDetail.customer')}</th>
            <th>{tTerm('reports.creditHistory.creditsDetail.status')}</th>
            <th>{tTerm('reports.creditHistory.creditsDetail.creditDate')}</th>
            <th>{tTerm('reports.creditHistory.creditsDetail.amount')}</th>
            <th>{tTerm('reports.creditHistory.creditsDetail.principalOutstanding')}</th>
            <th>{tTerm('reports.creditHistory.creditsDetail.totalPaid')}</th>
            <th>{tTerm('reports.creditHistory.creditsDetail.interestCollected')}</th>
            <th>{tTerm('reports.creditHistory.creditsDetail.penaltyCollected')}</th>
          </tr>
        </thead>
        <tbody>
          {paginatedCredits.map((credit: CreditHistoryMonthlyDataRow, index: number) => (
            <tr key={`credit-history-detail-${String(credit.creditId || index)}`}>
              <td className="font-medium">{String(credit.customerName || tTerm('credits.label.customerFallback', { id: String(credit.creditId || '-') }))}</td>
              <td>
                <TableStatusPill className={getLoanStatusClassName(credit.status)}>
                  {String(credit.status || tTerm('common.notAvailable'))}
                </TableStatusPill>
              </td>
              <td>{formatDate(credit.creditDate) || tTerm('common.notAvailable')}</td>
              <td>{formatMoney(credit.amount)}</td>
              <td className="font-semibold">{formatMoney(credit.principalOutstanding)}</td>
              <td>{formatMoney(credit.totalPaid)}</td>
              <td className="text-emerald-600">{formatMoney(credit.interestPaid)}</td>
              <td className={Number(credit.penaltyPaid || 0) > 0 ? 'text-amber-600' : 'text-text-secondary'}>
                {formatMoney(credit.penaltyPaid)}
              </td>
            </tr>
          ))}
        </tbody>
      </ReportDataTableSection>

      <ReportDataTableSection
        title={tTerm('reports.creditHistory.collectionHistory.title')}
        subtitle={tTerm('reports.creditHistory.collectionHistory.subtitle')}
        recordsLabel={tTerm('reports.creditHistory.collectionHistory.recordsLabel')}
        pagination={paymentPagination}
        isLoading={isLoading}
        hasData={payments.length > 0}
        emptyContent={<div className="table-empty-state">{tTerm('reports.creditHistory.collectionHistory.empty')}</div>}
        loadingContent={<div className="table-empty-state">{tTerm('reports.creditHistory.table.loading')}</div>}
        minWidthClassName="min-w-[1160px]"
      >
        <thead>
          <tr>
            <th>{tTerm('reports.creditHistory.collectionHistory.paymentDate')}</th>
            <th>{tTerm('reports.creditHistory.collectionHistory.customer')}</th>
            <th>{tTerm('reports.creditHistory.collectionHistory.loan')}</th>
            <th>{tTerm('reports.creditHistory.collectionHistory.paymentType')}</th>
            <th>{tTerm('reports.creditHistory.collectionHistory.status')}</th>
            <th>{tTerm('reports.creditHistory.collectionHistory.amount')}</th>
            <th>{tTerm('reports.creditHistory.collectionHistory.principalApplied')}</th>
            <th>{tTerm('reports.creditHistory.collectionHistory.interestApplied')}</th>
            <th>{tTerm('reports.creditHistory.collectionHistory.penaltyApplied')}</th>
          </tr>
        </thead>
        <tbody>
          {paginatedPayments.map((payment: CreditHistoryMonthlyDataRow, index: number) => (
            <tr key={`credit-history-payment-${String(payment.paymentId || index)}`}>
              <td>{formatDate(payment.paymentDate) || tTerm('common.notAvailable')}</td>
              <td className="font-medium">{String(payment.customerName || tTerm('common.notAvailable'))}</td>
              <td>{tTerm('reports.creditHistory.collectionHistory.loanReference', { id: String(payment.creditId || '-') })}</td>
              <td>{String(payment.paymentType || tTerm('common.notAvailable'))}</td>
              <td>
                <TableStatusPill className={getPaymentStatusClassName(payment.status)}>
                  {String(payment.status || tTerm('common.notAvailable'))}
                </TableStatusPill>
              </td>
              <td className="font-semibold">{formatMoney(payment.amount)}</td>
              <td>{formatMoney(payment.principalApplied)}</td>
              <td className="text-emerald-600">{formatMoney(payment.interestApplied)}</td>
              <td className={Number(payment.penaltyApplied || 0) > 0 ? 'text-amber-600' : 'text-text-secondary'}>
                {formatMoney(payment.penaltyApplied)}
              </td>
            </tr>
          ))}
        </tbody>
      </ReportDataTableSection>
    </div>
  );
}
