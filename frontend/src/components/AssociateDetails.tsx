import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, RefreshCw, Download, Calendar, CheckCircle, Clock, AlertCircle, History } from 'lucide-react';
import { useTranslation } from '../i18n';
import { formatCurrency as formatLocaleCurrency, formatDate as formatLocaleDate, formatNumber } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { useAssociateDetails } from '../services/associateService';
import { parseFormattedPositiveMoneyInput } from '../lib/moneyInput';
import { toast } from '../lib/toast';
import { getPaymentMethodLabel } from '../constants/paymentTypes';
import ContributionModal from './ContributionModal';
import InstallmentsModal from './InstallmentsModal';
import { useSessionStore } from '../store/sessionStore';
import {
  ActionButton,
  DataTableSurface,
  EmptyState,
  FormField,
  InsightStrip,
  ModalShell,
  MoneyInput,
  PageHeader,
  PageShell,
  SectionSurface,
  TextAreaInput,
  TextInput,
  ToolbarSurface,
  ViewTabs,
} from './shared/Surfaces';
import TableShell from './shared/TableShell';

type TabType = 'overview' | 'installments' | 'calendar';
type AssociateMoneyActionType = 'contribution' | 'distribution' | 'reinvestment';

const formatAssociateCurrency = (value: unknown) => formatLocaleCurrency(value);

const formatSignedCurrency = (value: unknown, type?: string, status?: string) => {
  const numericValue = Number(value || 0);
  const prefix = type === 'contribution' ? '+' : type === 'distribution' ? '-' : status === 'paid' ? '✓ ' : '';
  return `${prefix}${formatAssociateCurrency(numericValue)}`;
};

const formatAssociateDate = (value: unknown) => formatLocaleDate(value) || '-';

const getInstallmentStatusPresentation = (installment: any) => {
  if (installment?.status === 'paid') {
    return {
      label: tTerm('schedule.status.paid'),
      className: 'bg-emerald-100 text-emerald-700',
    };
  }

  const dueTimestamp = Date.parse(String(installment?.dueDate || ''));
  if (Number.isFinite(dueTimestamp) && dueTimestamp < Date.now()) {
    return {
      label: tTerm('schedule.status.overdue'),
      className: 'bg-red-100 text-red-700',
    };
  }

  return {
    label: tTerm('schedule.status.pending'),
    className: 'bg-amber-100 text-amber-700',
  };
};

const getCalendarEventTypeLabel = (event: any) => {
  if (event?.type === 'contribution') return tTerm('associateDetails.calendar.eventType.contribution');
  if (event?.type === 'distribution') return tTerm('associateDetails.calendar.eventType.distribution');
  if (event?.type === 'installment') return tTerm('associateDetails.calendar.eventType.installment');
  return event?.displayType || tTerm('common.notAvailable');
};

const formatAlertDayCount = (value: unknown) => {
  const days = Number(value || 0);
  return formatNumber(days, { maximumFractionDigits: 0 });
};

const getTodayDateInputValue = () => {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
};

