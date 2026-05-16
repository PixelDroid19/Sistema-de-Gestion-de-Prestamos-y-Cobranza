import type React from 'react';
import { Activity, Clock, DollarSign, Percent } from 'lucide-react';
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
      aria-label="Resumen operativo del crédito"
      className="credit-detail-summary-strip"
      data-tour="credit-detail-metrics"
      items={[
        {
          id: 'outstanding-principal',
          label: 'Capital vivo',
          value: <span title={formatCurrency(paymentSnapshot?.outstandingPrincipal)}>{formatMetricCurrency(paymentSnapshot?.outstandingPrincipal)}</span>,
          helper: 'Principal pendiente',
          icon: <Activity size={18} />,
          accent: 'blue',
        },
        {
          id: 'total-collected',
          label: 'Total cobrado',
          value: <span title={formatCurrency(totalPaid)}>{formatMetricCurrency(totalPaid)}</span>,
          helper: 'Capital e intereses',
          icon: <DollarSign size={18} />,
          accent: 'emerald',
        },
        {
          id: 'late-fee-pending',
          label: 'Mora pendiente',
          value: <span title={formatCurrency(pendingLateFee)}>{formatMetricCurrency(pendingLateFee)}</span>,
          helper: loan?.annualLateFeeRate ? `${loan.annualLateFeeRate}% EA configurado` : 'Sin tasa aplicada',
          icon: <Percent size={18} />,
          accent: pendingLateFee > 0 ? 'amber' : 'slate',
        },
        {
          id: 'installments-open',
          label: 'Cuotas a pagar',
          value: `${outstandingInstallments} / ${termMonths}`,
          helper: 'Pendientes / pactadas',
          icon: <Clock size={18} />,
          accent: 'slate',
        },
      ]}
    />
  );
}
