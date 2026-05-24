import { CreditCard, DollarSign, HandCoins, ReceiptText, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency as formatCurrencyValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import {
  DataTableSurface,
  FormField,
  InsightStrip,
  SelectInput,
  TextInput,
  ToolbarSurface,
} from '../shared/Surfaces';

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
}: CreditHistoryMonthlyTabProps) {
  const summary = data?.summary || {};
  const months = data?.months || [];
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
    <div className="space-y-4">
      <ToolbarSurface className="items-stretch lg:items-end">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-text-primary">{tTerm('reports.creditHistory.title')}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {tTerm('reports.creditHistory.subtitle')}
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <FormField label={tTerm('reports.creditHistory.fromDate')}>
            <TextInput
              type="date"
              value={filters.startDate}
              onChange={(event) => updateFilter('startDate', event.target.value)}
            />
          </FormField>
          <FormField label={tTerm('reports.creditHistory.toDate')}>
            <TextInput
              type="date"
              value={filters.endDate}
              onChange={(event) => updateFilter('endDate', event.target.value)}
            />
          </FormField>
          <FormField label={tTerm('reports.creditHistory.status')}>
            <SelectInput
              value={filters.status}
              onChange={(event) => updateFilter('status', event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label={tTerm('reports.creditHistory.customerId')}>
            <TextInput
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={filters.customerId}
              onChange={(event) => updateFilter('customerId', event.target.value)}
              placeholder={tTerm('reports.creditHistory.customerId.placeholder')}
            />
          </FormField>
          <FormField label={tTerm('reports.creditHistory.loanId')}>
            <TextInput
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={filters.loanId}
              onChange={(event) => updateFilter('loanId', event.target.value)}
              placeholder={tTerm('reports.creditHistory.loanId.placeholder')}
            />
          </FormField>
        </div>
      </ToolbarSurface>

      <InsightStrip
        aria-label={tTerm('reports.creditHistory.summary.aria')}
        items={[
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
            id: 'credit-history-associate-interest',
            label: tTerm('reports.creditHistory.summary.associateInterestPaid.label'),
            value: formatMoney(summary.totalAssociateInterestPaid),
            helper: tTerm('reports.creditHistory.summary.associateInterestPaid.helper'),
            icon: <HandCoins size={18} />,
            accent: 'rose',
          },
          {
            id: 'credit-history-operating-expenses',
            label: tTerm('reports.creditHistory.summary.operatingExpenses.label'),
            value: formatMoney(summary.totalOperatingExpenses),
            helper: tTerm('reports.creditHistory.summary.operatingExpenses.helper'),
            icon: <ReceiptText size={18} />,
            accent: 'amber',
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
      />

      <DataTableSurface>
        <div className="px-4 py-4 sm:px-5">
          <h3 className="font-medium">{tTerm('reports.creditHistory.table.title')}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {tTerm('reports.creditHistory.table.subtitle')}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th>{tTerm('reports.creditHistory.table.month')}</th>
                <th>{tTerm('reports.creditHistory.table.created')}</th>
                <th>{tTerm('reports.creditHistory.table.principal')}</th>
                <th>{tTerm('reports.creditHistory.table.installments')}</th>
                <th>{tTerm('reports.creditHistory.table.received')}</th>
                <th>{tTerm('reports.creditHistory.table.associateInterestPaid')}</th>
                <th>{tTerm('reports.creditHistory.table.operatingExpenses')}</th>
                <th>{tTerm('reports.creditHistory.table.gains')}</th>
                <th>{tTerm('reports.creditHistory.table.losses')}</th>
                <th>{tTerm('reports.creditHistory.table.available')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="table-empty-state">{tTerm('reports.creditHistory.table.loading')}</td>
                </tr>
              ) : months.length === 0 ? (
                <tr>
                  <td colSpan={10} className="table-empty-state">{tTerm('reports.creditHistory.table.empty')}</td>
                </tr>
              ) : (
                months.map((month) => (
                  <tr key={String(month.month)}>
                    <td className="font-medium">{String(month.month || month.monthLabel || '-')}</td>
                    <td>{formatNumberValue(month.creditsCreated)}</td>
                    <td>{formatMoney(month.createdPrincipal)}</td>
                    <td>{formatNumberValue(month.installmentsReceived)}</td>
                    <td>{formatMoney(month.paymentsReceived)}</td>
                    <td className="text-rose-600">{formatMoney(month.associateInterestPaid)}</td>
                    <td className="text-rose-600">{formatMoney(month.operatingExpenses)}</td>
                    <td className="text-emerald-600">{formatMoney(month.gains)}</td>
                    <td className="text-rose-600">{formatMoney(month.lossesAtRisk)}</td>
                    <td className="font-semibold">{formatMoney(month.availableCash)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataTableSurface>
    </div>
  );
}
