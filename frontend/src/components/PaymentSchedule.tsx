import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, DollarSign, TrendingUp, BarChart3, Download, FileSpreadsheet, Loader2, Wallet } from 'lucide-react';
import { usePaymentSchedule, exportCreditsExcel } from '../services/reportService';
import { toast } from '../lib/toast';
import { tTerm } from '../i18n/terminology';
import { MetricCard } from './shared/Surfaces';
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
    setIsExporting(true);
    try {
      await exportCreditsExcel();
      toast.success({ title: 'Exportación exitosa', description: 'El reporte se exportó correctamente' });
    } catch (_err: unknown) {
      toast.error({ title: 'Error de exportación', description: 'No se pudo exportar el reporte' });
    } finally {
      setIsExporting(false);
    }
  };

  if (!loanId) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-text-secondary">Selecciona un crédito para ver su plan de pagos.</p>
        <button
          onClick={() => navigate('/credits')}
          className="mt-4 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm"
        >
          Volver a Créditos
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 size={32} className="animate-spin text-brand-primary" />
        <p className="text-text-secondary">Cargando plan de pagos...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-red-500">
          <FileSpreadsheet size={48} />
        </div>
        <p className="text-text-secondary">
          {error ? (error as any).message || 'Error al cargar el plan de pagos' : 'Error al cargar el plan de pagos'}
        </p>
        <button
          onClick={() => navigate('/credits')}
          className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm"
        >
          Volver a Créditos
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full" data-tour="payment-schedule-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" data-tour="payment-schedule-header">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-bg-surface border border-border-subtle rounded-lg hover:bg-hover-bg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-3">
              <Calendar size={28} className="text-brand-primary" />
              Plan de Pagos
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {loan?.customerName ? `Cliente: ${loan.customerName}` : 'Tabla de amortización'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <QuickGuideButton guideKey="payment-schedule" />
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border-subtle rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Exportar
          </button>
        </div>
      </div>

      {/* Loan Summary */}
      {loan && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4" data-tour="payment-schedule-summary">
          <MetricCard label="Monto del préstamo" value={formatCurrency(loan.amount)} icon={<DollarSign size={18} />} accent="blue" />
          <MetricCard label="Tasa de interés" value={`${loan.interestRate}%`} icon={<TrendingUp size={18} />} accent="amber" />
          <MetricCard label="Plazo" value={`${loan.termMonths} meses`} icon={<Calendar size={18} />} accent="emerald" />
          <MetricCard label="Estado" value={<span className="capitalize">{loan.status}</span>} icon={<BarChart3 size={18} />} accent="slate" />
        </section>
      )}

      {/* Summary Stats */}
      {summary && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
          <MetricCard label="Total capital" value={formatCurrency(parseFloat(summary.totalPrincipal))} icon={<DollarSign size={18} />} accent="blue" />
          <MetricCard label="Total intereses" value={formatCurrency(parseFloat(summary.totalInterest))} icon={<TrendingUp size={18} />} accent="amber" />
          <MetricCard label="Total a pagar" value={formatCurrency(parseFloat(summary.totalPayment))} icon={<Wallet size={18} />} accent="emerald" />
          <MetricCard label="Cuotas pagadas" value={summary.paidInstallments} icon={<Calendar size={18} />} accent="slate" />
          <MetricCard label="Cuotas pendientes" value={summary.pendingInstallments} icon={<Calendar size={18} />} accent="rose" />
        </section>
      )}

      {/* Amortization Table */}
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-sm dark:bg-bg-surface" data-tour="payment-schedule-table">
        <div className="px-6 py-4 border-b border-border-subtle">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-500" />
            Tabla de Amortización
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-base border-b border-border-subtle">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary"># Cuota</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">Fecha Vencimiento</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">Saldo Inicial</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">Cuota Programada</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">Capital</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">Interés</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">Pagado</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">Saldo Restante</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-text-secondary">Estado</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((entry) => (
                <tr
                  key={entry.installmentNumber}
                  className="border-b border-border-subtle hover:bg-hover-bg transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-text-primary">
                    {entry.installmentNumber}
                  </td>
                  <td className="py-3 px-4 text-text-secondary">
                    {formatDate(entry.dueDate)}
                  </td>
                  <td className="py-3 px-4 text-right text-text-primary">
                    {formatCurrency(entry.openingBalance)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-text-primary">
                    {formatCurrency(entry.scheduledPayment)}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(entry.principalComponent)}
                  </td>
                  <td className="py-3 px-4 text-right text-amber-600 dark:text-amber-400">
                    {formatCurrency(entry.interestComponent)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-text-primary">
                    {entry.paidTotal > 0 ? formatCurrency(entry.paidTotal) : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-text-primary">
                    {formatCurrency(entry.remainingBalance)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {getStatusBadge(entry.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
