import type React from 'react';
import { Activity, Calendar, CheckCircle, Clock, DollarSign, Percent, ShieldAlert } from 'lucide-react';
import { MetricCard } from '../shared/Surfaces';

type CreditSummaryMetricsProps = {
  loan: any;
  paymentSnapshot: any;
  formatCurrency: (value: unknown) => string;
  formatMetricCurrency: (value: unknown) => string;
};

function SummaryMetricItem({
  icon: Icon,
  label,
  tooltip,
  value,
  tone = 'default',
}: {
  icon: React.ElementType;
  label: React.ReactNode;
  tooltip?: string;
  value: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
}) {
  const accent = {
    default: 'slate',
    success: 'emerald',
    warning: 'amber',
    danger: 'rose',
    brand: 'blue',
  }[tone];

  return (
    <MetricCard
      label={label}
      value={value}
      tooltip={tooltip}
      icon={<Icon />}
      accent={accent as 'slate' | 'emerald' | 'amber' | 'rose' | 'blue'}
      className="min-h-[6.25rem]"
    />
  );
}

export function CreditSummaryMetrics({
  loan,
  paymentSnapshot,
  formatCurrency,
  formatMetricCurrency,
}: CreditSummaryMetricsProps) {
  return (
    <section
      className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7"
      data-tour="credit-detail-metrics"
    >
      <SummaryMetricItem
        icon={Activity}
        label="Capital vivo"
        tooltip="Capital del crédito que todavía no ha sido amortizado. Es el principal pendiente antes de sumar intereses o mora."
        tone="brand"
        value={<span title={formatCurrency(paymentSnapshot?.outstandingPrincipal)}>{formatMetricCurrency(paymentSnapshot?.outstandingPrincipal)}</span>}
      />
      <SummaryMetricItem
        icon={Calendar}
        label="Cuotas totales"
        tooltip="Cantidad de cuotas pactadas al crear el crédito. No cambia aunque después se registren pagos o ajustes operativos."
        value={loan.termMonths ?? '-'}
      />
      <SummaryMetricItem
        icon={Clock}
        label="Cuotas a pagar"
        tooltip="Cuotas que todavía tienen saldo pendiente. Si llega a cero, el crédito ya no tiene cuotas operables."
        value={paymentSnapshot?.outstandingInstallments ?? '-'}
      />
      <SummaryMetricItem
        icon={Percent}
        label="Interés total"
        tooltip="Suma de todos los intereses programados por la fórmula aplicada al crédito. Es el costo financiero del cronograma, no lo que falta por pagar."
        value={<span title={formatCurrency(paymentSnapshot?.totalInterest)}>{formatMetricCurrency(paymentSnapshot?.totalInterest)}</span>}
      />
      <SummaryMetricItem
        icon={CheckCircle}
        label="Capital pagado"
        tooltip="Parte del crédito original que ya fue amortizada. Solo mide abonos al principal, no incluye intereses ni mora."
        tone="brand"
        value={<span title={formatCurrency(paymentSnapshot?.totalPaidPrincipal)}>{formatMetricCurrency(paymentSnapshot?.totalPaidPrincipal)}</span>}
      />
      <SummaryMetricItem
        icon={DollarSign}
        label="Interés pagado"
        tooltip="Intereses que ya fueron cobrados y aplicados al crédito. Debe crecer a medida que se registran cuotas o pagos parciales."
        tone="warning"
        value={<span title={formatCurrency(paymentSnapshot?.totalPaidInterest)}>{formatMetricCurrency(paymentSnapshot?.totalPaidInterest)}</span>}
      />
      <SummaryMetricItem
        icon={ShieldAlert}
        label="Tasa mora EA"
        tooltip="Tasa efectiva anual usada para calcular mora sobre saldos vencidos cuando una cuota entra en atraso."
        tone="danger"
        value={loan.annualLateFeeRate ? `${loan.annualLateFeeRate}%` : '-'}
      />
    </section>
  );
}
