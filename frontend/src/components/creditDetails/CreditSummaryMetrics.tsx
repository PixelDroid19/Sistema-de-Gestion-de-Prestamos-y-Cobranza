import { Activity, Clock, DollarSign, Percent } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { InsightStrip } from '../shared/Surfaces';

type CreditSummaryMetricsProps = {
  loan: any;
  paymentSnapshot: any;
  formatCurrency: (value: unknown) => string;
  formatMetricCurrency: (value: unknown) => string;
};

export function CreditSummaryMetrics({
  loan,
  paymentSnapshot,
  formatCurrency,
  formatMetricCurrency,
}: CreditSummaryMetricsProps) {
  const totalPaid = Number(paymentSnapshot?.totalPaid ?? (
    Number(paymentSnapshot?.totalPaidPrincipal || 0) + Number(paymentSnapshot?.totalPaidInterest || 0)
  ));
  const pendingLateFee = Number(
    paymentSnapshot?.lateFeeDue
    ?? paymentSnapshot?.totalLateFeeAmount
    ?? loan?.lateFeeOutstanding
    ?? loan?.totalOverdue
    ?? 0,
  );
  const outstandingInstallments = paymentSnapshot?.outstandingInstallments ?? '-';
  const termMonths = loan?.termMonths ?? '-';

  return (
    <InsightStrip
      aria-label={tTerm('creditDetails.summary.aria')}
      className="credit-detail-summary-strip"
      data-tour="credit-detail-metrics"
      items={[
        {
          id: 'outstanding-principal',
          label: tTerm('creditDetails.summary.outstandingPrincipal'),
          value: <span title={formatCurrency(paymentSnapshot?.outstandingPrincipal)}>{formatMetricCurrency(paymentSnapshot?.outstandingPrincipal)}</span>,
          helper: tTerm('creditDetails.summary.outstandingPrincipalHelper'),
          icon: <Activity size={18} />,
          accent: 'blue',
        },
        {
          id: 'total-collected',
          label: tTerm('creditDetails.summary.totalCollected'),
          value: <span title={formatCurrency(totalPaid)}>{formatMetricCurrency(totalPaid)}</span>,
          helper: tTerm('creditDetails.summary.totalCollectedHelper'),
          icon: <DollarSign size={18} />,
          accent: 'emerald',
        },
        {
          id: 'late-fee-pending',
          label: tTerm('creditDetails.summary.pendingLateFee'),
          value: <span title={formatCurrency(pendingLateFee)}>{formatMetricCurrency(pendingLateFee)}</span>,
          helper: loan?.annualLateFeeRate
            ? tTerm('creditDetails.summary.pendingLateFeeConfigured', { rate: loan.annualLateFeeRate })
            : tTerm('creditDetails.summary.pendingLateFeeNone'),
          icon: <Percent size={18} />,
          accent: pendingLateFee > 0 ? 'amber' : 'slate',
        },
        {
          id: 'installments-open',
          label: tTerm('creditDetails.summary.openInstallments'),
          value: `${outstandingInstallments} / ${termMonths}`,
          helper: tTerm('creditDetails.summary.openInstallmentsHelper'),
          icon: <Clock size={18} />,
          accent: 'slate',
        },
      ]}
    />
  );
}
