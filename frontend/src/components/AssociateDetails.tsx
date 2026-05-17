import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, RefreshCw, Download, Calendar, CheckCircle, Clock, AlertCircle, History } from 'lucide-react';
import { useTranslation } from '../i18n';
import { formatCurrency as formatLocaleCurrency, formatDate as formatLocaleDate, formatNumber } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { useAssociateDetails } from '../services/associateService';
import { toast } from '../lib/toast';
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
  PageHeader,
  PageShell,
  SectionSurface,
  TextInput,
  ToolbarSurface,
  ViewTabs,
} from './shared/Surfaces';
import TableShell from './shared/TableShell';

type TabType = 'overview' | 'installments' | 'calendar';

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

export default function AssociateDetails() {
  useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const associateId = Number(id);
  const { user } = useSessionStore();
  const isAdmin = user?.role === 'admin';
  const isSocio = user?.role === 'socio';

  const { portal, installments, contributions, calendar, isLoading, createContribution, createDistribution, createReinvestment, payInstallment } = useAssociateDetails(associateId);
  const associate = portal?.associate ?? null;

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showModal, setShowModal] = useState<'contribution' | 'distribution' | 'reinvestment' | null>(null);
  const [showContributionsModal, setShowContributionsModal] = useState(false);
  const [showInstallmentsModal, setShowInstallmentsModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <PageShell className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionSurface>
          <EmptyState title={tTerm('associateDetails.loading.title')} description={tTerm('associateDetails.loading.description')} compact />
        </SectionSurface>
      </PageShell>
    );
  }

  if (!associate && !portal) {
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

  const portalSummary = portal?.summary;
  const totalContributions = portalSummary?.totalContributed ?? portal?.totalContributions ?? 0;
  const totalDistributions = portalSummary?.totalDistributed ?? portal?.totalDistributions ?? 0;
  const totalInterestPaid = portalSummary?.totalInterestPaid ?? 0;
  const interestDebt = portalSummary?.interestDebt ?? 0;
  const nextInterestPaymentDate = portalSummary?.nextInterestPaymentDate ?? null;
  const debtStatus = portalSummary?.debtStatus === 'pending'
    ? tTerm('associateDetails.debtStatus.pending')
    : tTerm('associateDetails.debtStatus.current');
  const paymentHistory = Array.isArray(portal?.paymentHistory) ? portal.paymentHistory : [];
  const interestTypeLabel = tTerm(associate?.interestType === 'annual' ? 'common.interestType.annual' : 'common.interestType.monthly').toLowerCase();
  const interestRateLabel = tTerm('associateDetails.interestRateLabel', {
    rate: formatNumber(associate?.interestRate || 0, { maximumFractionDigits: 4 }),
    interestType: interestTypeLabel,
  });

  const installmentsData = installments || { installments: [], totals: { totalPending: 0, totalPaid: 0, totalOverdue: 0 } };
  const calendarData = calendar || { events: [], summary: { contributionCount: 0, distributionCount: 0, installmentCount: 0, pendingInstallments: 0 } };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setIsSubmitting(true);
    try {
      const payload = { amount: parseFloat(amount), date: new Date().toISOString() };
      
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
      
      setShowModal(null);
      setAmount('');
      toast.success({ title: tTerm('associateDetails.toast.action.success') });
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'associates' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayInstallment = async (installmentNumber: number) => {
    try {
      await payInstallment.mutateAsync(installmentNumber);
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
                <tr key={entry.id} className="hover:bg-hover-bg transition-colors">
                  <td className="font-medium">{entry.installmentNumber}</td>
                  <td className="font-medium text-emerald-600">{formatAssociateCurrency(entry.amount)}</td>
                  <td>{formatAssociateDate(entry.dueDate)}</td>
                  <td>{formatAssociateDate(entry.paidAt)}</td>
                  <td className="text-text-secondary">{entry.paymentMethod || tTerm('common.notSpecified')}</td>
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
                <tr key={inst.id} className="hover:bg-hover-bg transition-colors">
                  <td className="font-medium">{inst.installmentNumber}</td>
                  <td className="font-medium">{formatAssociateCurrency(inst.amount)}</td>
                  <td>{formatAssociateDate(inst.dueDate)}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td>
                    {isAdmin && inst.status === 'pending' && (
                      <ActionButton
                        onClick={() => handlePayInstallment(inst.installmentNumber)}
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
                <tr key={event.id ?? `${event.type}-${event.date}-${event.displayAmount}-${event.notes ?? ''}`} className="hover:bg-hover-bg transition-colors">
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

      <ToolbarSurface className="items-stretch gap-4 lg:items-center" data-tour="associate-details-actions">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{tTerm('associateDetails.toolbar.title')}</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
            {tTerm('associateDetails.toolbar.description')}
          </p>
        </div>
        <div className="grid gap-2 lg:min-w-[23rem]">
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton onClick={() => setShowContributionsModal(true)} icon={<History size={16} />} fullWidth>
              {tTerm('associateDetails.cta.viewHistory')}
            </ActionButton>
            <ActionButton onClick={() => setShowInstallmentsModal(true)} icon={<Clock size={16} />} fullWidth>
              {tTerm('associateDetails.cta.viewInstallments')}
            </ActionButton>
          </div>
          {isAdmin && (
            <div className="grid gap-2 sm:grid-cols-2">
              <ActionButton onClick={() => setShowModal('contribution')} icon={<Wallet size={16} />} variant="primary" fullWidth>
                {tTerm('associateDetails.cta.registerContribution')}
              </ActionButton>
              <ActionButton onClick={() => setShowModal('distribution')} icon={<Download size={16} />} variant="secondary" fullWidth>
                {tTerm('associateDetails.cta.registerDistribution')}
              </ActionButton>
              <ActionButton onClick={() => setShowModal('reinvestment')} icon={<RefreshCw size={16} />} fullWidth className="sm:col-span-2">
                {tTerm('associateDetails.cta.registerReinvestment')}
              </ActionButton>
            </div>
          )}
        </div>
      </ToolbarSurface>

      {isSocio && (
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
          { id: 'installments', label: tTerm('associateDetails.tab.installments'), icon: Wallet },
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
        >
            <form onSubmit={handleAction} className="space-y-4">
              <FormField label={tTerm('associateDetails.modal.field.amount')} htmlFor="associate-action-amount">
                <TextInput
                  id="associate-action-amount"
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={tTerm('associateDetails.modal.placeholder.amount')}
                />
              </FormField>
              <div className="flex gap-3 pt-4">
                <ActionButton
                  type="button"
                  onClick={() => setShowModal(null)}
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
