import type { ReactNode } from 'react';
import { AlertCircle, DollarSign, TrendingUp, Wallet } from 'lucide-react';
import {
  formatCurrency as formatCurrencyValue,
  formatDate as formatDateValue,
  formatNumber as formatNumberValue,
} from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { getPaymentMethodLabel, getPaymentTypeLabel } from '../../constants/paymentTypes';
import { getChipClassName } from '../../constants/uiChips';
import {
  ActionButton,
  FormField,
  SelectInput,
  TextInput,
} from '../shared/Surfaces';
import { ReportDataTableSection } from './ReportDataTableSection';
import { ReportMetricsSection } from './ReportMetricsSection';
import { ReportTabPanel } from './ReportTabPanel';

const formatMoney = (value: unknown) => formatCurrencyValue(value);

type PayoutFilters = { fromDate?: string; toDate?: string; status?: string; paymentType?: string };

type PayoutsTabProps = {
  payoutFilters: PayoutFilters;
  onPayoutFiltersChange: (filters: PayoutFilters) => void;
  payoutPage: number;
  onPayoutPageChange: (page: number) => void;
  payoutPageSize: number;
  onPayoutPageSizeChange: (size: number) => void;
  payouts: any[];
  payoutSummary: any;
  payoutPagination: any;
  isPayoutsLoading: boolean;
  exportActions?: ReactNode;
};

