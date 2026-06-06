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
  AppInput,
  FormField,
  OperationalSelect,
} from '../shared/Surfaces';
import { ReportDataTableSection } from './ReportDataTableSection';
import { ReportMetricsSection } from './ReportMetricsSection';
import { ReportTabPanel } from './ReportTabPanel';

const formatMoney = (value: unknown) => formatCurrencyValue(value);

type PayoutFilters = { fromDate?: string; toDate?: string; status?: string; paymentType?: string; employeeId?: string };

type ReportEmployeeOption = {
  id: number;
  label: string;
};

type PayoutsTabProps = {
  payoutFilters: PayoutFilters;
  onPayoutFiltersChange: (filters: PayoutFilters) => void;
  employees?: ReportEmployeeOption[];
  canFilterByEmployee?: boolean;
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

const getPayoutCreatorLabel = (payout: any) => {
  const creator = payout?.createdBy || payout?.CreatedBy;
  return creator?.name || creator?.email || tTerm('common.notAvailable');
};

const getLatestCollectionBucket = (buckets: any[] | undefined) => (
  Array.isArray(buckets) && buckets.length > 0 ? buckets[0] : null
);

export default function PayoutsTab({
  payoutFilters,
  onPayoutFiltersChange,
  employees = [],
  canFilterByEmployee = false,
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
  const latestDailyCollection = getLatestCollectionBucket(payoutSummary?.collectionBreakdown?.daily);
  const latestWeeklyCollection = getLatestCollectionBucket(payoutSummary?.collectionBreakdown?.weekly);
  const latestMonthlyCollection = getLatestCollectionBucket(payoutSummary?.collectionBreakdown?.monthly);
  const collectionRows = [
    { id: 'daily', label: tTerm('reports.payouts.collections.daily'), bucket: latestDailyCollection },
    { id: 'weekly', label: tTerm('reports.payouts.collections.weekly'), bucket: latestWeeklyCollection },
    { id: 'monthly', label: tTerm('reports.payouts.collections.monthly'), bucket: latestMonthlyCollection },
  ];

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
              <AppInput
                variant="date"
                value={payoutFilters.fromDate || ''}
                onValueChange={(v, _d, e) => updateFilters({ fromDate: v })}
              />
            </FormField>
            <FormField label={tTerm('reports.payouts.filter.to')}>
              <AppInput
                variant="date"
                value={payoutFilters.toDate || ''}
                onValueChange={(v, _d, e) => updateFilters({ toDate: v })}
              />
            </FormField>
            <FormField label={tTerm('reports.payouts.filter.paymentType')}>
              <OperationalSelect
                value={payoutFilters.paymentType || ''}
                onChange={(event) => updateFilters({ paymentType: event.target.value })}
              >
                <option value="">{tTerm('credits.filter.all')}</option>
                <option value="installment">{getPaymentTypeLabel('installment')}</option>
                <option value="partial">{getPaymentTypeLabel('partial')}</option>
                <option value="capital">{getPaymentTypeLabel('capital')}</option>
                <option value="payoff">{getPaymentTypeLabel('payoff')}</option>
              </OperationalSelect>
            </FormField>
            <FormField label={tTerm('reports.payouts.filter.status')}>
              <OperationalSelect
                value={payoutFilters.status || ''}
                onChange={(event) => updateFilters({ status: event.target.value })}
              >
                <option value="">{tTerm('common.status.completed')}</option>
                <option value="annulled">{tTerm('reports.payouts.status.annulled')}</option>
              </OperationalSelect>
            </FormField>
            {canFilterByEmployee && (
              <FormField label={tTerm('reports.payouts.filter.employee')}>
                <OperationalSelect
                  value={payoutFilters.employeeId || ''}
                  onChange={(event) => updateFilters({ employeeId: event.target.value })}
                >
                  <option value="">{tTerm('reports.payouts.filter.allEmployees')}</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.label}</option>
                  ))}
                </OperationalSelect>
              </FormField>
            )}
            <FormField label={tTerm('reports.payouts.table.rows')}>
              <OperationalSelect
                value={payoutPageSize}
                onChange={(event) => {
                  onPayoutPageSizeChange(Number(event.target.value));
                  onPayoutPageChange(1);
                }}
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </OperationalSelect>
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

      <ReportDataTableSection
        title={tTerm('reports.payouts.collections.title')}
        subtitle={tTerm('reports.payouts.collections.subtitle')}
        statePresentation="inline"
        recordsLabel={tTerm('reports.payouts.collections.recordsLabel')}
      >
        <thead>
          <tr>
            <th>{tTerm('reports.payouts.collections.periodType')}</th>
            <th>{tTerm('reports.payouts.collections.period')}</th>
            <th>{tTerm('reports.payouts.collections.installments')}</th>
            <th>{tTerm('reports.payouts.collections.amount')}</th>
            <th>{tTerm('reports.payouts.summary.interest.label')}</th>
          </tr>
        </thead>
        <tbody>
          {isPayoutsLoading ? (
            <tr>
              <td colSpan={5} className="table-empty-state">{tTerm('reports.payouts.table.loading')}</td>
            </tr>
          ) : collectionRows.every((row) => !row.bucket) ? (
            <tr>
              <td colSpan={5} className="table-empty-state">{tTerm('reports.payouts.collections.empty')}</td>
            </tr>
          ) : (
            collectionRows.map((row) => (
              <tr key={`payout-collection-${row.id}`}>
                <td className="font-medium">{row.label}</td>
                <td className="text-text-secondary">{row.bucket?.label || tTerm('common.notAvailable')}</td>
                <td>{formatNumberValue(row.bucket?.installmentCount || 0)}</td>
                <td className="font-medium">{formatMoney(row.bucket?.totalAmount || 0)}</td>
                <td className="text-emerald-600">{formatMoney(row.bucket?.totalInterest || 0)}</td>
              </tr>
            ))
          )}
        </tbody>
      </ReportDataTableSection>

      <ReportDataTableSection
        title={tTerm('reports.payouts.table.title')}
        statePresentation="inline"
        pagination={
          payoutPagination && payoutPagination.totalPages > 1
            ? {
              page: payoutPage,
              pageSize: payoutPageSize,
              totalItems: payoutPagination.totalItems,
              totalPages: payoutPagination.totalPages,
              onPrev: () => onPayoutPageChange(payoutPage - 1),
              onNext: () => onPayoutPageChange(payoutPage + 1),
              onPageSizeChange: onPayoutPageSizeChange,
            }
            : undefined
        }
        recordsLabel={tTerm('payouts.recordsLabel')}
      >
            <thead>
              <tr>
                <th>{tTerm('payouts.table.date')}</th>
                <th>{tTerm('payouts.table.amount')}</th>
                <th>{tTerm('reports.payouts.summary.principal.label')}</th>
                <th>{tTerm('reports.payouts.summary.interest.label')}</th>
                <th>{tTerm('reports.payouts.summary.penalties.label')}</th>
                <th>{tTerm('payouts.form.paymentType')}</th>
                <th>{tTerm('payouts.table.method')}</th>
                <th>{tTerm('reports.payouts.table.createdBy')}</th>
              </tr>
            </thead>
            <tbody>
              {isPayoutsLoading ? (
                <tr>
                  <td colSpan={8} className="table-empty-state">{tTerm('reports.payouts.table.loading')}</td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty-state">{tTerm('reports.payouts.table.empty')}</td>
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
                    <td className="text-text-secondary">{getPayoutCreatorLabel(payout)}</td>
                  </tr>
                ))
              )}
            </tbody>
      </ReportDataTableSection>
    </div>
  );
}
