import { useState, type ReactNode } from 'react';
import {
  formatCurrency as formatCurrencyValue,
  formatDate as formatDateValue,
  formatNumber as formatNumberValue,
} from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { getPaymentMethodLabel, getPaymentTypeLabel } from '../../constants/paymentTypes';
import { getChipClassName } from '../../constants/uiChips';
import {
  AppInput,
  FormField,
  OperationalSelect,
  UserSearchSelect,
} from '../shared/Surfaces';
import { TableStatusPill } from '../shared/tables';
import { ReportCollapsibleFilters } from './ReportCollapsibleFilters';
import { ReportDataTableSection } from './ReportDataTableSection';
import ReportSummaryGrid from './ReportSummaryGrid';
import { ReportTabPanel } from './ReportTabPanel';
import ReportValueStack from './ReportValueStack';

const formatMoney = (value: unknown) => formatCurrencyValue(value);

type PayoutFilters = { fromDate?: string; toDate?: string; status?: string; paymentType?: string; employeeId?: string };

type PayoutsTabProps = {
  payoutFilters: PayoutFilters;
  onPayoutFiltersChange: (filters: PayoutFilters) => void;
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
  return (
    creator?.name
    || creator?.email
    || payout?.createdByName
    || payout?.createdByUserName
    || payout?.registeredByName
    || tTerm('common.notAvailable')
  );
};

const getPayoutCustomerLabel = (payout: any) => (
  payout?.customerName
  || payout?.customer
  || payout?.customerLabel
  || payout?.Customer?.name
  || payout?.customer?.name
  || payout?.Loan?.Customer?.name
  || payout?.loan?.Customer?.name
  || payout?.loan?.customer?.name
  || tTerm('common.notAvailable')
);

const getPayoutLoanId = (payout: any) => (
  payout?.loanId
  ?? payout?.creditId
  ?? payout?.Loan?.id
  ?? payout?.loan?.id
  ?? null
);

const getPayoutLoanReference = (payout: any) => {
  const loanId = getPayoutLoanId(payout);
  return loanId
    ? tTerm('reports.payouts.table.loanReference', { id: String(loanId) })
    : '';
};

const getPayoutTypeValue = (payout: any) => payout?.paymentType ?? payout?.type ?? '';

const getPayoutStatusLabel = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return tTerm('common.notAvailable');
  }
  if (normalized === 'completed' || normalized === 'completado') {
    return tTerm('common.status.completed');
  }
  if (normalized === 'annulled' || normalized === 'anulado') {
    return tTerm('reports.payouts.status.annulled');
  }
  if (normalized === 'reversed' || normalized === 'reversado') {
    return tTerm('reports.payouts.status.reversed');
  }
  return tTerm('common.status.unknown');
};

const getPayoutStatusTone = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'completed' || normalized === 'completado') {
    return 'success' as const;
  }
  if (normalized === 'annulled' || normalized === 'anulado' || normalized === 'reversed' || normalized === 'reversado') {
    return 'danger' as const;
  }
  return 'warning' as const;
};

