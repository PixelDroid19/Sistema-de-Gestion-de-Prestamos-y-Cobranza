import { Eye } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { formatCurrency as formatCurrencyValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import {
  AppInput,
  FormField,
} from '../shared/Surfaces';
import { ReportDataTableSection } from './ReportDataTableSection';
import { ReportTabPanel } from './ReportTabPanel';
import CustomerProfitabilityDetailModal from './CustomerProfitabilityDetailModal';
import {
  RowActionsWithOverflow,
  TableActionsCell,
  TableActionsHeader,
  TableStatusPill,
} from '../shared/tables';

const formatMoney = (value: unknown) => formatCurrencyValue(value);
const toNumber = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};
const getCustomerName = (item: any) => item?.customerName || tTerm('credits.label.customerFallback', { id: item?.customerId });
const getLoanCount = (item: any) => toNumber(item?.loanCount ?? item?.totalLoans);

const getPaymentBehaviorLabel = (value: unknown) => {
  const key = String(value || 'current');
  if (key === 'critical') return tTerm('reports.profitability.behavior.critical');
  if (key === 'delinquent') return tTerm('reports.profitability.behavior.delinquent');
  if (key === 'without_payments') return tTerm('reports.profitability.behavior.withoutPayments');
  return tTerm('reports.profitability.behavior.current');
};

const getRiskLabel = (value: unknown) => {
  const key = String(value || 'low');
  if (key === 'high') return tTerm('reports.profitability.risk.high');
  if (key === 'medium') return tTerm('reports.profitability.risk.medium');
  return tTerm('reports.profitability.risk.low');
};

const getRiskClassName = (value: unknown) => {
  const key = String(value || 'low');
  if (key === 'high') return 'bg-red-100 text-red-700';
  if (key === 'medium') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
};

type ProfitabilityTabProps = {
  profitabilityData: any[];
  customerAnalytics?: any;
  profitabilityDateRange: { fromDate: string; toDate: string };
  onProfitabilityDateRangeChange: (key: 'fromDate' | 'toDate', value: string) => void;
  exportActions?: ReactNode;
};

