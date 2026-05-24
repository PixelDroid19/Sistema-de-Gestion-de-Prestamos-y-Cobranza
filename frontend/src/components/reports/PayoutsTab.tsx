import React from 'react';
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
  DataTableSurface,
  FormField,
  InsightStrip,
  SelectInput,
  TextInput,
} from '../shared/Surfaces';

const formatMoney = (value: unknown) => formatCurrencyValue(value);

type PayoutsTabProps = {
  payoutFilters: { fromDate?: string; toDate?: string };
  onPayoutFiltersChange: (filters: { fromDate?: string; toDate?: string }) => void;
  payoutPage: number;
  onPayoutPageChange: (page: number) => void;
  payoutPageSize: number;
  onPayoutPageSizeChange: (size: number) => void;
  payouts: any[];
  payoutSummary: any;
  payoutPagination: any;
  isPayoutsLoading: boolean;
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
}: PayoutsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {payoutSummary && (
        <InsightStrip
          aria-label={tTerm('reports.payouts.summary.aria')}
          items={[
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

      <DataTableSurface>
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
          <h3 className="font-medium">{tTerm('reports.payouts.table.title')}</h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
              <FormField label={tTerm('reports.export.from')}>
                <TextInput
                  type="date"
                  value={payoutFilters.fromDate || ''}
                  onChange={(e) => onPayoutFiltersChange({ ...payoutFilters, fromDate: e.target.value })}
                />
              </FormField>
              <span className="pb-2.5 text-sm text-text-secondary">a</span>
              <FormField label={tTerm('reports.export.to')}>
                <TextInput
                  type="date"
                  value={payoutFilters.toDate || ''}
                  onChange={(e) => onPayoutFiltersChange({ ...payoutFilters, toDate: e.target.value })}
                />
              </FormField>
            </div>
            <FormField label={tTerm('reports.payouts.table.rows')} className="w-24">
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
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th>{tTerm('reports.payouts.table.paymentId')}</th>
                <th>{tTerm('payouts.table.loanId')}</th>
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
                  <td colSpan={9} className="table-empty-state">{tTerm('reports.payouts.table.loading')}</td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-empty-state">{tTerm('reports.payouts.table.empty')}</td>
                </tr>
              ) : (
                payouts.map((payout: any, i: number) => (
                  <tr key={`report-payout-${payout.id ?? 'no-id'}-${payout.loanId ?? 'loan'}-${payout.paymentDate ?? i}`}>
                    <td className="font-mono text-text-secondary">#{payout.id}</td>
                    <td className="font-mono text-blue-600 dark:text-blue-400">#{payout.loanId}</td>
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
          <div className="flex flex-col gap-3 border-t border-border-subtle bg-bg-surface px-4 py-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
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
      </DataTableSurface>
    </div>
  );
}