export default function PayoutsTab({
  payoutFilters,
  onPayoutFiltersChange,
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
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const advancedFilterCount = payoutFilters.employeeId ? 1 : 0;

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
        filterColumns={4}
        headerActions={exportActions}
        filters={(
          <>
            <FormField label={tTerm('reports.payouts.filter.from')}>
              <AppInput
                variant="date"
                value={payoutFilters.fromDate || ''}
                onValueChange={(v) => updateFilters({ fromDate: v })}
              />
            </FormField>
            <FormField label={tTerm('reports.payouts.filter.to')}>
              <AppInput
                variant="date"
                value={payoutFilters.toDate || ''}
                onValueChange={(v) => updateFilters({ toDate: v })}
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
                <option value="">{tTerm('credits.filter.all')}</option>
                <option value="completed">{tTerm('common.status.completed')}</option>
                <option value="annulled">{tTerm('reports.payouts.status.annulled')}</option>
              </OperationalSelect>
            </FormField>
          </>
        )}
        secondaryFilters={canFilterByEmployee ? (
          <ReportCollapsibleFilters
            activeCount={advancedFilterCount}
            defaultOpen={advancedFilterCount > 0}
            filterColumns={2}
          >
            <FormField label={tTerm('reports.payouts.filter.employee')}>
              <UserSearchSelect
                id="reports-payout-employee"
                selectedUserId={payoutFilters.employeeId || ''}
                searchValue={employeeSearchQuery}
                onSearchValueChange={setEmployeeSearchQuery}
                onSelectedUserIdChange={(value) => updateFilters({ employeeId: value })}
                placeholder={tTerm('userSearch.placeholder')}
                listboxLabel={tTerm('reports.payouts.filter.employee')}
                role="administrative"
              />
            </FormField>
          </ReportCollapsibleFilters>
        ) : undefined}
      />

      <ReportSummaryGrid
        columns={3}
        items={[
          {
            label: tTerm('reports.payouts.summary.count.label'),
            value: formatNumberValue(payoutSummary?.totalPayouts || payouts.length || 0),
          },
          {
            label: tTerm('reports.payouts.summary.amount.label'),
            value: formatMoney(payoutSummary?.totalAmount),
          },
          {
            label: tTerm('reports.payouts.summary.principal.label'),
            value: formatMoney(payoutSummary?.totalPrincipal),
          },
        ]}
      />

      <ReportDataTableSection
        title={tTerm('reports.payouts.table.title')}
        subtitle={tTerm('reports.payouts.panel.subtitle')}
        recordsLabel={tTerm('payouts.recordsLabel')}
        isLoading={isPayoutsLoading}
        hasData={payouts.length > 0}
        loadingContent={<div className="table-empty-state">{tTerm('reports.payouts.table.loading')}</div>}
        emptyContent={<div className="table-empty-state">{tTerm('reports.payouts.table.empty')}</div>}
        minWidthClassName="min-w-[820px]"
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
      >
        <thead>
          <tr>
            <th>{tTerm('reports.creditHistory.collectionHistory.paymentDate')}</th>
            <th>{tTerm('reports.payouts.table.customer')}</th>
            <th>{tTerm('reports.payouts.table.paymentType')}</th>
            <th>{tTerm('payouts.table.amount')}</th>
            <th>{tTerm('reports.payouts.table.registration')}</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout: any, index: number) => {
            const loanReference = getPayoutLoanReference(payout);
            return (
              <tr key={`report-payout-${payout.id ?? 'no-id'}-${getPayoutLoanId(payout) ?? 'loan'}-${payout.paymentDate ?? index}`}>
                <td>{formatDateValue(payout.paymentDate) || tTerm('common.notAvailable')}</td>
                <td>
                  <div className="report-record-stack">
                    <p className="report-record-stack__title">{getPayoutCustomerLabel(payout)}</p>
                    {loanReference ? <p className="report-record-stack__meta">{loanReference}</p> : null}
                  </div>
                </td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <TableStatusPill className={getChipClassName('info')}>
                      {getPaymentTypeLabel(getPayoutTypeValue(payout))}
                    </TableStatusPill>
                    <TableStatusPill className={getChipClassName(getPayoutStatusTone(payout?.status))}>
                      {getPayoutStatusLabel(payout?.status)}
                    </TableStatusPill>
                  </div>
                </td>
                <td>
                  <ReportValueStack
                    value={formatMoney(payout.amount)}
                    strong
                    meta={(
                      <span>
                        {tTerm('reports.payouts.table.allocation')}: {formatMoney(payout.principalApplied)}
                      </span>
                    )}
                  />
                </td>
                <td>
                  <div className="report-record-stack">
                    <p className="report-record-stack__title">{getPaymentMethodLabel(payout.paymentMethod)}</p>
                    <p className="report-record-stack__meta">{getPayoutCreatorLabel(payout)}</p>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </ReportDataTableSection>
    </div>
  );
}
