import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, DollarSign, TrendingUp, BarChart3, Download, FileSpreadsheet, Loader2, Wallet } from 'lucide-react';
import { usePaymentSchedule, exportCreditExcel } from '../services/reportService';
import { toast } from '../lib/toast';
import { formatCurrency, formatDate } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { formatScheduleStatusLabel } from '../lib/scheduleStatusLabels';
import { getLoanStatusLabel } from './credits/creditsHelpers';
import { ActionButton, EmptyState, InsightStrip, PageHeader, PageShell } from './shared/Surfaces';
import { AppTable, TableStatusPill } from './shared/tables';
import { QuickGuideButton } from './shared/HelpSupport';
import { useSessionStore } from '../store/sessionStore';
import { useResolvedPermissionNames } from '../services/permissionsService';
import { PERMISSION } from '../constants/permissionNames';

/**
 * PaymentSchedule component displays a detailed amortization table for a specific loan.
 * It shows payment schedules, status badges, summary statistics, and export capabilities.
 */
export default function PaymentSchedule() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loanId = id ? Number(id) : null;
  const { user } = useSessionStore();
  const resolvedPermissions = useResolvedPermissionNames(user);
  const permissionSet = new Set(resolvedPermissions.map((permission) => permission.toUpperCase()));
  const canExportSchedule = user?.role === 'admin'
    || permissionSet.has('*')
    || permissionSet.has(PERMISSION.REPORTS_VIEW_ALL);
  const { loan, summary, schedule, isLoading, isError, error } = usePaymentSchedule(loanId);
  const [isExporting, setIsExporting] = useState(false);

  const getStatusBadgeClassName = (status: string) => {
    const statusMap: Record<string, string> = {
      paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
      overdue: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
      defaulted: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
      annulled: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
    };

    return statusMap[status.toLowerCase()] || 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300';
  };

  const handleExport = async () => {
    if (!loanId) return;
    setIsExporting(true);
    try {
      await exportCreditExcel(loanId);
      toast.success({
        title: tTerm('schedule.export.successTitle'),
        description: tTerm('schedule.export.successDescription', { loanId }),
      });
    } catch (_err: unknown) {
      toast.error({ title: tTerm('schedule.export.errorTitle'), description: tTerm('schedule.toast.export.error') });
    } finally {
      setIsExporting(false);
    }
  };

  const getScheduleErrorDescription = (scheduleError: unknown) => {
    const message = String((scheduleError as { message?: string } | null)?.message || '');
    if (/loan not found|not found|404/i.test(message)) {
      return tTerm('schedule.empty.notFoundDescription');
    }
    return tTerm('schedule.empty.errorDescription');
  };

  if (!loanId) {
    return (
      <PageShell>
        <EmptyState
          title={tTerm('schedule.empty.selectTitle')}
          description={tTerm('schedule.empty.selectDescription')}
          action={<ActionButton onClick={() => navigate('/credits')}>{tTerm('schedule.button.back')}</ActionButton>}
        />
      </PageShell>
    );
  }

  if (isLoading) {
    return (
      <PageShell>
        <EmptyState
          title={tTerm('schedule.empty.loadingTitle')}
          description={tTerm('schedule.empty.loadingDescription')}
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
          title={tTerm('schedule.empty.errorTitle')}
          description={getScheduleErrorDescription(error)}
          icon={<FileSpreadsheet size={24} />}
          action={<ActionButton onClick={() => navigate('/credits')}>{tTerm('schedule.button.back')}</ActionButton>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell data-tour="payment-schedule-page">
      {/* Header */}
      <PageHeader
        title={tTerm('schedule.module.title')}
        subtitle={loan?.customerName ? tTerm('schedule.subtitle.customer', { name: loan.customerName }) : tTerm('schedule.module.subtitle')}
        tourId="payment-schedule-header"
        actions={(
          <>
            <QuickGuideButton guideKey="payment-schedule" />
            <ActionButton onClick={() => navigate(-1)} icon={<ArrowLeft size={16} />}>
              {tTerm('schedule.button.back')}
            </ActionButton>
            {canExportSchedule && (
            <ActionButton
              onClick={handleExport}
              disabled={isExporting}
              isLoading={isExporting}
              icon={isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            >
              {tTerm('schedule.button.export')}
            </ActionButton>
            )}
          </>
        )}
      />

      {/* Loan Summary */}
      {loan && (
        <InsightStrip
          data-tour="payment-schedule-summary"
          aria-label={tTerm('schedule.module.title')}
          items={[
            { id: 'payment-schedule-amount', label: tTerm('schedule.summary.loanAmount'), value: formatCurrency(loan.amount), helper: tTerm('schedule.summary.loanAmountHelper'), icon: <DollarSign size={18} />, accent: 'blue' },
            { id: 'payment-schedule-rate', label: tTerm('schedule.summary.interestRate'), value: `${loan.interestRate}%`, helper: tTerm('schedule.summary.interestRateHelper'), icon: <TrendingUp size={18} />, accent: 'amber' },
            { id: 'payment-schedule-term', label: tTerm('schedule.summary.term'), value: tTerm('schedule.summary.termValue', { months: loan.termMonths }), helper: tTerm('schedule.summary.termHelper'), icon: <Calendar size={18} />, accent: 'emerald' },
            { id: 'payment-schedule-status', label: tTerm('schedule.summary.status'), value: getLoanStatusLabel(loan.status), helper: tTerm('schedule.summary.statusHelper'), icon: <BarChart3 size={18} />, accent: 'slate' },
          ]}
        />
      )}

      {/* Summary Stats */}
      {summary && (
        <InsightStrip
          aria-label={tTerm('schedule.table.title')}
          items={[
            { id: 'payment-schedule-total-principal', label: tTerm('schedule.stats.totalPrincipal'), value: formatCurrency(parseFloat(summary.totalPrincipal)), helper: tTerm('schedule.stats.totalPrincipalHelper'), icon: <DollarSign size={18} />, accent: 'blue' },
            { id: 'payment-schedule-total-interest', label: tTerm('schedule.stats.totalInterest'), value: formatCurrency(parseFloat(summary.totalInterest)), helper: tTerm('schedule.stats.totalInterestHelper'), icon: <TrendingUp size={18} />, accent: 'amber' },
            { id: 'payment-schedule-total-payment', label: tTerm('schedule.stats.totalPayment'), value: formatCurrency(parseFloat(summary.totalPayment)), helper: tTerm('schedule.stats.totalPaymentHelper'), icon: <Wallet size={18} />, accent: 'emerald' },
            { id: 'payment-schedule-paid-count', label: tTerm('schedule.stats.paidInstallments'), value: summary.paidInstallments, helper: tTerm('schedule.stats.paidInstallmentsHelper'), icon: <Calendar size={18} />, accent: 'slate' },
            { id: 'payment-schedule-pending-count', label: tTerm('schedule.stats.pendingInstallments'), value: summary.pendingInstallments, helper: tTerm('schedule.stats.pendingInstallmentsHelper'), icon: <Calendar size={18} />, accent: 'rose' },
          ]}
        />
      )}

      <AppTable
        variant="financial"
        data-tour="payment-schedule-table"
        visibleFrom="always"
        horizontalScroll
        minWidthClassName="min-w-[1040px]"
      >
        <colgroup>
          <col style={{ width: '6%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="text-center">{tTerm('schedule.table.header.period')}</th>
            <th>{tTerm('schedule.table.header.dueDate')}</th>
            <th className="text-right">{tTerm('schedule.table.header.openingBalance')}</th>
            <th className="text-right">{tTerm('schedule.table.header.scheduledPayment')}</th>
            <th className="text-right">{tTerm('schedule.table.header.principal')}</th>
            <th className="text-right">{tTerm('schedule.table.header.interest')}</th>
            <th className="text-right">{tTerm('schedule.table.header.paid')}</th>
            <th className="text-right">{tTerm('schedule.table.header.remaining')}</th>
            <th className="text-center">{tTerm('schedule.table.header.status')}</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((entry) => (
            <tr key={entry.installmentNumber} className="group">
              <td className="text-center font-medium text-text-secondary">{entry.installmentNumber}</td>
              <td className="text-text-secondary">
                {formatDate(entry.dueDate, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) || '-'}
              </td>
              <td className="text-right text-text-primary">{formatCurrency(entry.openingBalance)}</td>
              <td className="text-right font-medium text-text-primary">{formatCurrency(entry.scheduledPayment)}</td>
              <td className="text-right font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(entry.principalComponent)}</td>
              <td className="text-right text-text-secondary">{formatCurrency(entry.interestComponent)}</td>
              <td className="text-right font-medium text-text-primary">
                {entry.paidTotal > 0 ? formatCurrency(entry.paidTotal) : '-'}
              </td>
              <td className="text-right font-medium text-text-primary">{formatCurrency(entry.remainingBalance)}</td>
              <td className="text-center">
                <TableStatusPill className={getStatusBadgeClassName(entry.status)}>
                  {formatScheduleStatusLabel(entry.status)}
                </TableStatusPill>
              </td>
            </tr>
          ))}
        </tbody>
      </AppTable>
    </PageShell>
  );
}