export default function AssociateDetails() {
  useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const associateId = Number(id);
  const { user } = useSessionStore();
  const isAdmin = user?.role === 'admin';
  const isReadOnlyBackoffice = user?.role === 'employee';

  const [calendarFilters, setCalendarFilters] = useState({ startDate: '', endDate: '' });
  const updateCalendarFilter = (key: 'startDate' | 'endDate', value: string) => {
    setCalendarFilters((current) => {
      const next = { ...current, [key]: value };
      if (next.startDate && next.endDate && next.startDate > next.endDate) {
        return current;
      }
      return next;
    });
  };

  const { details, installments, contributions, calendar, isLoading, createContribution, createDistribution, createReinvestment, payInstallment } = useAssociateDetails(associateId, calendarFilters);
  const associate = details?.associate ?? null;

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showModal, setShowModal] = useState<AssociateMoneyActionType | null>(null);
  const [showContributionsModal, setShowContributionsModal] = useState(false);
  const [showInstallmentsModal, setShowInstallmentsModal] = useState(false);
  const [payingInstallmentNumber, setPayingInstallmentNumber] = useState<number | null>(null);
  const [installmentPaymentForm, setInstallmentPaymentForm] = useState({
    paymentDate: getTodayDateInputValue(),
    paymentMethod: '',
    notes: '',
  });
  const [actionAmounts, setActionAmounts] = useState<Record<AssociateMoneyActionType, string>>({
    contribution: '',
    distribution: '',
    reinvestment: '',
  });
  const [actionErrors, setActionErrors] = useState<Record<AssociateMoneyActionType, string>>({
    contribution: '',
    distribution: '',
    reinvestment: '',
  });
  const [installmentPaymentErrors, setInstallmentPaymentErrors] = useState({
    paymentDate: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(associateId)) return;
    const storageKey = `associate-detail-initial-tab:${associateId}`;
    const requestedTab = sessionStorage.getItem(storageKey) as TabType | null;
    if (requestedTab === 'overview' || requestedTab === 'installments' || requestedTab === 'calendar') {
      setActiveTab(requestedTab);
      sessionStorage.removeItem(storageKey);
    }
  }, [associateId]);

  if (isLoading) {
    return (
      <PageShell className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionSurface>
          <EmptyState title={tTerm('associateDetails.loading.title')} description={tTerm('associateDetails.loading.description')} compact />
        </SectionSurface>
      </PageShell>
    );
  }

  if (!associate && !details) {
    return (
      <PageShell className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionSurface>
          <EmptyState
            title={tTerm('associateDetails.error.title')}
            description={tTerm('associateDetails.error.description')}
            action={<ActionButton onClick={() => navigate('/associates')}>{tTerm('associateDetails.cta.backToAssociates')}</ActionButton>}
          />
        </SectionSurface>
      </PageShell>
    );
  }

  const associateName = (typeof associate?.name === 'string' && associate.name.trim())
    ? associate.name.trim()
    : [associate?.firstName, associate?.lastName].filter(Boolean).join(' ').trim() || tTerm('associateDetails.fallback.name');

  const detailsSummary = details?.summary;
  const totalContributions = detailsSummary?.totalContributed ?? details?.totalContributions ?? 0;
  const totalDistributions = detailsSummary?.totalDistributed ?? details?.totalDistributions ?? 0;
  const totalInterestPaid = detailsSummary?.totalInterestPaid ?? 0;
  const interestDebt = detailsSummary?.interestDebt ?? 0;
  const nextInterestPaymentDate = detailsSummary?.nextInterestPaymentDate ?? null;
  const debtStatus = detailsSummary?.debtStatus === 'pending'
    ? tTerm('associateDetails.debtStatus.pending')
    : tTerm('associateDetails.debtStatus.current');
  const paymentHistory = Array.isArray(details?.paymentHistory) ? details.paymentHistory : [];
  const interestTypeLabel = tTerm(associate?.interestType === 'annual' ? 'common.interestType.annual' : 'common.interestType.monthly').toLowerCase();
  const interestRateLabel = tTerm('associateDetails.interestRateLabel', {
    rate: formatNumber(associate?.interestRate || 0, { maximumFractionDigits: 4 }),
    interestType: interestTypeLabel,
  });

  const installmentsData = installments || { installments: [], totals: { totalPending: 0, totalPaid: 0, totalOverdue: 0 } };
  const associatePaymentAlerts = Array.isArray(installmentsData.alerts) ? installmentsData.alerts : [];
  const calendarData = calendar || { events: [], summary: { contributionCount: 0, distributionCount: 0, installmentCount: 0, pendingInstallments: 0 } };

  const getAssociatePaymentAlertTitle = (alert: any) => {
    const installmentNumber = alert?.installmentNumber ?? tTerm('common.notAvailable');
    if (alert?.type === 'overdue') {
      return tTerm(Number(alert.daysOverdue) === 1
        ? 'associateDetails.alerts.item.overdue.one'
        : 'associateDetails.alerts.item.overdue.many', {
        installmentNumber,
        days: formatAlertDayCount(alert.daysOverdue),
      });
    }

    return tTerm(Number(alert?.daysUntilDue) === 1
      ? 'associateDetails.alerts.item.upcoming.one'
      : 'associateDetails.alerts.item.upcoming.many', {
      installmentNumber,
      days: formatAlertDayCount(alert?.daysUntilDue),
    });
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showModal) return;

    const rawAmount = String(actionAmounts[showModal] || '').trim();
    if (!rawAmount) {
      setActionErrors((current) => ({
        ...current,
        [showModal]: tTerm('associateDetails.modal.validation.amountRequired'),
      }));
      return;
    }

    const parsedAmount = parseFormattedPositiveMoneyInput(actionAmounts[showModal]);
    if (parsedAmount === null) {
      setActionErrors((current) => ({
        ...current,
        [showModal]: tTerm('associateDetails.modal.validation.amountInvalid'),
      }));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { amount: parsedAmount, date: new Date().toISOString() };
      
      if (showModal === 'contribution') {
        await createContribution.mutateAsync({
          amount: payload.amount,
          contributionDate: new Date().toISOString(),
        });
      } else if (showModal === 'distribution') {
        await createDistribution.mutateAsync({
          amount: payload.amount,
          distributionDate: new Date().toISOString(),
        });
      } else if (showModal === 'reinvestment') {
        await createReinvestment.mutateAsync({
          amount: payload.amount,
          reinvestmentDate: new Date().toISOString(),
        });
      }
      
      const completedAction = showModal;
      setShowModal(null);
      setActionAmounts((current) => ({ ...current, [completedAction]: '' }));
      toast.success({ title: tTerm('associateDetails.toast.action.success') });
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'associates' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeMoneyActionModal = () => {
    if (showModal) {
      const currentAction = showModal;
      setActionAmounts((current) => ({ ...current, [currentAction]: '' }));
      setActionErrors((current) => ({ ...current, [currentAction]: '' }));
    }
    setShowModal(null);
  };

  const openMoneyActionModal = (action: AssociateMoneyActionType) => {
    setActionErrors((current) => ({ ...current, [action]: '' }));
    setShowModal(action);
  };

  const handleOpenPayInstallmentModal = (installmentNumber: number) => {
    setPayingInstallmentNumber(installmentNumber);
    setInstallmentPaymentErrors({
      paymentDate: '',
    });
    setInstallmentPaymentForm({
      paymentDate: getTodayDateInputValue(),
      paymentMethod: '',
      notes: '',
    });
  };

  const handleClosePayInstallmentModal = () => {
    setPayingInstallmentNumber(null);
    setInstallmentPaymentErrors({
      paymentDate: '',
    });
    setInstallmentPaymentForm({
      paymentDate: getTodayDateInputValue(),
      paymentMethod: '',
      notes: '',
    });
  };

  const handlePayInstallment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (payInstallment.isPending) {
      return;
    }

    if (!installmentPaymentForm.paymentDate) {
      setInstallmentPaymentErrors({
        paymentDate: tTerm('associateDetails.installmentPayment.validation.paymentDateRequired'),
      });
      return;
    }

    if (payingInstallmentNumber === null) {
      return;
    }

    try {
      await payInstallment.mutateAsync({
        installmentNumber: payingInstallmentNumber,
        paymentDate: installmentPaymentForm.paymentDate,
        paymentMethod: installmentPaymentForm.paymentMethod.trim(),
        notes: installmentPaymentForm.notes.trim(),
      });
      handleClosePayInstallmentModal();
      toast.success({ title: tTerm('associateDetails.toast.installmentPaid') });
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'associates' });
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <InsightStrip
        aria-label={tTerm('associateDetails.overview.ariaLabel')}
        items={[
          {
            id: 'associate-detail-capital',
            label: tTerm('associateDetails.overview.metric.capital'),
            value: formatAssociateCurrency(totalContributions),
            helper: tTerm('associateDetails.overview.metric.capitalHelper', { interestRate: interestRateLabel }),
            icon: <Wallet size={18} />,
            accent: 'blue',
          },
          {
            id: 'associate-detail-interest-paid',
            label: tTerm('associateDetails.overview.metric.interestPaid'),
            value: formatAssociateCurrency(totalInterestPaid),
            helper: totalDistributions > 0
              ? tTerm('associateDetails.overview.metric.interestPaidHelper.distributed', { amount: formatAssociateCurrency(totalDistributions) })
              : tTerm('associateDetails.overview.metric.interestPaidHelper.recognized'),
            icon: <CheckCircle size={18} />,
            accent: 'emerald',
          },
          {
            id: 'associate-detail-debt',
            label: tTerm('associateDetails.overview.metric.debt'),
            value: formatAssociateCurrency(interestDebt),
            helper: interestDebt > 0
              ? tTerm('associateDetails.overview.metric.debtHelper.pending')
              : tTerm('associateDetails.overview.metric.debtHelper.none'),
            icon: <AlertCircle size={18} />,
            accent: interestDebt > 0 ? 'rose' : 'slate',
          },
          {
            id: 'associate-detail-next-payment',
            label: tTerm('associateDetails.overview.metric.nextPayment'),
            value: nextInterestPaymentDate ? formatAssociateDate(nextInterestPaymentDate) : tTerm('associateDetails.overview.metric.nextPayment.none'),
            helper: tTerm('associateDetails.overview.metric.nextPaymentHelper'),
            icon: <Calendar size={18} />,
            accent: 'slate',
          },
        ]}
      />

      {associatePaymentAlerts.length > 0 && (
        <SectionSurface
          title={tTerm('associateDetails.alerts.title')}
          subtitle={tTerm('associateDetails.alerts.description')}
          bodyClassName="grid gap-2"
        >
          {associatePaymentAlerts.map((alert: any) => (
            <div
              key={`associate-payment-alert-${alert.type}-${alert.installmentNumber}-${alert.dueDate}`}
              className={`flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                alert.type === 'overdue'
                  ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
                  : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{getAssociatePaymentAlertTitle(alert)}</p>
                <p className="mt-1 text-xs opacity-80">
                  {tTerm('associateDetails.alerts.item.detail', {
                    amount: formatAssociateCurrency(alert.amount),
                    date: formatAssociateDate(alert.dueDate),
                  })}
                </p>
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-bg-surface/80 px-2.5 py-1 text-xs font-semibold text-text-primary">
                {alert.type === 'overdue' ? tTerm('schedule.status.overdue') : tTerm('schedule.status.pending')}
              </span>
            </div>
          ))}
        </SectionSurface>
      )}

      <DataTableSurface>
        <div className="px-5 pt-5 sm:px-6">
          <h3 className="text-lg font-semibold text-text-primary">{tTerm('associateDetails.paymentHistory.title')}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {tTerm('associateDetails.paymentHistory.description')}
          </p>
        </div>
        <TableShell
          isLoading={false}
          isError={false}
          hasData={paymentHistory.length > 0}
          loadingContent={null}
          errorContent={null}
          emptyContent={<div className="py-4 text-center text-text-secondary">{tTerm('associateDetails.paymentHistory.empty')}</div>}
          recordsLabel={tTerm('associateDetails.paymentHistory.recordsLabel')}
        >
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="font-medium">{tTerm('associateDetails.paymentHistory.header.installment')}</th>
                <th className="font-medium">{tTerm('associateDetails.paymentHistory.header.amount')}</th>
                <th className="font-medium">{tTerm('associateDetails.paymentHistory.header.dueDate')}</th>
                <th className="font-medium">{tTerm('associateDetails.paymentHistory.header.paidAt')}</th>
                <th className="font-medium">{tTerm('associateDetails.paymentHistory.header.method')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {paymentHistory.map((entry: any) => (
                <tr key={`associate-payment-history-${entry.id}-${entry.installmentNumber}`} className="hover:bg-hover-bg transition-colors">
                  <td className="font-medium">{entry.installmentNumber}</td>
                  <td className="font-medium text-emerald-600">{formatAssociateCurrency(entry.amount)}</td>
                  <td>{formatAssociateDate(entry.dueDate)}</td>
                  <td>{formatAssociateDate(entry.paidAt)}</td>
                  <td className="text-text-secondary">{getPaymentMethodLabel(entry.paymentMethod)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </DataTableSurface>
    </div>
  );

  const renderInstallmentsTab = () => (
    <div className="space-y-4">
      <InsightStrip
        aria-label={tTerm('associateDetails.installments.ariaLabel')}
        items={[
          {
            id: 'associate-installments-pending',
            label: tTerm('associateDetails.installments.metric.pending'),
            value: formatAssociateCurrency(installmentsData.totals.totalPending),
            helper: tTerm('associateDetails.installments.metric.pendingHelper'),
            icon: <Clock size={18} />,
            accent: 'amber',
          },
          {
            id: 'associate-installments-paid',
            label: tTerm('associateDetails.installments.metric.paid'),
            value: formatAssociateCurrency(installmentsData.totals.totalPaid),
            helper: tTerm('associateDetails.installments.metric.paidHelper'),
            icon: <CheckCircle size={18} />,
            accent: 'emerald',
          },
          {
            id: 'associate-installments-overdue',
            label: tTerm('associateDetails.installments.metric.overdue'),
            value: formatAssociateCurrency(installmentsData.totals.totalOverdue),
            helper: tTerm('associateDetails.installments.metric.overdueHelper'),
            icon: <AlertCircle size={18} />,
            accent: Number(installmentsData.totals.totalOverdue || 0) > 0 ? 'rose' : 'slate',
          },
          {
            id: 'associate-installments-count',
            label: tTerm('associateDetails.installments.metric.count'),
            value: formatNumber(installmentsData.installments.length),
            helper: tTerm('associateDetails.installments.metric.countHelper'),
            icon: <Calendar size={18} />,
            accent: 'slate',
          },
        ]}
      />

      {/* Installments Table */}
      <DataTableSurface>
        <div className="px-5 pt-5 sm:px-6">
          <h3 className="text-lg font-semibold text-text-primary">{tTerm('associateDetails.installments.title')}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {tTerm('associateDetails.installments.description')}
          </p>
        </div>
        <TableShell
          isLoading={false}
          isError={false}
          hasData={installmentsData.installments.length > 0}
          loadingContent={null}
          errorContent={null}
          emptyContent={<div className="py-4 text-center text-text-secondary">{tTerm('associateDetails.installments.empty')}</div>}
          recordsLabel={tTerm('associateDetails.installments.recordsLabel')}
        >
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="font-medium">{tTerm('associateDetails.installments.header.number')}</th>
                <th className="font-medium">{tTerm('associateDetails.installments.header.amount')}</th>
                <th className="font-medium">{tTerm('associateDetails.installments.header.dueDate')}</th>
                <th className="font-medium">{tTerm('associateDetails.installments.header.status')}</th>
                <th className="font-medium">{tTerm('associateDetails.installments.header.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {installmentsData.installments.map((inst: any) => {
                const status = getInstallmentStatusPresentation(inst);

                return (
                <tr key={`associate-installment-${inst.id}-${inst.installmentNumber}`} className="hover:bg-hover-bg transition-colors">
                  <td className="font-medium">{inst.installmentNumber}</td>
                  <td className="font-medium">{formatAssociateCurrency(inst.amount)}</td>
                  <td>{formatAssociateDate(inst.dueDate)}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td>
                    {isAdmin && ['pending', 'overdue'].includes(String(inst.status || '').toLowerCase()) && (
                      <ActionButton
                        onClick={() => handleOpenPayInstallmentModal(inst.installmentNumber)}
                        disabled={payInstallment.isPending}
                        isLoading={payInstallment.isPending}
                        icon={<CheckCircle size={14} />}
                        className="min-h-8 px-2.5 py-1.5 text-xs"
                      >
                        {tTerm('associateDetails.installments.cta.markAsPaid')}
                      </ActionButton>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </TableShell>
      </DataTableSurface>
    </div>
  );

  const renderCalendarTab = () => (
    <div className="space-y-4">
      <InsightStrip
        aria-label={tTerm('associateDetails.calendar.ariaLabel')}
        items={[
          {
            id: 'associate-calendar-contributions',
            label: tTerm('associateDetails.calendar.metric.contributions'),
            value: formatNumber(calendarData.summary.contributionCount),
            helper: tTerm('associateDetails.calendar.metric.contributionsHelper'),
            icon: <Wallet size={18} />,
            accent: 'blue',
          },
          {
            id: 'associate-calendar-distributions',
            label: tTerm('associateDetails.calendar.metric.distributions'),
            value: formatNumber(calendarData.summary.distributionCount),
            helper: tTerm('associateDetails.calendar.metric.distributionsHelper'),
            icon: <Download size={18} />,
            accent: 'emerald',
          },
          {
            id: 'associate-calendar-installments',
            label: tTerm('associateDetails.calendar.metric.installments'),
            value: formatNumber(calendarData.summary.installmentCount),
            helper: tTerm('associateDetails.calendar.metric.installmentsHelper'),
            icon: <Calendar size={18} />,
            accent: 'slate',
          },
          {
            id: 'associate-calendar-pending',
            label: tTerm('associateDetails.calendar.metric.pending'),
            value: formatNumber(calendarData.summary.pendingInstallments),
            helper: tTerm('associateDetails.calendar.metric.pendingHelper'),
            icon: <Clock size={18} />,
            accent: calendarData.summary.pendingInstallments > 0 ? 'amber' : 'slate',
          },
        ]}
      />

      {/* Calendar Events */}
      <DataTableSurface>
        <div className="px-5 pt-5 sm:px-6">
          <h3 className="text-lg font-semibold text-text-primary">{tTerm('associateDetails.calendar.title')}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {tTerm('associateDetails.calendar.description')}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <FormField label={tTerm('associateDetails.calendar.filter.from')} htmlFor="associate-calendar-start-date">
              <TextInput
                id="associate-calendar-start-date"
                type="date"
                value={calendarFilters.startDate}
                onChange={(event) => updateCalendarFilter('startDate', event.target.value)}
              />
            </FormField>
            <FormField label={tTerm('associateDetails.calendar.filter.to')} htmlFor="associate-calendar-end-date">
              <TextInput
                id="associate-calendar-end-date"
                type="date"
                value={calendarFilters.endDate}
                onChange={(event) => updateCalendarFilter('endDate', event.target.value)}
              />
            </FormField>
          </div>
        </div>
        <TableShell
          isLoading={false}
          isError={false}
          hasData={calendarData.events.length > 0}
          loadingContent={null}
          errorContent={null}
          emptyContent={<div className="py-4 text-center text-text-secondary">{tTerm('associateDetails.calendar.empty')}</div>}
          recordsLabel={tTerm('associateDetails.calendar.recordsLabel')}
        >
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="font-medium">{tTerm('associateDetails.calendar.header.date')}</th>
                <th className="font-medium">{tTerm('associateDetails.calendar.header.type')}</th>
                <th className="font-medium">{tTerm('associateDetails.calendar.header.amount')}</th>
                <th className="font-medium">{tTerm('associateDetails.calendar.header.notes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {calendarData.events.map((event: any) => (
                <tr key={`${event.type}-${event.id ?? 'no-id'}-${event.date}-${event.displayAmount ?? event.amount}-${event.notes ?? ''}`} className="hover:bg-hover-bg transition-colors">
                  <td>{formatAssociateDate(event.date)}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      event.type === 'contribution' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : event.type === 'distribution'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}>
                      {getCalendarEventTypeLabel(event)}
                    </span>
                  </td>
                  <td className="font-medium">
                    {formatSignedCurrency(event.amount, event.type, event.status)}
                  </td>
                  <td className="text-text-secondary">{event.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </DataTableSurface>
    </div>
  );

  return (
    <PageShell className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8" data-tour="associate-details-page">
      <PageHeader
        title={tTerm('associateDetails.header.title')}
        subtitle={tTerm('associateDetails.header.subtitle', {
          name: associateName,
          debtStatus,
          interestRate: interestRateLabel,
        })}
        guideKey="associate-details"
        tourId="associate-details-header"
        actions={(
          <ActionButton
            onClick={() => navigate('/associates')}
            aria-label={tTerm('associateDetails.cta.backToAssociates')}
            title={tTerm('associateDetails.cta.backToAssociates')}
            icon={<ArrowLeft size={16} />}
          >
            {tTerm('newAssociate.actions.back')}
          </ActionButton>
        )}
      />

      <ToolbarSurface className="items-stretch gap-5 lg:items-center" data-tour="associate-details-actions">
        <div className="min-w-0 lg:max-w-2xl">
          <p className="text-base font-semibold text-text-primary">{tTerm('associateDetails.toolbar.title')}</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {tTerm('associateDetails.toolbar.description')}
          </p>
        </div>
        <div className="grid gap-2 lg:min-w-[30rem]">
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton onClick={() => setShowContributionsModal(true)} icon={<History size={16} />} fullWidth>
              {tTerm('associateDetails.cta.viewInterestHistory')}
            </ActionButton>
            <ActionButton onClick={() => setShowInstallmentsModal(true)} icon={<Clock size={16} />} fullWidth>
              {tTerm('associateDetails.cta.viewInterestSchedule')}
            </ActionButton>
          </div>
          {isAdmin && (
            <div className="grid gap-2 sm:grid-cols-2">
              <ActionButton onClick={() => openMoneyActionModal('contribution')} icon={<Wallet size={16} />} variant="primary" fullWidth>
                {tTerm('associateDetails.cta.registerCapitalContribution')}
              </ActionButton>
              <ActionButton onClick={() => setActiveTab('installments')} icon={<CheckCircle size={16} />} variant="secondary" fullWidth>
                {tTerm('associateDetails.cta.registerInterestPayment')}
              </ActionButton>
              <ActionButton onClick={() => openMoneyActionModal('distribution')} icon={<Download size={16} />} fullWidth>
                {tTerm('associateDetails.cta.registerInterestWithdrawal')}
              </ActionButton>
              <ActionButton onClick={() => openMoneyActionModal('reinvestment')} icon={<RefreshCw size={16} />} fullWidth>
                {tTerm('associateDetails.cta.registerInterestReinvestment')}
              </ActionButton>
            </div>
          )}
        </div>
      </ToolbarSurface>

      {isReadOnlyBackoffice && (
        <SectionSurface className="py-4">
          <p className="text-sm leading-6 text-text-secondary">
          {tTerm('associateDetails.readOnlyNotice')}
          </p>
        </SectionSurface>
      )}

      {/* Tabs */}
      <ViewTabs
        data-tour="associate-details-tabs"
        ariaLabel={tTerm('associateDetails.tabs.ariaLabel')}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as TabType)}
        tabs={[
          { id: 'overview', label: tTerm('associateDetails.tab.overview') },
          { id: 'installments', label: tTerm('associateDetails.tab.installments'), icon: CheckCircle },
          { id: 'calendar', label: tTerm('associateDetails.tab.calendar'), icon: Calendar },
        ]}
      />

      {/* Tab Content */}
      <div data-tour="associate-details-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'installments' && renderInstallmentsTab()}
        {activeTab === 'calendar' && renderCalendarTab()}
      </div>

      {showModal && (
        <ModalShell
          title={showModal === 'contribution'
            ? tTerm('associateDetails.modal.title.contribution')
            : showModal === 'distribution'
              ? tTerm('associateDetails.modal.title.distribution')
              : tTerm('associateDetails.modal.title.reinvestment')}
          onClose={closeMoneyActionModal}
        >
            <form noValidate onSubmit={handleAction} className="space-y-4">
              <FormField
                label={tTerm('associateDetails.modal.field.amount')}
                htmlFor={`associate-action-${showModal}-amount`}
                error={actionErrors[showModal]}
              >
                <MoneyInput
                  key={showModal}
                  id={`associate-action-${showModal}-amount`}
                  value={actionAmounts[showModal]}
                  onValueChange={(value) => {
                    setActionAmounts((current) => ({ ...current, [showModal]: value }));
                    if (actionErrors[showModal]) {
                      setActionErrors((current) => ({ ...current, [showModal]: '' }));
                    }
                  }}
                  placeholder={tTerm('associateDetails.modal.placeholder.amount')}
                />
              </FormField>
              <div className="flex gap-3 pt-4">
                <ActionButton
                  type="button"
                  onClick={closeMoneyActionModal}
                  fullWidth
                >
                  {tTerm('common.cta.cancel')}
                </ActionButton>
                <ActionButton
                  type="submit"
                  disabled={isSubmitting}
                  variant="primary"
                  fullWidth
                >
                  {isSubmitting ? tTerm('associateDetails.modal.submit.pending') : tTerm('common.cta.confirm')}
                </ActionButton>
              </div>
            </form>
        </ModalShell>
      )}

      {payingInstallmentNumber !== null && (
        <ModalShell
          title={tTerm('associateDetails.installmentPayment.title')}
          subtitle={tTerm('associateDetails.installmentPayment.subtitle', { installmentNumber: payingInstallmentNumber })}
          onClose={handleClosePayInstallmentModal}
        >
          <form noValidate onSubmit={handlePayInstallment} className="space-y-4">
            <FormField
              label={tTerm('associateDetails.installmentPayment.field.paymentDate')}
              error={installmentPaymentErrors.paymentDate}
            >
              <TextInput
                type="date"
                value={installmentPaymentForm.paymentDate}
                onChange={(event) => {
                  setInstallmentPaymentForm((prev) => ({ ...prev, paymentDate: event.target.value }));
                  if (installmentPaymentErrors.paymentDate) {
                    setInstallmentPaymentErrors({ paymentDate: '' });
                  }
                }}
              />
            </FormField>
            <FormField label={tTerm('associateDetails.installmentPayment.field.paymentMethod')}>
              <TextInput
                value={installmentPaymentForm.paymentMethod}
                onChange={(event) => setInstallmentPaymentForm((prev) => ({ ...prev, paymentMethod: event.target.value }))}
                placeholder={tTerm('associateDetails.installmentPayment.placeholder.paymentMethod')}
              />
            </FormField>
            <FormField label={tTerm('associateDetails.installmentPayment.field.notes')}>
              <TextAreaInput
                value={installmentPaymentForm.notes}
                onChange={(event) => setInstallmentPaymentForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder={tTerm('associateDetails.installmentPayment.placeholder.notes')}
                rows={3}
              />
            </FormField>
            <div className="flex gap-3 pt-2">
              <ActionButton
                type="button"
                onClick={handleClosePayInstallmentModal}
                fullWidth
              >
                {tTerm('common.cta.cancel')}
              </ActionButton>
              <ActionButton
                type="submit"
                disabled={payInstallment.isPending}
                isLoading={payInstallment.isPending}
                variant="primary"
                fullWidth
              >
                {payInstallment.isPending
                  ? tTerm('associateDetails.installmentPayment.cta.submitting')
                  : tTerm('associateDetails.installmentPayment.cta.submit')}
              </ActionButton>
            </div>
          </form>
        </ModalShell>
      )}

      {showContributionsModal && contributions !== undefined && (
        <ContributionModal
          contributions={contributions}
          isLoading={false}
          onAddContribution={async (data) => {
            await createContribution.mutateAsync(data);
          }}
          onClose={() => setShowContributionsModal(false)}
          canAddContribution={isAdmin}
        />
      )}

      {showInstallmentsModal && (
        <InstallmentsModal
          installments={installments}
          isLoading={false}
          onClose={() => setShowInstallmentsModal(false)}
        />
      )}
    </PageShell>
  );
}