export default function PayoutsTab({
  payoutFilters,
  onPayoutFiltersChange,
  payoutPage,
  onPayoutPageChange,
  payoutPageSize,
  onPayoutPageSizeChange,
  payouts,
  payoutSummary,
  payoutPagination,
  isPayoutsLoading,
  exportActions,
}: PayoutsTabProps) {
  const updateFilters = (patch: PayoutFilters) => {
    const candidateFilters = { ...payoutFilters, ...patch };
    if (candidateFilters.fromDate && candidateFilters.toDate && candidateFilters.fromDate > candidateFilters.toDate) {
      return;
    }

    const nextFilters = Object.entries(candidateFilters).reduce<PayoutFilters>(
      (acc, [key, value]) => {
        if (value) {
          acc[key as keyof PayoutFilters] = value;
        }
        return acc;
      },
      {},
    );
    onPayoutFiltersChange(nextFilters);
    onPayoutPageChange(1);
  };

  return (
    <div className="report-tab-layout">
      <ReportTabPanel
        title={tTerm('reports.payouts.panel.title')}
        subtitle={tTerm('reports.payouts.panel.subtitle')}
        filterColumns={5}
        headerActions={exportActions}
        filters={(
          <>
            <FormField label={tTerm('reports.payouts.filter.from')}>
              <TextInput
                type="date"
                value={payoutFilters.fromDate || ''}
                onChange={(event) => updateFilters({ fromDate: event.target.value })}
              />
            </FormField>
            <FormField label={tTerm('reports.payouts.filter.to')}>
              <TextInput
                type="date"
                value={payoutFilters.toDate || ''}
                onChange={(event) => updateFilters({ toDate: event.target.value })}
              />
            </FormField>
            <FormField label={tTerm('reports.payouts.filter.paymentType')}>
              <SelectInput
                value={payoutFilters.paymentType || ''}
                onChange={(event) => updateFilters({ paymentType: event.target.value })}
              >
                <option value="">{tTerm('credits.filter.all')}</option>
                <option value="installment">{getPaymentTypeLabel('installment')}</option>
                <option value="partial">{getPaymentTypeLabel('partial')}</option>
                <option value="capital">{getPaymentTypeLabel('capital')}</option>
                <option value="payoff">{getPaymentTypeLabel('payoff')}</option>
              </SelectInput>
            </FormField>
            <FormField label={tTerm('reports.payouts.filter.status')}>
              <SelectInput
                value={payoutFilters.status || ''}
                onChange={(event) => updateFilters({ status: event.target.value })}
              >
                <option value="">{tTerm('common.status.completed')}</option>
                <option value="annulled">{tTerm('reports.payouts.status.annulled')}</option>
              </SelectInput>
            </FormField>
            <FormField label={tTerm('reports.payouts.table.rows')}>
              <SelectInput
                value={payoutPageSize}
                onChange={(event) => {
                  onPayoutPageSizeChange(Number(event.target.value));
                  onPayoutPageChange(1);
                }}
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </SelectInput>
            </FormField>
          </>
        )}
      />

      {payoutSummary && (
        <ReportMetricsSection
          primaryAriaLabel={tTerm('reports.payouts.summary.aria')}
          secondaryAriaLabel={tTerm('reports.payouts.summary.aria')}
          primaryItems={[
            {
              id: 'payouts-count',
              label: tTerm('reports.payouts.summary.count.label'),
              value: formatNumberValue(payoutSummary.totalPayouts || 0),
              helper: tTerm('reports.payouts.summary.count.helper'),
              icon: <Wallet size={18} />,
              accent: 'blue',
            },
            {
              id: 'payouts-amount',
              label: tTerm('reports.payouts.summary.amount.label'),
              value: formatMoney(payoutSummary.totalAmount),
              helper: tTerm('reports.payouts.summary.amount.helper'),
              icon: <DollarSign size={18} />,
              accent: 'emerald',
            },
            {
              id: 'payouts-principal',
              label: tTerm('reports.payouts.summary.principal.label'),
              value: formatMoney(payoutSummary.totalPrincipal),
              helper: tTerm('reports.payouts.summary.principal.helper'),
              icon: <DollarSign size={18} />,
              accent: 'slate',
            },
          ]}
          secondaryItems={[
            {
              id: 'payouts-interest',
              label: tTerm('reports.payouts.summary.interest.label'),
              value: formatMoney(payoutSummary.totalInterest),
              helper: tTerm('reports.payouts.summary.interest.helper'),
              icon: <TrendingUp size={18} />,
              accent: 'emerald',
            },
            {
              id: 'payouts-penalties',
              label: tTerm('reports.payouts.summary.penalties.label'),
              value: formatMoney(payoutSummary.totalPenalties),
              helper: tTerm('reports.payouts.summary.penalties.helper'),
              icon: <AlertCircle size={18} />,
              accent: 'amber',
            },
          ]}
        />
      )}

      <ReportDataTableSection title={tTerm('reports.payouts.table.title')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th>{tTerm('payouts.table.date')}</th>
                <th>{tTerm('payouts.table.amount')}</th>
                <th>{tTerm('reports.payouts.summary.principal.label')}</th>
                <th>{tTerm('reports.payouts.summary.interest.label')}</th>
                <th>{tTerm('reports.payouts.summary.penalties.label')}</th>
                <th>{tTerm('payouts.form.paymentType')}</th>
                <th>{tTerm('payouts.table.method')}</th>
              </tr>
            </thead>
            <tbody>
              {isPayoutsLoading ? (
                <tr>
                  <td colSpan={7} className="table-empty-state">{tTerm('reports.payouts.table.loading')}</td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty-state">{tTerm('reports.payouts.table.empty')}</td>
                </tr>
              ) : (
                payouts.map((payout: any, i: number) => (
                  <tr key={`report-payout-${payout.id ?? 'no-id'}-${payout.loanId ?? 'loan'}-${payout.paymentDate ?? i}`}>
                    <td>{formatDateValue(payout.paymentDate) || tTerm('common.notAvailable')}</td>
                    <td className="font-medium">{formatMoney(payout.amount)}</td>
                    <td className="text-text-secondary">{formatMoney(payout.principalApplied)}</td>
                    <td className="text-emerald-600">{formatMoney(payout.interestApplied)}</td>
                    <td className="text-amber-600">{formatMoney(payout.penaltyApplied)}</td>
                    <td>
                      <span className={`px-2 py-1 rounded text-xs ${getChipClassName('info')}`}>
                        {getPaymentTypeLabel(payout.paymentType)}
                      </span>
                    </td>
                    <td className="text-text-secondary">{getPaymentMethodLabel(payout.paymentMethod)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {payoutPagination && payoutPagination.totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t border-border-subtle bg-bg-surface px-4 py-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              {tTerm('reports.payouts.pagination.summary', {
                from: (payoutPage - 1) * payoutPageSize + 1,
                to: Math.min(payoutPage * payoutPageSize, payoutPagination.totalItems),
                total: payoutPagination.totalItems,
              })}
            </div>
            <div className="flex gap-2">
              <ActionButton
                disabled={payoutPage === 1}
                onClick={() => onPayoutPageChange(payoutPage - 1)}
                variant="ghost"
                className="min-h-8 px-3 py-1.5 text-xs"
              >
                {tTerm('reports.payouts.pagination.previous')}
              </ActionButton>
              <ActionButton
                disabled={payoutPage === payoutPagination.totalPages}
                onClick={() => onPayoutPageChange(payoutPage + 1)}
                variant="ghost"
                className="min-h-8 px-3 py-1.5 text-xs"
              >
                {tTerm('reports.payouts.pagination.next')}
              </ActionButton>
            </div>
          </div>
        )}
      </ReportDataTableSection>
    </div>
  );
}
