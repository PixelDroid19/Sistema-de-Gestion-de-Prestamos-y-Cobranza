import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, DollarSign, TrendingUp, BarChart3, Download, FileSpreadsheet, Loader2, Wallet } from 'lucide-react';
import { usePaymentSchedule, exportCreditExcel } from '../services/reportService';
import { toast } from '../lib/toast';
import { tTerm } from '../i18n/terminology';
import { ActionButton, DataTableSurface, EmptyState, InsightStrip, PageHeader, PageShell } from './shared/Surfaces';
import { QuickGuideButton } from './shared/HelpSupport';

/**
 * PaymentSchedule component displays a detailed amortization table for a specific loan.
 * It shows payment schedules, status badges, summary statistics, and export capabilities.
 */
export default function PaymentSchedule() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loanId = id ? Number(id) : null;
  const { data, loan, summary, schedule, isLoading, isError, error } = usePaymentSchedule(loanId);
  const [isExporting, setIsExporting] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'paid': { label: 'Pagado', className: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
      'pending': { label: 'Pendiente', className: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' },
      'overdue': { label: 'Vencido', className: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' },
      'annulled': { label: 'Anulado', className: 'bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400' },
    };

    const config = statusMap[status.toLowerCase()] || {
      label: status,
      className: 'bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400',
    };

    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const handleExport = async () => {
    if (!loanId) return;
    setIsExporting(true);
    try {
      await exportCreditExcel(loanId);
      toast.success({ title: 'Exportación exitosa', description: `Se exportó el Excel del crédito #${loanId}.` });
    } catch (_err: unknown) {
      toast.error({ title: 'Error de exportación', description: 'No se pudo exportar el reporte' });
    } finally {
      setIsExporting(false);
    }
  };

  if (!loanId) {
    return (
      <PageShell>
        <EmptyState
          title="Selecciona un crédito"
          description="El plan de pagos necesita un crédito válido para mostrar amortización y estados."
          action={<ActionButton onClick={() => navigate('/credits')}>Volver a créditos</ActionButton>}
        />
      </PageShell>
    );
  }

  if (isLoading) {
    return (
      <PageShell>
        <EmptyState
          title="Cargando plan de pagos"
          description="Estamos preparando la amortización del crédito."
          icon={<Loader2 size={24} className="animate-spin" />}
          compact
        />
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell>
        <EmptyState
          title="No se pudo cargar el plan"
          description={error ? (error as any).message || 'Error al cargar el plan de pagos' : 'Error al cargar el plan de pagos'}
          icon={<FileSpreadsheet size={24} />}
          action={<ActionButton onClick={() => navigate('/credits')}>Volver a créditos</ActionButton>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell data-tour="payment-schedule-page">
      {/* Header */}
      <PageHeader
        title="Plan de pagos"
        subtitle={loan?.customerName ? `Cliente: ${loan.customerName}` : 'Tabla de amortización'}
        tourId="payment-schedule-header"
        actions={(
          <>
            <QuickGuideButton guideKey="payment-schedule" />
            <ActionButton onClick={() => navigate(-1)} icon={<ArrowLeft size={16} />}>
              Volver
            </ActionButton>
            <ActionButton
              onClick={handleExport}
              disabled={isExporting}
              isLoading={isExporting}
              icon={isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            >
              Exportar
            </ActionButton>
          </>
        )}
      />

      {/* Loan Summary */}
      {loan && (
        <InsightStrip
          data-tour="payment-schedule-summary"
          aria-label="Resumen del crédito"
          items={[
            { id: 'payment-schedule-amount', label: 'Monto del crédito', value: formatCurrency(loan.amount), helper: 'Capital original', icon: <DollarSign size={18} />, accent: 'blue' },
            { id: 'payment-schedule-rate', label: 'Tasa de interés', value: `${loan.interestRate}%`, helper: 'Tasa anual', icon: <TrendingUp size={18} />, accent: 'amber' },
            { id: 'payment-schedule-term', label: 'Plazo', value: `${loan.termMonths} meses`, helper: 'Tiempo pactado', icon: <Calendar size={18} />, accent: 'emerald' },
            { id: 'payment-schedule-status', label: 'Estado', value: <span className="capitalize">{loan.status}</span>, helper: 'Situación actual', icon: <BarChart3 size={18} />, accent: 'slate' },
          ]}
        />
      )}

      {/* Summary Stats */}
      {summary && (
        <InsightStrip
          aria-label="Totales del plan de pagos"
          items={[
            { id: 'payment-schedule-total-principal', label: 'Total capital', value: formatCurrency(parseFloat(summary.totalPrincipal)), helper: 'Capital amortizado', icon: <DollarSign size={18} />, accent: 'blue' },
            { id: 'payment-schedule-total-interest', label: 'Total intereses', value: formatCurrency(parseFloat(summary.totalInterest)), helper: 'Interés programado', icon: <TrendingUp size={18} />, accent: 'amber' },
            { id: 'payment-schedule-total-payment', label: 'Total a pagar', value: formatCurrency(parseFloat(summary.totalPayment)), helper: 'Capital + interés', icon: <Wallet size={18} />, accent: 'emerald' },
            { id: 'payment-schedule-paid-count', label: 'Cuotas pagadas', value: summary.paidInstallments, helper: 'Completadas', icon: <Calendar size={18} />, accent: 'slate' },
            { id: 'payment-schedule-pending-count', label: 'Cuotas pendientes', value: summary.pendingInstallments, helper: 'Por operar', icon: <Calendar size={18} />, accent: 'rose' },
          ]}
        />
      )}

      <DataTableSurface data-tour="payment-schedule-table">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr>
                <th className="text-left"># Cuota</th>
                <th className="text-left">Fecha vencimiento</th>
                <th className="text-right">Saldo inicial</th>
                <th className="text-right">Cuota programada</th>
                <th className="text-right">Capital</th>
                <th className="text-right">Interés</th>
                <th className="text-right">Pagado</th>
                <th className="text-right">Saldo restante</th>
                <th className="text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {schedule.map((entry) => (
                <tr
                  key={entry.installmentNumber}
                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-hover-bg/60"
                >
                  <td className="font-medium text-text-primary">
                    {entry.installmentNumber}
                  </td>
                  <td className="whitespace-nowrap text-text-secondary">
                    {formatDate(entry.dueDate)}
                  </td>
                  <td className="whitespace-nowrap text-right text-text-primary">
                    {formatCurrency(entry.openingBalance)}
                  </td>
                  <td className="whitespace-nowrap text-right font-medium text-text-primary">
                    {formatCurrency(entry.scheduledPayment)}
                  </td>
                  <td className="whitespace-nowrap text-right text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(entry.principalComponent)}
                  </td>
                  <td className="whitespace-nowrap text-right text-amber-600 dark:text-amber-400">
                    {formatCurrency(entry.interestComponent)}
                  </td>
                  <td className="whitespace-nowrap text-right font-medium text-text-primary">
                    {entry.paidTotal > 0 ? formatCurrency(entry.paidTotal) : '-'}
                  </td>
                  <td className="whitespace-nowrap text-right font-medium text-text-primary">
                    {formatCurrency(entry.remainingBalance)}
                  </td>
                  <td className="text-center">
                    {getStatusBadge(entry.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataTableSurface>
    </PageShell>
  );
}
