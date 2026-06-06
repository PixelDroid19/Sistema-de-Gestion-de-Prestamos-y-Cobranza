import { AlertTriangle, Clock3, CreditCard, ShieldAlert } from 'lucide-react';
import { formatCurrency as formatCurrencyValue, formatDate as formatDateValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { useCustomerReports } from '../../services/reportService';
import { ActionButton, DataTableSurface, EmptyState, InsightStrip, ModalShell } from '../shared/Surfaces';
import { AppTable } from '../shared/tables';

type CustomerProfitabilityDetailModalProps = {
  customerId: number;
  customerName: string;
  customerSnapshot?: any;
  onClose: () => void;
};

const formatMoney = (value: unknown) => formatCurrencyValue(value);

const toNumber = (value: unknown) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

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

const getHistoryTypeLabel = (entry: any) => {
  switch (String(entry?.entityType || '').toLowerCase()) {
    case 'loan':
      return tTerm('reports.profitability.customerDetail.activityType.loan');
    case 'payment':
      return tTerm('reports.profitability.customerDetail.activityType.payment');
    case 'document':
      return tTerm('reports.profitability.customerDetail.activityType.document');
    case 'alert':
      return tTerm('reports.profitability.customerDetail.activityType.alert');
    case 'promise':
      return tTerm('reports.profitability.customerDetail.activityType.promise');
    case 'notification':
      return tTerm('reports.profitability.customerDetail.activityType.notification');
    default:
      return tTerm('customerDetails.history.eventFallback');
  }
};

const getHistoryDetail = (entry: any) => {
  const item = entry?.data || {};
  const entityType = String(entry?.entityType || '').toLowerCase();

  if (entityType === 'payment') {
    return formatMoney(item.amount);
  }

  if (entityType === 'loan') {
    return item.amount ? formatMoney(item.amount) : tTerm('reports.profitability.customerDetail.activityFallback.loan');
  }

  if (entityType === 'document') {
    return item.category || item.name || item.fileName || tTerm('reports.profitability.customerDetail.activityFallback.document');
  }

  if (entityType === 'alert') {
    return item.notes || tTerm('reports.profitability.customerDetail.activityFallback.alert');
  }

  if (entityType === 'promise') {
    return item.notes || tTerm('reports.profitability.customerDetail.activityFallback.promise');
  }

  if (entityType === 'notification') {
    return tTerm('reports.profitability.customerDetail.activityFallback.notification');
  }

  return tTerm('customerDetails.history.descriptionFallback');
};

export default function CustomerProfitabilityDetailModal({
  customerId,
  customerName,
  customerSnapshot,
  onClose,
}: CustomerProfitabilityDetailModalProps) {
  const { history, creditProfile, isLoading } = useCustomerReports(customerId);

  const profile = creditProfile?.data?.profile || creditProfile?.profile || null;
  const summary = profile?.summary || {};
  const profitability = profile?.profitability || customerSnapshot || {};
  const timeline = Array.isArray(history?.data?.timeline)
    ? history.data.timeline
    : Array.isArray(history?.timeline)
      ? history.timeline
      : [];
  const visibleTimeline = timeline.slice(0, 6);

  return (
    <ModalShell
      title={tTerm('reports.profitability.customerDetail.title', { customer: customerName })}
      subtitle={tTerm('reports.profitability.customerDetail.subtitle')}
      maxWidthClassName="max-w-4xl"
      onClose={onClose}
      footer={(
        <ActionButton type="button" variant="primary" onClick={onClose} fullWidth>
          {tTerm('common.cta.close')}
        </ActionButton>
      )}
    >
      <div className="space-y-5">
        <InsightStrip
          aria-label={tTerm('reports.profitability.customerDetail.summaryAria')}
          items={[
            {
              id: 'loan-count',
              label: tTerm('reports.profitability.customerDetail.totalLoans'),
              value: tTerm('reports.profitability.customerControl.loanCount', { count: toNumber(summary.totalLoans ?? profitability.totalLoans) }),
              helper: tTerm('reports.profitability.customerDetail.totalLoansHelper', {
                active: toNumber(summary.activeLoans ?? profitability.activeLoanCount),
                closed: toNumber(summary.closedLoans ?? profitability.closedLoanCount),
              }),
              icon: <CreditCard size={18} />,
              accent: 'blue',
            },
            {
              id: 'outstanding',
              label: tTerm('reports.profitability.customerDetail.outstanding'),
              value: formatMoney(profitability.outstandingBalance),
              helper: customerName,
              icon: <Clock3 size={18} />,
              accent: 'amber',
            },
            {
              id: 'paid',
              label: tTerm('reports.profitability.customerDetail.paid'),
              value: formatMoney(summary.totalPaid),
              helper: tTerm('reports.profitability.customerDetail.paidHelper', {
                count: toNumber(summary.completedPayments),
              }),
              icon: <AlertTriangle size={18} />,
              accent: 'emerald',
            },
            {
              id: 'risk',
              label: tTerm('reports.profitability.customerDetail.risk'),
              value: (
                <span className="inline-flex flex-col gap-1">
                  <span>{getRiskLabel(profitability.riskLevel)}</span>
                  <span className="text-sm font-medium text-text-secondary">{getPaymentBehaviorLabel(profitability.paymentBehavior)}</span>
                </span>
              ),
              helper: tTerm('reports.profitability.customerDetail.behavior'),
              icon: <ShieldAlert size={18} />,
              accent: 'rose',
            },
          ]}
          className="insight-strip--modal-grid"
        />

        <section className="space-y-3">
          <div>
            <h4 className="text-lg font-semibold text-text-primary">
              {tTerm('reports.profitability.customerDetail.activityTitle')}
            </h4>
            <p className="text-sm text-text-secondary">
              {tTerm('reports.profitability.customerDetail.activitySubtitle')}
            </p>
          </div>

          <DataTableSurface>
            <AppTable
              variant="operational"
              shell="off"
              aria-label={tTerm('reports.profitability.customerDetail.activityAria')}
              minWidthClassName="min-w-[680px]"
            >
              <thead>
                <tr>
                  <th>{tTerm('reports.profitability.customerDetail.activityDate')}</th>
                  <th>{tTerm('reports.profitability.customerDetail.activityTypeHeader')}</th>
                  <th>{tTerm('reports.profitability.customerDetail.activityDetail')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="table-empty-state">{tTerm('reports.state.loading')}</td>
                  </tr>
                ) : visibleTimeline.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-0">
                      <EmptyState title={tTerm('reports.profitability.customerDetail.activityEmpty')} compact />
                    </td>
                  </tr>
                ) : visibleTimeline.map((entry: any) => (
                  <tr key={entry.id}>
                    <td className="font-medium text-text-primary">
                      {formatDateValue(entry.occurredAt) || tTerm('common.dateUnavailable')}
                    </td>
                    <td>{getHistoryTypeLabel(entry)}</td>
                    <td className="text-text-secondary">{getHistoryDetail(entry)}</td>
                  </tr>
                ))}
              </tbody>
            </AppTable>
          </DataTableSurface>
        </section>
      </div>
    </ModalShell>
  );
}