export default function ProfitabilityTab({
  profitabilityData,
  customerAnalytics,
  profitabilityDateRange,
  onProfitabilityDateRangeChange,
  exportActions,
}: ProfitabilityTabProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; name: string; snapshot?: any } | null>(null);
  const customerControlRows = [...profitabilityData].sort((left, right) => {
    const riskWeight = (row: any) => (row.riskLevel === 'high' ? 3 : row.riskLevel === 'medium' ? 2 : 1);
    return (
      riskWeight(right) - riskWeight(left)
      || toNumber(right.overdueLoanCount) - toNumber(left.overdueLoanCount)
      || toNumber(right.outstandingBalance) - toNumber(left.outstandingBalance)
      || toNumber(right.totalLoans) - toNumber(left.totalLoans)
    );
  });
  const analyticsSummary = customerAnalytics?.summary || {};
  const topByLoanCount = Array.isArray(customerAnalytics?.topByLoanCount) ? customerAnalytics.topByLoanCount : [];
  const topByOutstandingBalance = Array.isArray(customerAnalytics?.topByOutstandingBalance) ? customerAnalytics.topByOutstandingBalance : [];
  const delinquentCustomers = Array.isArray(customerAnalytics?.delinquentCustomers) ? customerAnalytics.delinquentCustomers : [];
  const delinquentCustomerCount = toNumber(analyticsSummary?.delinquentCustomerCount);

  return (
    <div className="report-tab-layout">
      <ReportTabPanel
        title={tTerm('reports.profitability.title')}
        subtitle={tTerm('reports.profitability.subtitle')}
        headerActions={exportActions}
        filterColumns={2}
        filters={(
          <>
            <FormField label={tTerm('reports.export.from')}>
              <AppInput
                variant="date"
                value={profitabilityDateRange.fromDate}
                onValueChange={(value) => onProfitabilityDateRangeChange('fromDate', value)}
              />
            </FormField>
            <FormField label={tTerm('reports.export.to')}>
              <AppInput
                variant="date"
                value={profitabilityDateRange.toDate}
                onValueChange={(value) => onProfitabilityDateRangeChange('toDate', value)}
              />
            </FormField>
          </>
        )}
      />

      <ReportDataTableSection
        title={tTerm('reports.profitability.topLoanCount.title')}
        subtitle={tTerm('reports.profitability.topLoanCount.subtitle')}
        minWidthClassName="min-w-[720px]"
      >
        <thead>
          <tr>
            <th>{tTerm('reports.profitability.customer')}</th>
            <th>{tTerm('reports.profitability.topLoanCount.loanCount')}</th>
            <th>{tTerm('reports.profitability.customerControl.outstanding')}</th>
            <th>{tTerm('reports.profitability.customerControl.risk')}</th>
          </tr>
        </thead>
        <tbody>
          {topByLoanCount.length === 0 ? (
            <tr>
              <td colSpan={4} className="table-empty-state">{tTerm('reports.profitability.topLoanCount.empty')}</td>
            </tr>
          ) : topByLoanCount.map((item: any, index: number) => (
            <tr key={`top-loan-count-${item.customerId || index}`}>
              <td className="font-medium">{getCustomerName(item)}</td>
              <td>
                <p className="font-semibold text-text-primary">
                  {tTerm('reports.profitability.customerControl.loanCount', { count: getLoanCount(item) })}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {tTerm('reports.profitability.customerControl.loanMix', {
                    active: toNumber(item.activeLoanCount),
                    closed: toNumber(item.closedLoanCount),
                  })}
                </p>
              </td>
              <td className={toNumber(item.outstandingBalance) > 0 ? 'font-semibold text-text-primary' : 'text-text-secondary'}>
                {formatMoney(item.outstandingBalance)}
              </td>
              <td>
                <TableStatusPill className={getRiskClassName(item.riskLevel)}>
                  {getRiskLabel(item.riskLevel)}
                </TableStatusPill>
              </td>
            </tr>
          ))}
        </tbody>
      </ReportDataTableSection>

      <ReportDataTableSection
        title={tTerm('reports.profitability.topOutstanding.title')}
        subtitle={tTerm('reports.profitability.topOutstanding.subtitle')}
        minWidthClassName="min-w-[720px]"
      >
        <thead>
          <tr>
            <th>{tTerm('reports.profitability.customer')}</th>
            <th>{tTerm('reports.profitability.customerControl.outstanding')}</th>
            <th>{tTerm('reports.profitability.customerControl.creditHistory')}</th>
            <th>{tTerm('reports.profitability.customerControl.behavior')}</th>
          </tr>
        </thead>
        <tbody>
          {topByOutstandingBalance.length === 0 ? (
            <tr>
              <td colSpan={4} className="table-empty-state">{tTerm('reports.profitability.topOutstanding.empty')}</td>
            </tr>
          ) : topByOutstandingBalance.map((item: any, index: number) => (
            <tr key={`top-outstanding-${item.customerId || index}`}>
              <td className="font-medium">{getCustomerName(item)}</td>
              <td className={toNumber(item.outstandingBalance) > 0 ? 'font-semibold text-text-primary' : 'text-text-secondary'}>
                {formatMoney(item.outstandingBalance)}
              </td>
              <td>
                <p className="font-semibold text-text-primary">
                  {tTerm('reports.profitability.customerControl.loanCount', { count: getLoanCount(item) })}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {tTerm('reports.profitability.customerControl.overdueLoans', { count: toNumber(item.overdueLoanCount) })}
                </p>
              </td>
              <td>{getPaymentBehaviorLabel(item.paymentBehavior)}</td>
            </tr>
          ))}
        </tbody>
      </ReportDataTableSection>

      <ReportDataTableSection
        title={tTerm('reports.profitability.delinquent.title')}
        subtitle={tTerm('reports.profitability.delinquent.subtitle', {
          count: delinquentCustomerCount,
        })}
        minWidthClassName="min-w-[760px]"
      >
        <thead>
          <tr>
            <th>{tTerm('reports.profitability.customer')}</th>
            <th>{tTerm('reports.profitability.customerControl.delinquency')}</th>
            <th>{tTerm('reports.profitability.customerControl.behavior')}</th>
            <th>{tTerm('reports.profitability.customerControl.risk')}</th>
            <th>{tTerm('reports.profitability.customerControl.outstanding')}</th>
          </tr>
        </thead>
        <tbody>
          {delinquentCustomers.length === 0 ? (
            <tr>
              <td colSpan={5} className="table-empty-state">{tTerm('reports.profitability.delinquent.empty')}</td>
            </tr>
          ) : delinquentCustomers.map((item: any, index: number) => (
            <tr key={`delinquent-customer-${item.customerId || index}`}>
              <td className="font-medium">{getCustomerName(item)}</td>
              <td className={toNumber(item.overdueLoanCount) > 0 ? 'font-semibold text-rose-600' : 'text-text-secondary'}>
                {tTerm('reports.profitability.customerControl.overdueLoans', { count: toNumber(item.overdueLoanCount) })}
              </td>
              <td>{getPaymentBehaviorLabel(item.paymentBehavior)}</td>
              <td>
                <TableStatusPill className={getRiskClassName(item.riskLevel)}>
                  {getRiskLabel(item.riskLevel)}
                </TableStatusPill>
              </td>
              <td className={toNumber(item.outstandingBalance) > 0 ? 'font-semibold text-text-primary' : 'text-text-secondary'}>
                {formatMoney(item.outstandingBalance)}
              </td>
            </tr>
          ))}
        </tbody>
      </ReportDataTableSection>

      <ReportDataTableSection
        title={tTerm('reports.profitability.customerControl.title')}
        subtitle={tTerm('reports.profitability.customerControl.subtitle', {
          count: delinquentCustomerCount,
        })}
        minWidthClassName="min-w-[920px]"
      >
            <thead>
              <tr>
                <th>{tTerm('reports.profitability.customer')}</th>
                <th>{tTerm('reports.profitability.customerControl.creditHistory')}</th>
                <th>{tTerm('reports.profitability.customerControl.outstanding')}</th>
                <th>{tTerm('reports.profitability.customerControl.delinquency')}</th>
                <th>{tTerm('reports.profitability.customerControl.behavior')}</th>
                <th>{tTerm('reports.profitability.customerControl.risk')}</th>
                <TableActionsHeader>{tTerm('reports.schedule.agenda.table.actions')}</TableActionsHeader>
              </tr>
            </thead>
            <tbody>
              {customerControlRows.map((item: any, i: number) => (
                <tr key={`${item.customerId || 'customer'}-${i}`}>
                  <td className="font-medium">{item.customerName || tTerm('credits.label.customerFallback', { id: item.customerId })}</td>
                  <td>
                    <p className="font-semibold text-text-primary">
                      {tTerm('reports.profitability.customerControl.loanCount', { count: toNumber(item.totalLoans) })}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {tTerm('reports.profitability.customerControl.loanMix', {
                        active: toNumber(item.activeLoanCount),
                        closed: toNumber(item.closedLoanCount),
                      })}
                    </p>
                  </td>
                  <td className={toNumber(item.outstandingBalance) > 0 ? 'font-semibold text-text-primary' : 'text-text-secondary'}>
                    {formatMoney(item.outstandingBalance)}
                  </td>
                  <td>
                    <p className={toNumber(item.overdueLoanCount) > 0 ? 'font-semibold text-rose-600' : 'text-text-secondary'}>
                      {tTerm('reports.profitability.customerControl.overdueLoans', { count: toNumber(item.overdueLoanCount) })}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {tTerm('reports.profitability.customerControl.payments', { count: toNumber(item.paymentCount) })}
                    </p>
                  </td>
                  <td>{getPaymentBehaviorLabel(item.paymentBehavior)}</td>
                  <td>
                    <TableStatusPill className={getRiskClassName(item.riskLevel)}>
                      {getRiskLabel(item.riskLevel)}
                    </TableStatusPill>
                  </td>
                  <TableActionsCell>
                    <RowActionsWithOverflow
                      ariaLabel={tTerm('reports.profitability.customerDetail.actionsAria', { customer: getCustomerName(item) })}
                      variant="icon"
                      items={[
                        {
                          id: `view-customer-${item.customerId || i}`,
                          label: tTerm('reports.profitability.customerDetail.actionView'),
                          icon: <Eye size={16} />,
                          onClick: () => {
                            const customerId = Number(item.customerId);
                            if (!Number.isFinite(customerId) || customerId <= 0) {
                              return;
                            }
                            setSelectedCustomer({
                              id: customerId,
                              name: getCustomerName(item),
                              snapshot: item,
                            });
                          },
                          disabled: !Number.isFinite(Number(item.customerId)) || Number(item.customerId) <= 0,
                        },
                      ]}
                    />
                  </TableActionsCell>
                </tr>
              ))}
              {customerControlRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-empty-state">{tTerm('reports.profitability.customerControl.empty')}</td>
                </tr>
              )}
            </tbody>
      </ReportDataTableSection>

      <ReportDataTableSection title={tTerm('reports.profitability.table.title')}>
            <thead>
              <tr>
                <th>{tTerm('reports.profitability.customer')}</th>
                <th>{tTerm('reports.profitability.totalLoans')}</th>
                <th>{tTerm('reports.profitability.interestCollected')}</th>
                <th>{tTerm('reports.profitability.lateFeesCollected')}</th>
                <th>{tTerm('reports.profitability.totalProfit')}</th>
              </tr>
            </thead>
            <tbody>
              {profitabilityData.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="font-medium">{item.customerName || tTerm('credits.label.customerFallback', { id: item.customerId })}</td>
                  <td>{item.totalLoans}</td>
                  <td className="text-emerald-600">{formatMoney(item.interestCollected)}</td>
                  <td className="text-amber-600">{formatMoney(item.lateFeesCollected)}</td>
                  <td className="font-bold text-brand-primary">{formatMoney(item.totalProfit)}</td>
                </tr>
              ))}
              {profitabilityData.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty-state">{tTerm('reports.profitability.empty')}</td>
                </tr>
              )}
            </tbody>
      </ReportDataTableSection>

      {selectedCustomer ? (
        <CustomerProfitabilityDetailModal
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          customerSnapshot={selectedCustomer.snapshot}
          onClose={() => setSelectedCustomer(null)}
        />
      ) : null}
    </div>
  );
}
