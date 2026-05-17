import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bell, Clock, DollarSign, ShieldAlert, Activity, AlertCircle, FileText } from 'lucide-react';
import { useInstallmentQuote, useLoanById, useLoanDetails, useLoans, PAYMENT_METHODS as FALLBACK_PAYMENT_METHODS, type PaymentMethod, type CapitalStrategy } from '../services/loanService';
import { useConfig } from '../services/configService';
import { exportCreditExcel, useCreditReports } from '../services/reportService';
import { useSessionStore } from '../store/sessionStore';
import { downloadVoucher } from '../services/paymentService';
import { toast } from '../lib/toast';
import { useQueryClient } from '@tanstack/react-query';
import { useOperationalActions } from './hooks/useOperationalActions';
import { useOperationalModalState } from './hooks/useOperationalModalState';
import { invalidateAfterPayment, invalidateAfterPromiseOrFollowUp } from '../services/operationalInvalidation';
import { tTerm } from '../i18n/terminology';
import { useSafeMutationAction } from './hooks/useSafeMutationAction';
import { getPaymentTypeLabel } from '../constants/paymentTypes';
import { useTranslation } from '../i18n';
import {
  formatCurrency as formatCurrencyValue,
  formatDate as formatDateValue,
  formatDateTime as formatDateTimeValue,
} from '../i18n/format';
import { confirmDanger } from '../lib/confirmModal';
import { resolveOperationalGuard } from '../services/operationalGuards';
import { CreditDetailHeader } from './creditDetails/CreditDetailHeader';
import { CreditSummaryMetrics } from './creditDetails/CreditSummaryMetrics';
import { CreditDetailsTabs, type CreditDetailsTab } from './creditDetails/CreditDetailsTabs';
import { InstallmentActionButton } from './creditDetails/InstallmentActionButton';
import { ActionButton, EmptyState } from './shared/Surfaces';
import {
  formatPayoffDenialReason,
  formatCapitalPaymentDenialReason,
  stableCreditKey,
  formatOperationalStatus,
  getStatusInfo,
  formatPromiseStatus,
  getAlertPresentation,
  computeCapitalPreview,
  PAYABLE_STATUSES,
} from './creditDetails/creditDetailsHelpers';
import { CalendarTab } from './creditDetails/CalendarTab';
import { AlertsTab } from './creditDetails/AlertsTab';
import { PromisesTab } from './creditDetails/PromisesTab';
import { PayoutsTab } from './creditDetails/PayoutsTab';
import { HistoryTab } from './creditDetails/HistoryTab';
import { CreditDetailsModals } from './creditDetails/CreditDetailsModals';

