import { useState, type ReactNode } from 'react';
import { CreditCard, DollarSign, ReceiptText, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency as formatCurrencyValue } from '../../i18n/format';
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

type CreditHistoryMonthlyFilters = {
  startDate: string;
  endDate: string;
  status: string;
  customerId: string;
  loanId: string;
};

type CreditHistoryMonthlyTabProps = {
  filters: CreditHistoryMonthlyFilters;
  onFiltersChange: (filters: CreditHistoryMonthlyFilters) => void;
  data?: {
    summary?: Record<string, unknown>;
    months?: Array<Record<string, unknown>>;
  };
  isLoading?: boolean;
  exportActions?: ReactNode;
};

const formatMoney = (value: unknown) => formatCurrencyValue(value);

const formatNumberValue = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? new Intl.NumberFormat('es-CO').format(number) : '0';
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
  const summary = data?.summary || {};
  const months = data?.months || [];
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [loanSearchQuery, setLoanSearchQuery] = useState('');
  const advancedFilterCount = [filters.customerId, filters.loanId].filter((value) => value.trim().length > 0).length;
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
            filterColumns={2}
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
    </div>
  );
}