export default function CreditDetails() {
  // -------------------------------------------------------------------------
  // Navigation & identity
  // -------------------------------------------------------------------------
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { locale } = useTranslation();
  const loanId = Number(id);
  const [activeTab, setActiveTab] = useState<CreditDetailsTab>('calendar');
  const { user } = useSessionStore();
  const isAdmin = user?.role === 'admin';
  const isBackofficeUser = user?.role === 'admin' || user?.role === 'employee';
  const canViewPayoff = isBackofficeUser;

  // -------------------------------------------------------------------------
  // Config & payment method options
  // -------------------------------------------------------------------------
  const { paymentMethods: configuredPaymentMethods } = useConfig({ enabled: isAdmin });
  const paymentMethodOptions = useMemo(() => {
    const active = configuredPaymentMethods
      .filter((m: any) => m?.isActive !== false)
      .map((m: any) => ({
        value: String(m?.key ?? m?.type ?? '').trim().toLowerCase(),
        label: String(m?.label ?? m?.name ?? m?.key ?? m?.type ?? '').trim(),
      }))
      .filter((m) => m.value && m.label);
    return active.length > 0 ? active : [...FALLBACK_PAYMENT_METHODS];
  }, [configuredPaymentMethods]);
  const defaultPaymentMethod = paymentMethodOptions[0]?.value || 'transfer';

  // -------------------------------------------------------------------------
  // Operational hooks
  // -------------------------------------------------------------------------
  const { executeGuardedAction } = useOperationalActions(queryClient);
  const operationalModal = useOperationalModalState();

  // -------------------------------------------------------------------------
  // Data queries
  // -------------------------------------------------------------------------
  const { data: loansData, isLoading: isLoadingLoans, updateLoanStatus } = useLoans(undefined, {
    enabled: !Number.isFinite(loanId) || !loanId || isAdmin,
  });
  const { data: loanData, isLoading: isLoadingLoanRecord } = useLoanById(loanId);
  const loans = Array.isArray(loansData?.data?.loans)
    ? loansData.data.loans
    : Array.isArray(loansData?.data) ? loansData.data : [];
  const loan = loanData?.data?.loan ?? loans.find((l: any) => Number(l?.id) === loanId);
  const payoffEligibility = loan?.paymentContext?.payoffEligibility;
  const capitalEligibility = loan?.paymentContext?.capitalEligibility;
  const shouldFetchPayoffQuote = canViewPayoff && Boolean(payoffEligibility?.allowed);
  const primaryPayoffDenialReason = Array.isArray(payoffEligibility?.denialReasons) ? payoffEligibility.denialReasons[0] : null;
  const primaryCapitalDenialReason = Array.isArray(capitalEligibility?.denialReasons) ? capitalEligibility.denialReasons[0] : null;

  const {
    calendar, calendarSnapshot, alerts, promises, payoffQuote,
    isLoading: isLoadingDetails,
    createPromise, createFollowUp, executePayoff, recordPayment,
    annulInstallment, updatePaymentMethod: updatePaymentMethodMutation,
    updateAlertStatus, updatePromiseStatus, downloadPromiseDocument,
    recordCapitalPayment, updateLateFeeRate: updateLateFeeRateMutation,
  } = useLoanDetails(loanId, {
    includeAlerts: isBackofficeUser,
    includePromises: isBackofficeUser,
    includePayoffQuote: shouldFetchPayoffQuote,
  });
  const { history, isLoading: isLoadingHistory } = useCreditReports(loanId);

  // -------------------------------------------------------------------------
  // Formatters (thin wrappers)
  // -------------------------------------------------------------------------
  const formatDate = (value: unknown, withTime = false) => {
    if (!value) return tTerm('creditDetails.label.noDate');
    return (withTime
      ? formatDateTimeValue(value, { dateStyle: 'medium', timeStyle: 'short' })
      : formatDateValue(value, { dateStyle: 'medium', timeZone: 'UTC' })) || tTerm('creditDetails.label.noDate');
  };
  const formatCurrency = (value: unknown) => formatCurrencyValue(value, { maximumFractionDigits: 2 });
  const formatMetricCurrency = (value: unknown) => formatCurrencyValue(value, { maximumFractionDigits: 0 });

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const statusInfo = getStatusInfo(loan?.status);
  const promiseDate = (promise: any) => promise?.promisedDate || promise?.promiseDate || promise?.createdAt;

  const installmentPaymentGuard = resolveOperationalGuard('installment.pay', { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status });
  const baseCapitalPaymentGuard = resolveOperationalGuard('capital.payment', { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status });
  const capitalUnavailableDescription = formatCapitalPaymentDenialReason(primaryCapitalDenialReason) || tTerm('creditDetails.capital.unavailable.firstInstallment');
  const capitalPaymentGuard = {
    ...baseCapitalPaymentGuard,
    executable: Boolean(baseCapitalPaymentGuard.executable && capitalEligibility?.allowed !== false),
    reason: baseCapitalPaymentGuard.executable && capitalEligibility?.allowed === false ? capitalUnavailableDescription : baseCapitalPaymentGuard.reason,
  };
  const lateFeeUpdateGuard = resolveOperationalGuard('lateFee.update', { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status });
  const creditStatusUpdateGuard = resolveOperationalGuard('credit.status.update', { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status });
  const showInstallmentActionColumn = isBackofficeUser || installmentPaymentGuard.visible;
  const creditDetailSubtitle = isBackofficeUser ? tTerm('creditDetails.subtitle.backoffice') : tTerm('creditDetails.subtitle.customer');

  const paymentHistoryEntries = useMemo(() => {
    const source = history?.data?.history ?? history;
    const payments = Array.isArray(source?.payments) ? source.payments : [];
    const payoffHistory = Array.isArray(source?.payoffHistory) ? source.payoffHistory : [];
    return [
      ...payments.map((p: any) => ({
        id: p.id ?? stableCreditKey('payment', p.paymentDate, p.createdAt, p.amount, p.installmentNumber),
        paymentId: Number(p.id), amount: p.amount, paymentType: p.paymentType,
        installmentNumber: p.installmentNumber, principalApplied: p.principalApplied,
        interestApplied: p.interestApplied, penaltyApplied: p.penaltyApplied,
        paymentMethod: p.paymentMethod,
        paymentStatus: p.status,
        paymentReconciled: Boolean(p.reconciled || p.isReconciled || String(p.status || '').toLowerCase().includes('reconcil')),
        action: tTerm('creditDetails.history.action.payment', { type: getPaymentTypeLabel(p.paymentType) }),
        description: tTerm('creditDetails.history.description.amount', { amount: formatCurrency(p.amount) }),
        date: p.paymentDate || p.createdAt, type: 'payment',
      })),
      ...payoffHistory.map((e: any) => ({
        id: stableCreditKey('payoff', e.id, e.paymentDate, e.createdAt, e.amount, e.quotedTotal),
        action: tTerm('creditDetails.history.action.payoffApplied'),
        description: tTerm('creditDetails.history.description.amount', { amount: formatCurrency(e.amount ?? e.quotedTotal) }),
        date: e.paymentDate || e.createdAt, type: 'payoff',
      })),
    ].filter((e) => e.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [history, locale]);

  let customerLabel = loan?.Customer?.name || loan?.customerName || '';
  if (customerLabel) customerLabel = customerLabel.replace(/(qa|seed|test|dev|customer|socio|partner|admin|live|user|demo|example|sample)\s*/ig, '').trim();
  customerLabel = customerLabel || (loan?.customerId ? tTerm('credits.label.customerFallback', { id: loan.customerId }) : tTerm('credits.label.customerMissing'));

  const calendarEntries = Array.isArray(calendar) ? calendar : [];
  const reportHistorySource = history?.data?.history ?? history;
  const reportAlertEntries = Array.isArray(reportHistorySource?.alerts) ? reportHistorySource.alerts : [];
  const reportPromiseEntries = Array.isArray(reportHistorySource?.promises) ? reportHistorySource.promises : [];
  const paymentSnapshot = loan?.paymentContext?.snapshot;
  const alertEntries = Array.isArray(alerts) && alerts.length > 0 ? alerts : reportAlertEntries;
  const promiseEntries = Array.isArray(promises) && promises.length > 0 ? promises : reportPromiseEntries;

  const hasNoOutstandingPayoffBalance = (
    (loan?.paymentContext?.snapshot?.outstandingBalance ?? 0) <= 0.01
    || ['closed', 'completed', 'paid', 'cancelled'].includes(String(loan?.status || '').toLowerCase())
  );
  const payoffUnavailableDescription = formatPayoffDenialReason(primaryPayoffDenialReason)
    || (hasNoOutstandingPayoffBalance ? tTerm('creditDetails.payoff.unavailable.noBalance') : tTerm('creditDetails.payoff.unavailable.ineligible'));
  const payoffPaymentGuard = {
    visible: canViewPayoff,
    executable: Boolean(canViewPayoff && payoffEligibility?.allowed && payoffQuote),
    reason: payoffEligibility?.allowed ? tTerm('creditDetails.payoff.state.preparingQuote') : payoffUnavailableDescription,
  };

  const operationalHistoryEntries = useMemo(() => {
    const alertEvents = alertEntries.flatMap((alert: any) => {
      const pres = getAlertPresentation(alert, formatCurrency);
      const events = [{ id: `alert-created-${alert.id}`, action: alert.status === 'resolved' ? tTerm('creditDetails.history.action.alertResolved') : tTerm('creditDetails.history.action.alertActive'), description: `${pres.typeLabel} · ${pres.summary}`, date: alert.resolvedAt || alert.createdAt || alert.dueDate, type: 'alert', status: alert.status }];
      if (pres.notes) events.push({ id: `alert-note-${alert.id}`, action: tTerm('creditDetails.history.action.followUpLogged'), description: pres.notes, date: alert.updatedAt || alert.createdAt || alert.dueDate, type: 'alert', status: alert.status });
      return events;
    });
    const promiseEvents = promiseEntries.flatMap((p: any) => {
      const base = [{ id: `promise-created-${p.id}`, action: tTerm('creditDetails.history.action.promiseCreated'), description: tTerm('creditDetails.history.description.promiseForDate', { amount: formatCurrency(p.amount), date: formatDate(promiseDate(p)) }), date: p.createdAt || p.promisedDate, type: 'promise', status: p.status }];
      const statusEvts = Array.isArray(p.statusHistory) ? p.statusHistory.map((e: any, i: number) => ({ id: `promise-status-${p.id}-${i}`, action: tTerm('creditDetails.history.action.promiseStatusUpdated'), description: `${formatOperationalStatus(e.status)}${e.note ? ` · ${e.note}` : ''}`, date: e.changedAt || p.updatedAt || p.promisedDate, type: 'promise', status: e.status })) : [];
      return [...base, ...statusEvts];
    });
    return [...paymentHistoryEntries, ...alertEvents, ...promiseEvents].filter((e) => e.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [alertEntries, paymentHistoryEntries, promiseEntries, locale]);

  const visibleTabs = useMemo(() => {
    const tabs: CreditDetailsTab[] = ['calendar'];
    if (isBackofficeUser) tabs.push('alerts', 'promises');
    tabs.push('payouts', 'history');
    return tabs;
  }, [isBackofficeUser]);

  // -------------------------------------------------------------------------
  // Modal state
  // -------------------------------------------------------------------------
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultPaymentMethod);
  const [selectedInstallmentNumber, setSelectedInstallmentNumber] = useState<number | null>(null);
  const [promiseAmount, setPromiseAmount] = useState('');
  const [promiseDateInput, setPromiseDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [promiseNotes, setPromiseNotes] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [showAnnulModal, setShowAnnulModal] = useState(false);
  const [annulInstallmentNumber, setAnnulInstallmentNumber] = useState<number | null>(null);
  const [annulReason, setAnnulReason] = useState('');
  const [showEditPaymentMethodModal, setShowEditPaymentMethodModal] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [editingPaymentReconciled, setEditingPaymentReconciled] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethod>(defaultPaymentMethod);
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [capitalAmount, setCapitalAmount] = useState('');
  const [capitalMethod, setCapitalMethod] = useState<PaymentMethod>(defaultPaymentMethod);
  const [capitalStrategy, setCapitalStrategy] = useState<CapitalStrategy>('reduce_term');
  const [capitalPaymentDate, setCapitalPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [showLateFeeModal, setShowLateFeeModal] = useState(false);
  const [lateFeeRate, setLateFeeRate] = useState('');

  // -------------------------------------------------------------------------
  // Safe mutation wrappers
  // -------------------------------------------------------------------------
  const { run: runPayoff } = useSafeMutationAction<{ asOfDate: string; quotedTotal: number }>({
    action: async (payload) => executePayoff.mutateAsync(payload),
    errorContext: { domain: 'credits', action: 'generic' },
    successMessage: tTerm('creditDetails.toast.payoff.success'),
  });
  const { run: runDownloadVoucher } = useSafeMutationAction<number>({
    action: async (paymentId) => downloadVoucher(paymentId),
    errorContext: { domain: 'payments', action: 'generic' },
    successMessage: tTerm('payouts.toast.voucher.success'),
  });
  const { run: runExportCreditExcel, isSubmitting: isExportingCreditExcel } = useSafeMutationAction<number>({
    action: async (targetLoanId) => exportCreditExcel(targetLoanId),
    errorContext: { domain: 'reports', action: 'reports.export' },
    successMessage: tTerm('creditDetails.toast.exportExcel'),
  });

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------
  React.useEffect(() => {
    const valid = new Set(paymentMethodOptions.map((m) => m.value));
    if (!valid.has(paymentMethod)) setPaymentMethod(defaultPaymentMethod);
    if (!valid.has(newPaymentMethod)) setNewPaymentMethod(defaultPaymentMethod);
    if (!valid.has(capitalMethod)) setCapitalMethod(defaultPaymentMethod);
  }, [capitalMethod, defaultPaymentMethod, newPaymentMethod, paymentMethod, paymentMethodOptions]);

  React.useEffect(() => {
    if (!visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0] ?? 'calendar');
  }, [activeTab, visibleTabs]);

  // -------------------------------------------------------------------------
  // Computed installment data
  // -------------------------------------------------------------------------
  const nextPayableInstallmentNumber = useMemo(() => {
    const c = calendarEntries
      .filter((e: any) => PAYABLE_STATUSES.has(String(e?.status || '').toLowerCase()))
      .map((e: any) => Number(e?.installmentNumber))
      .filter((v: number) => Number.isFinite(v))
      .sort((a, b) => a - b)[0];
    return Number.isFinite(c) ? c : null;
  }, [calendarEntries]);

  const capitalPreview = useMemo(
    () => computeCapitalPreview(capitalAmount, capitalStrategy, loan, paymentSnapshot),
    [capitalAmount, capitalStrategy, loan, paymentSnapshot],
  );

  const isRecordPaymentModalOpen = operationalModal.is('record-payment');
  const isPromiseModalOpen = operationalModal.is('create-promise');
  const isFollowUpModalOpen = operationalModal.is('create-follow-up');

  const installmentQuoteQuery = useInstallmentQuote(loanId, selectedInstallmentNumber, paymentDate, {
    enabled: isRecordPaymentModalOpen && Boolean(selectedInstallmentNumber),
  });
  const installmentQuote = installmentQuoteQuery.data?.data?.quote;

  const installmentRows = useMemo(() => {
    const initial = Number(loan?.amount ?? 0);
    return calendarEntries.reduce((rows: any[], inst: any, idx: number) => {
      const sp = inst.scheduledPayment ?? 0;
      const ic = inst.interestComponent ?? inst.remainingInterest ?? 0;
      const pc = inst.principalComponent ?? Math.max(0, sp - ic);
      const ob = idx === 0 ? initial : rows[idx - 1].closingBalance;
      const cb = Number.isFinite(Number(inst.remainingBalance)) ? Number(inst.remainingBalance) : Math.max(0, ob - pc);
      const n = Number(inst.installmentNumber);
      rows.push({
        installmentNumber: Number.isFinite(n) ? n : inst.installmentNumber,
        scheduledPayment: sp, interestComponent: ic, principalComponent: pc,
        openingBalance: ob, closingBalance: cb,
        outstandingAmount: inst.outstandingAmount, payableAmount: inst.payableAmount,
        lateFeeDue: inst.lateFeeDue, daysOverdue: inst.daysOverdue,
        canPay: inst.canPay, disabledReason: inst.disabledReason, status: inst.status,
      });
      return rows;
    }, []);
  }, [calendarEntries, loan?.amount]);

  const installmentColumnTotals = useMemo(() => {
    const totals = installmentRows.reduce((acc: any, row: any) => {
      acc.scheduledPayment += Number(row.scheduledPayment || 0);
      acc.interestComponent += Number(row.interestComponent || 0);
      acc.lateFeeDue += Number(row.lateFeeDue || 0);
      acc.principalComponent += Number(row.principalComponent || 0);
      return acc;
    }, { scheduledPayment: 0, interestComponent: 0, lateFeeDue: 0, principalComponent: 0 });
    const lastCB = installmentRows.length > 0 ? Number(installmentRows[installmentRows.length - 1]?.closingBalance || 0) : Number(loan?.amount || 0);
    return { ...totals, outstandingBalance: Number(calendarSnapshot?.outstandingBalance ?? lastCB) };
  }, [calendarSnapshot?.outstandingBalance, installmentRows, loan?.amount]);

  // -------------------------------------------------------------------------
  // Early returns
  // -------------------------------------------------------------------------
  if (!Number.isFinite(loanId) || loanId <= 0) {
    return (
      <div className="mx-auto w-full max-w-[88rem] px-4 py-8 lg:px-6">
        <EmptyState title={tTerm('creditDetails.empty.invalidId')} icon={<AlertCircle size={18} />}
          action={<ActionButton onClick={() => navigate('/credits')}>{tTerm('newCredit.header.back')}</ActionButton>} />
      </div>
    );
  }
  if (isLoadingLoans || isLoadingLoanRecord || isLoadingDetails) {
    return (
      <div className="mx-auto w-full max-w-[88rem] px-4 py-8 lg:px-6">
        <EmptyState title={tTerm('creditDetails.state.loading')} icon={<Activity size={18} />} compact />
      </div>
    );
  }
  if (!loan) {
    return (
      <div className="mx-auto w-full max-w-[88rem] px-4 py-8 lg:px-6">
        <EmptyState title={tTerm('creditDetails.empty.notFound')} icon={<FileText size={18} />}
          action={<ActionButton onClick={() => navigate('/credits')}>{tTerm('newCredit.header.back')}</ActionButton>} />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Action handlers
  // -------------------------------------------------------------------------
  const handlePayoff = async () => {
    if (!payoffQuote) return;
    const quotedTotal = payoffQuote.total ?? payoffQuote.totalPayoffAmount;
    const confirmed = await confirmDanger({ title: tTerm('confirm.payoff.title'), message: tTerm('confirm.payoff.message').replace('{amount}', formatCurrency(quotedTotal)), confirmLabel: tTerm('confirm.payoff.confirm') });
    if (!confirmed) return;
    await runPayoff({ asOfDate: payoffQuote.asOfDate, quotedTotal });
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    await executeGuardedAction({
      action: 'credit.status.update',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status },
      run: async () => { await updateLoanStatus.mutateAsync({ id: loanId, status: newStatus }); },
      onSuccess: async () => { await invalidateAfterPromiseOrFollowUp(queryClient, { loanId }); setShowStatusModal(false); },
      successMessage: tTerm('creditDetails.toast.statusUpdated'),
    });
  };

  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) { toast.error({ title: tTerm('payouts.validation.amount') }); return; }
    const inst = operationalModal.payload?.installment;
    const instNum = inst?.installmentNumber ?? selectedInstallmentNumber;
    if (!instNum) { toast.error({ title: tTerm('creditDetails.error.installmentSelection') }); return; }
    await executeGuardedAction({
      action: 'installment.pay',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status, installmentStatus: inst?.status },
      confirmationMessage: `¿Confirmar pago de cuota #${instNum} por ${formatCurrency(amount)}?`,
      run: async () => { await recordPayment.mutateAsync({ paymentAmount: amount, paymentDate, paymentMethod, installmentNumber: instNum }); },
      onSuccess: async () => { operationalModal.closeModal(); setPaymentAmount(''); setSelectedInstallmentNumber(null); await invalidateAfterPayment(queryClient, { loanId }); },
      successMessage: tTerm('creditDetails.toast.paymentSuccess'),
    });
  };

  const handleAnnulInstallment = async () => {
    if (!annulInstallmentNumber) { toast.error({ title: tTerm('creditDetails.error.annulSelection') }); return; }
    await executeGuardedAction({
      action: 'installment.annul',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status, installmentStatus: operationalModal.payload?.installment?.status },
      run: async () => { await annulInstallment.mutateAsync({ installmentNumber: annulInstallmentNumber, reason: annulReason || undefined }); },
      onSuccess: async () => { await invalidateAfterPayment(queryClient, { loanId }); setShowAnnulModal(false); setAnnulInstallmentNumber(null); setAnnulReason(''); },
      successMessage: tTerm('creditDetails.toast.annulSuccess'),
    });
  };

  const handleUpdatePaymentMethod = async () => {
    if (!editingPaymentId) return;
    await executeGuardedAction({
      action: 'installment.editPaymentMethod',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status, installmentStatus: operationalModal.payload?.installment?.status, paymentReconciled: editingPaymentReconciled },
      confirmationMessage: tTerm('creditDetails.confirm.editPaymentMethod'),
      run: async () => { await updatePaymentMethodMutation.mutateAsync({ paymentId: editingPaymentId, paymentMethod: newPaymentMethod }); },
      onSuccess: async () => { await invalidateAfterPayment(queryClient, { loanId }); setShowEditPaymentMethodModal(false); operationalModal.closeModal(); setEditingPaymentId(null); setEditingPaymentReconciled(false); },
      successMessage: tTerm('payouts.toast.edit.success'),
    });
  };

  const handleCreatePromise = async () => {
    const amount = parseFloat(promiseAmount);
    const inst = operationalModal.payload?.installment;
    if (!inst?.installmentNumber) { toast.error({ title: tTerm('creditDetails.error.promiseInstallment') }); return; }
    if (!amount || amount <= 0) { toast.error({ title: tTerm('payouts.validation.amount') }); return; }
    await executeGuardedAction({
      action: 'installment.promise',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status, installmentStatus: inst?.status },
      run: async () => { await createPromise.mutateAsync({ amount, promisedDate: promiseDateInput, notes: promiseNotes || undefined, installmentNumber: inst.installmentNumber }); },
      onSuccess: async () => { operationalModal.closeModal(); setPromiseAmount(''); setPromiseNotes(''); await invalidateAfterPromiseOrFollowUp(queryClient, { loanId }); },
      successMessage: tTerm('creditDetails.toast.promiseSuccess'),
    });
  };

  const handleCreateFollowUp = async () => {
    const inst = operationalModal.payload?.installment;
    if (!inst?.installmentNumber) { toast.error({ title: tTerm('creditDetails.error.followUpInstallment') }); return; }
    if (!followUpNotes.trim()) { toast.error({ title: tTerm('creditDetails.error.followUpNote') }); return; }
    await executeGuardedAction({
      action: 'installment.followUp',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status, installmentStatus: inst?.status },
      run: async () => { await createFollowUp.mutateAsync({ notes: followUpNotes, installmentNumber: inst.installmentNumber }); },
      onSuccess: async () => { operationalModal.closeModal(); setFollowUpNotes(''); await invalidateAfterPromiseOrFollowUp(queryClient, { loanId }); },
      successMessage: tTerm('creditDetails.toast.followUpSuccess'),
    });
  };

  const handleUpdateAlertStatus = async (alert: any, status: 'active' | 'resolved') => {
    const alertId = Number(alert?.id);
    if (!Number.isFinite(alertId)) { toast.error({ title: tTerm('creditDetails.error.alertId') }); return; }
    const confirmed = await confirmDanger({
      title: status === 'resolved' ? tTerm('creditDetails.confirm.alert.resolve.title') : tTerm('creditDetails.confirm.alert.reactivate.title'),
      message: status === 'resolved' ? tTerm('creditDetails.confirm.alert.resolve.message') : tTerm('creditDetails.confirm.alert.reactivate.message'),
      confirmLabel: status === 'resolved' ? tTerm('creditDetails.confirm.alert.resolve.confirm') : tTerm('creditDetails.confirm.alert.reactivate.confirm'),
    });
    if (!confirmed) return;
    await updateAlertStatus.mutateAsync({ alertId, status, notes: status === 'resolved' ? 'Resuelta manualmente desde detalle de crédito.' : 'Reactivada manualmente desde detalle de crédito.' });
    await invalidateAfterPromiseOrFollowUp(queryClient, { loanId });
    toast.success({ title: status === 'resolved' ? tTerm('creditDetails.toast.alertResolved') : tTerm('creditDetails.toast.alertReactivated') });
  };

  const handleUpdatePromiseStatus = async (promise: any, status: 'pending' | 'kept' | 'broken' | 'cancelled') => {
    const promiseId = Number(promise?.id);
    if (!Number.isFinite(promiseId)) { toast.error({ title: tTerm('creditDetails.error.promiseId') }); return; }
    const confirmed = await confirmDanger({ title: tTerm('creditDetails.confirm.promise.title'), message: tTerm('creditDetails.confirm.promise.message', { status: formatOperationalStatus(status) }), confirmLabel: tTerm('creditDetails.confirm.promise.confirm') });
    if (!confirmed) return;
    await updatePromiseStatus.mutateAsync({ promiseId, status, notes: `Actualizado a ${formatPromiseStatus(status)} desde detalle de crédito.` });
    await invalidateAfterPromiseOrFollowUp(queryClient, { loanId });
    toast.success({ title: tTerm('creditDetails.toast.promiseUpdated') });
  };

  const handleDownloadPromise = async (promise: any) => {
    const promiseId = Number(promise?.id);
    if (!Number.isFinite(promiseId)) { toast.error({ title: tTerm('creditDetails.error.promiseId') }); return; }
    await downloadPromiseDocument.mutateAsync(promiseId);
    toast.success({ title: tTerm('creditDetails.toast.promiseDocument') });
  };

  const handleRecordCapital = async () => {
    const amount = parseFloat(capitalAmount);
    if (!amount || amount <= 0) { toast.error({ title: tTerm('payouts.validation.amount') }); return; }
    if (!capitalPaymentGuard.executable) { toast.error({ title: tTerm('creditDetails.toast.capitalUnavailable'), description: capitalPaymentGuard.reason || capitalUnavailableDescription }); return; }
    await executeGuardedAction({
      action: 'capital.payment',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status },
      run: async () => { await recordCapitalPayment.mutateAsync({ amount, paymentDate: capitalPaymentDate, paymentMethod: capitalMethod, strategy: capitalStrategy }); },
      onSuccess: async () => { await invalidateAfterPayment(queryClient, { loanId }); setShowCapitalModal(false); setCapitalAmount(''); setCapitalPaymentDate(new Date().toISOString().slice(0, 10)); },
      successMessage: tTerm('creditDetails.toast.capitalSuccess'),
    });
  };

  const handleUpdateLateFeeRate = async () => {
    const rate = parseFloat(lateFeeRate);
    if (isNaN(rate) || rate < 0 || rate > 100) { toast.error({ title: tTerm('creditDetails.validation.lateFeeRate') }); return; }
    await executeGuardedAction({
      action: 'lateFee.update',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status },
      run: async () => { await updateLateFeeRateMutation.mutateAsync(rate); },
      onSuccess: async () => { await invalidateAfterPromiseOrFollowUp(queryClient, { loanId }); setShowLateFeeModal(false); setLateFeeRate(''); },
      successMessage: tTerm('creditDetails.toast.lateFeeSuccess'),
    });
  };

  // -------------------------------------------------------------------------
  // Modal openers
  // -------------------------------------------------------------------------
  const openInstallmentPayment = (row: any) => {
    const n = Number(row?.installmentNumber);
    if (!Number.isFinite(n) || n <= 0) { toast.error({ title: tTerm('creditDetails.error.installmentId') }); return; }
    setSelectedInstallmentNumber(n);
    setPaymentAmount(String(row.payableAmount ?? row.outstandingAmount ?? row.scheduledPayment ?? ''));
    operationalModal.openModal('record-payment', { loanId, installment: { installmentId: n, installmentNumber: n, amount: row.payableAmount ?? row.scheduledPayment, status: row.status } });
  };

  const openNextInstallmentPayment = () => {
    const next = calendarEntries.find((e: any) => Number(e?.installmentNumber) === nextPayableInstallmentNumber);
    if (!next) { toast.error({ title: tTerm('creditDetails.error.noPendingInstallments') }); return; }
    openInstallmentPayment(next);
  };

  const openPromiseFromInstallment = (row: any) => {
    const n = Number(row?.installmentNumber);
    if (!Number.isFinite(n) || n <= 0) { toast.error({ title: tTerm('creditDetails.error.promiseInstallment') }); return; }
    operationalModal.openModal('create-promise', { loanId, installment: { installmentId: n, installmentNumber: n, amount: row.scheduledPayment, status: row.status } });
    setPromiseAmount(String(row.scheduledPayment ?? ''));
  };

  const openFollowUpFromInstallment = (row: any) => {
    const n = Number(row?.installmentNumber);
    if (!Number.isFinite(n) || n <= 0) { toast.error({ title: tTerm('creditDetails.error.followUpInstallment') }); return; }
    operationalModal.openModal('create-follow-up', { loanId, installment: { installmentId: n, installmentNumber: n, amount: row.scheduledPayment, status: row.status } });
  };

  const openAnnulModal = (installmentNumber: number) => { setAnnulInstallmentNumber(installmentNumber); setShowAnnulModal(true); };

  const openEditPaymentMethodModal = (entry: any) => {
    const pid = Number(entry?.paymentId);
    if (!Number.isFinite(pid)) { toast.error({ title: tTerm('creditDetails.error.paymentId') }); return; }
    const norm = String(entry?.paymentMethod || defaultPaymentMethod).toLowerCase();
    const has = paymentMethodOptions.some((m) => m.value === norm);
    setEditingPaymentId(pid);
    setEditingPaymentReconciled(Boolean(entry?.paymentReconciled));
    setNewPaymentMethod((has ? norm : defaultPaymentMethod) as PaymentMethod);
    setShowEditPaymentMethodModal(true);
  };

  const calculationProfileSummary = loan?.calculationProfile?.name
    ? tTerm('creditDetails.calculationProfile.namedVersion', { name: loan.calculationProfile.name, version: loan.calculationProfile.version })
    : loan?.calculationProfileVersionId
      ? tTerm('creditDetails.calculationProfile.versionedRule', { version: loan.calculationProfileVersionId })
      : tTerm('creditDetails.calculationProfile.frozenSnapshot');

  // -------------------------------------------------------------------------
  // Installment action renderer (passed to CalendarTab)
  // -------------------------------------------------------------------------
  const renderInstallmentActions = (row: any, options?: { alignClassName?: string; titlePrefix?: string }) => {
    if (!['pending', 'overdue', 'partial'].includes(String(row?.status || '').toLowerCase())) return null;
    const align = options?.alignClassName ?? 'justify-end';
    const prefix = options?.titlePrefix ?? '';
    const isNext = row.installmentNumber === nextPayableInstallmentNumber;
    const payG = resolveOperationalGuard('installment.pay', { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status, installmentStatus: row.status });
    const annG = resolveOperationalGuard('installment.annul', { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status, installmentStatus: row.status });
    const proG = resolveOperationalGuard('installment.promise', { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status, installmentStatus: row.status });
    const folG = resolveOperationalGuard('installment.followUp', { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status, installmentStatus: row.status });
    const instReason = isNext ? '' : (nextPayableInstallmentNumber ? tTerm('creditDetails.installmentActions.onlyNextPending', { number: nextPayableInstallmentNumber }) : tTerm('creditDetails.installmentActions.nonePending'));
    const payReason = payG.executable ? instReason : (payG.reason || instReason);
    const annReason = annG.executable ? instReason : (annG.reason || instReason);

    return (
      <div className={`credit-installment-actions inline-flex flex-nowrap items-center gap-1.5 ${align}`} role="toolbar" aria-label={tTerm('creditDetails.installmentActions.aria', { number: row.installmentNumber })}>
        {payG.visible && (
          <InstallmentActionButton onClick={() => openInstallmentPayment(row)} disabled={!isNext || !payG.executable}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-text-secondary transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
            label={isNext && payG.executable ? `${prefix}${isBackofficeUser ? tTerm('credits.action.registerPayment') : tTerm('creditDetails.cta.payInstallment')}` : payReason}>
            <DollarSign size={16} />
          </InstallmentActionButton>
        )}
        {(proG.visible || folG.visible || annG.visible) && (<>
          {proG.visible && (
            <InstallmentActionButton onClick={() => openPromiseFromInstallment(row)} disabled={!isNext || !proG.executable}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-text-secondary transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10 dark:hover:text-amber-200"
              label={isNext && proG.executable ? `${prefix}${tTerm('credits.action.createPromise')}` : (proG.reason || instReason)}>
              <Clock size={16} />
            </InstallmentActionButton>
          )}
          {folG.visible && (
            <InstallmentActionButton onClick={() => openFollowUpFromInstallment(row)} disabled={!isNext || !folG.executable}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-text-secondary transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent dark:hover:border-slate-500/30 dark:hover:bg-slate-500/10 dark:hover:text-slate-200"
              label={isNext && folG.executable ? `${prefix}${tTerm('credits.action.createFollowUp')}` : (folG.reason || instReason)}>
              <Bell size={16} />
            </InstallmentActionButton>
          )}
          {annG.visible && (
            <InstallmentActionButton onClick={() => openAnnulModal(row.installmentNumber)} disabled={!isNext || !annG.executable}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-text-secondary transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
              label={isNext && annG.executable ? `${prefix}${tTerm('credits.action.annulInstallment')}` : annReason}>
              <ShieldAlert size={16} />
            </InstallmentActionButton>
          )}
        </>)}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="mx-auto w-full max-w-[88rem] min-w-0 space-y-5 overflow-x-hidden px-4 pb-12 pt-2 animate-in fade-in duration-300 lg:px-6" data-tour="credit-detail-page">
      <CreditDetailHeader
        loanId={loan.id} statusInfo={statusInfo} subtitle={creditDetailSubtitle}
        customerLabel={customerLabel} calculationProfileSummary={calculationProfileSummary}
        registerPaymentLabel={isBackofficeUser ? tTerm('creditDetails.cta.recordPayment') : tTerm('creditDetails.cta.payInstallment')}
        capitalContributionLabel={tTerm('creditDetails.cta.capitalContribution')}
        canAccessBackofficeActions={isBackofficeUser} canExportCreditExcel={isAdmin}
        isExportingCreditExcel={isExportingCreditExcel}
        installmentPaymentGuard={installmentPaymentGuard} capitalPaymentGuard={capitalPaymentGuard}
        payoffPaymentGuard={payoffPaymentGuard} lateFeeUpdateGuard={lateFeeUpdateGuard}
        creditStatusUpdateGuard={creditStatusUpdateGuard}
        onBack={() => navigate('/credits')} onRegisterPayment={openNextInstallmentPayment}
        onOpenCapitalPayment={() => setShowCapitalModal(true)}
        onPayoff={handlePayoff}
        onOpenLateFeeRate={() => { setLateFeeRate(String(loan.annualLateFeeRate || '')); setShowLateFeeModal(true); }}
        onOpenStatus={() => setShowStatusModal(true)}
        onExportCreditExcel={() => runExportCreditExcel(loanId)}
        onOpenSchedule={() => navigate(`/credits/${loanId}/schedule`)}
      />

      <CreditSummaryMetrics loan={loan} paymentSnapshot={paymentSnapshot} formatCurrency={formatCurrency} formatMetricCurrency={formatMetricCurrency} />

      <section className="min-w-0">
        <CreditDetailsTabs
          activeTab={activeTab} isAdmin={isBackofficeUser}
          alertCount={alertEntries.length}
          pendingPromiseCount={promiseEntries.filter((p: any) => p.status === 'pending').length}
          paymentHistoryCount={paymentHistoryEntries.length}
          labels={{ calendar: tTerm('creditDetails.tab.calendar'), alerts: tTerm('creditDetails.tab.alerts'), promises: tTerm('creditDetails.tab.promises'), history: tTerm('creditDetails.tab.history') }}
          onSelect={setActiveTab}
        />

        <div className="py-4 sm:py-5 lg:py-6">
          {activeTab === 'calendar' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" data-tour="credit-detail-calendar">
              <CalendarTab
                installmentRows={installmentRows} installmentColumnTotals={installmentColumnTotals}
                loanAmount={Number(loan.amount)} showInstallmentActionColumn={showInstallmentActionColumn}
                nextPayableInstallmentNumber={nextPayableInstallmentNumber}
                calendarSnapshot={calendarSnapshot} formatCurrency={formatCurrency}
                renderInstallmentActions={renderInstallmentActions}
              />
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="animate-in fade-in duration-300 max-w-5xl">
              <AlertsTab
                alertEntries={alertEntries}
                getAlertPresentation={(alert) => getAlertPresentation(alert, formatCurrency)}
                formatDate={formatDate} isUpdating={updateAlertStatus.isPending}
                onUpdateAlertStatus={handleUpdateAlertStatus}
              />
            </div>
          )}

          {activeTab === 'promises' && (
            <div className="animate-in fade-in duration-300">
              <PromisesTab
                promiseEntries={promiseEntries} formatCurrency={formatCurrency}
                formatDate={formatDate} promiseDate={promiseDate}
                isUpdating={updatePromiseStatus.isPending}
                isDownloading={downloadPromiseDocument.isPending}
                onUpdatePromiseStatus={handleUpdatePromiseStatus}
                onDownloadPromise={handleDownloadPromise}
              />
            </div>
          )}

          {activeTab === 'payouts' && (
            <div className="animate-in fade-in duration-300">
              <PayoutsTab paymentHistoryEntries={paymentHistoryEntries} formatCurrency={formatCurrency} formatDate={formatDate} />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="animate-in fade-in duration-300 max-w-5xl" data-tour="credit-detail-history">
              <HistoryTab
                operationalHistoryEntries={operationalHistoryEntries} isLoadingHistory={isLoadingHistory}
                isBackofficeUser={isBackofficeUser} loanStatus={loan?.status}
                userRole={user?.role} userPermissions={user?.permissions}
                formatDate={formatDate}
                onDownloadVoucher={(pid) => runDownloadVoucher(pid)}
                onOpenEditPaymentMethod={openEditPaymentMethodModal}
              />
            </div>
          )}
        </div>
      </section>

      <CreditDetailsModals
        formatCurrency={formatCurrency} paymentMethodOptions={paymentMethodOptions}
        showStatusModal={showStatusModal} newStatus={newStatus}
        onNewStatusChange={setNewStatus} onUpdateStatus={handleUpdateStatus}
        onCloseStatusModal={() => setShowStatusModal(false)}
        isRecordPaymentModalOpen={isRecordPaymentModalOpen}
        selectedInstallmentNumber={selectedInstallmentNumber}
        paymentAmount={paymentAmount} paymentDate={paymentDate} paymentMethod={paymentMethod}
        installmentQuote={installmentQuote}
        installmentQuoteFetching={installmentQuoteQuery.isFetching}
        installmentQuoteError={installmentQuoteQuery.isError}
        onPaymentAmountChange={setPaymentAmount} onPaymentDateChange={setPaymentDate}
        onPaymentMethodChange={setPaymentMethod}
        onRecordPayment={handleRecordPayment} onClosePaymentModal={operationalModal.closeModal}
        isPromiseModalOpen={isPromiseModalOpen}
        promiseAmount={promiseAmount} promiseDateInput={promiseDateInput} promiseNotes={promiseNotes}
        onPromiseAmountChange={setPromiseAmount} onPromiseDateChange={setPromiseDateInput}
        onPromiseNotesChange={setPromiseNotes}
        onCreatePromise={handleCreatePromise} onClosePromiseModal={operationalModal.closeModal}
        isFollowUpModalOpen={isFollowUpModalOpen}
        followUpNotes={followUpNotes} onFollowUpNotesChange={setFollowUpNotes}
        onCreateFollowUp={handleCreateFollowUp} onCloseFollowUpModal={operationalModal.closeModal}
        showAnnulModal={showAnnulModal} annulInstallmentNumber={annulInstallmentNumber}
        annulReason={annulReason} onAnnulReasonChange={setAnnulReason}
        onAnnulInstallment={handleAnnulInstallment}
        onCloseAnnulModal={() => { setShowAnnulModal(false); setAnnulInstallmentNumber(null); }}
        showCapitalModal={showCapitalModal} capitalAmount={capitalAmount}
        capitalPaymentDate={capitalPaymentDate} capitalMethod={capitalMethod}
        capitalStrategy={capitalStrategy} capitalPreview={capitalPreview}
        capitalPaymentGuard={capitalPaymentGuard} capitalUnavailableDescription={capitalUnavailableDescription}
        onCapitalAmountChange={setCapitalAmount} onCapitalDateChange={setCapitalPaymentDate}
        onCapitalMethodChange={setCapitalMethod} onCapitalStrategyChange={setCapitalStrategy}
        onRecordCapital={handleRecordCapital} onCloseCapitalModal={() => setShowCapitalModal(false)}
        showEditPaymentMethodModal={showEditPaymentMethodModal}
        editingPaymentReconciled={editingPaymentReconciled}
        newPaymentMethod={newPaymentMethod} onNewPaymentMethodChange={setNewPaymentMethod}
        onUpdatePaymentMethod={handleUpdatePaymentMethod}
        onCloseEditPaymentMethodModal={() => { setShowEditPaymentMethodModal(false); setEditingPaymentId(null); setEditingPaymentReconciled(false); }}
        showLateFeeModal={showLateFeeModal} lateFeeRate={lateFeeRate}
        onLateFeeRateChange={setLateFeeRate}
        onUpdateLateFeeRate={handleUpdateLateFeeRate}
        onCloseLateFeeModal={() => setShowLateFeeModal(false)}
      />
    </div>
  );
}
