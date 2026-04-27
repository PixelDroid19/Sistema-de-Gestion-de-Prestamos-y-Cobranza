import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Bell, Clock, CreditCard, CheckCircle, CircleHelp,
  Edit2, FileText, DollarSign, ShieldAlert, Percent, History,
  Layers, AlertTriangle, AlertCircle, Info, ChevronRight, Activity, Table, GitBranch
} from 'lucide-react';
import { useInstallmentQuote, useLoanById, useLoanDetails, useLoans, PAYMENT_METHODS as FALLBACK_PAYMENT_METHODS, CAPITAL_STRATEGIES, type PaymentMethod, type CapitalStrategy } from '../services/loanService';
import { useConfig } from '../services/configService';
import { useCreditReports } from '../services/reportService';
import { useSessionStore } from '../store/sessionStore';
import { downloadVoucher } from '../services/paymentService';
import { toast } from '../lib/toast';
import { useQueryClient } from '@tanstack/react-query';
import { useOperationalActions } from './hooks/useOperationalActions';
import { useOperationalModalState } from './hooks/useOperationalModalState';
import { invalidateAfterPayment, invalidateAfterPromiseOrFollowUp } from '../services/operationalInvalidation';
import { tTerm } from '../i18n/terminology';
import { useSafeMutationAction } from './hooks/useSafeMutationAction';
import { BACKEND_SUPPORTED_LOAN_STATUSES, LOAN_STATUS_LABELS } from '../constants/loanStates';
import { getPaymentTypeLabel } from '../constants/paymentTypes';
import { confirmDanger } from '../lib/confirmModal';
import { resolveOperationalGuard } from '../services/operationalGuards';
import { startCreditDetailsTour } from '../lib/creditGuidedTours';

export default function CreditDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loanId = Number(id);
  const [activeTab, setActiveTab] = useState<'calendar' | 'alerts' | 'promises' | 'payouts' | 'payoff' | 'history'>('calendar');
  const { user } = useSessionStore();
  const isAdmin = user?.role === 'admin';
  const canViewPayoff = user?.role === 'customer' || isAdmin;
  const { paymentMethods: configuredPaymentMethods } = useConfig();
  const paymentMethodOptions = useMemo(() => {
    const activeConfiguredMethods = configuredPaymentMethods
      .filter((method: any) => method?.isActive !== false)
      .map((method: any) => ({
        value: String(method?.key ?? method?.type ?? '').trim().toLowerCase(),
        label: String(method?.label ?? method?.name ?? method?.key ?? method?.type ?? '').trim(),
      }))
      .filter((method) => method.value && method.label);

    return activeConfiguredMethods.length > 0
      ? activeConfiguredMethods
      : [...FALLBACK_PAYMENT_METHODS];
  }, [configuredPaymentMethods]);
  const defaultPaymentMethod = paymentMethodOptions[0]?.value || 'transfer';
  const { executeGuardedAction } = useOperationalActions(queryClient);
  const operationalModal = useOperationalModalState();

  const { data: loansData, isLoading: isLoadingLoans, updateLoanStatus } = useLoans(undefined, {
    enabled: !Number.isFinite(loanId) || !loanId || isAdmin,
  });
  const { data: loanData, isLoading: isLoadingLoanRecord } = useLoanById(loanId);
  const loans = Array.isArray(loansData?.data?.loans)
    ? loansData.data.loans
    : Array.isArray(loansData?.data)
      ? loansData.data
      : [];
  const loan = loanData?.data?.loan ?? loans.find((l: any) => Number(l?.id) === loanId);
  const payoffEligibility = loan?.paymentContext?.payoffEligibility;
  const shouldFetchPayoffQuote = canViewPayoff && Boolean(payoffEligibility?.allowed);
  const primaryPayoffDenialReason = Array.isArray(payoffEligibility?.denialReasons)
    ? payoffEligibility.denialReasons[0]
    : null;

  const {
    calendar,
    calendarSnapshot,
    alerts,
    promises,
    payoffQuote,
    isLoading: isLoadingDetails,
    createPromise,
    createFollowUp,
    executePayoff,
    recordPayment,
    annulInstallment,
    updatePaymentMethod,
    updateAlertStatus,
    updatePromiseStatus,
    downloadPromiseDocument,
    recordCapitalPayment,
    updateLateFeeRate,
  } = useLoanDetails(loanId, {
    includeAlerts: isAdmin,
    includePromises: isAdmin,
    includePayoffQuote: shouldFetchPayoffQuote,
  });
  const { history, isLoading: isLoadingHistory } = useCreditReports(loanId);

  const formatDate = (value: unknown, withTime = false) => {
    if (!value) return 'Sin fecha';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return 'Sin fecha';
    return withTime
      ? date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
      : date.toLocaleDateString('es-ES', { dateStyle: 'medium', timeZone: 'UTC' });
  };

  const formatCurrency = (value: unknown) => {
    const numericValue = Number(value ?? 0);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 2,
    }).format(Number.isFinite(numericValue) ? numericValue : 0);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Activo', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30' };
      case 'approved':
        return { label: 'Aprobado', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30' };
      case 'overdue':
        return { label: 'Vencido', className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 border border-orange-200 dark:border-orange-500/30' };
      case 'paid':
        return { label: 'Pagado', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30' };
      case 'completed':
      case 'closed':
        return { label: 'Completado', className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-200 dark:border-slate-500/30' };
      case 'defaulted':
        return { label: 'En mora', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-200 dark:border-red-500/30' };
      case 'cancelled':
        return { label: 'Cancelado', className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-200 dark:border-slate-500/30' };
      case 'pending':
        return { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30' };
      case 'rejected':
        return { label: 'Rechazado', className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30' };
      default:
        return { label: status || 'Sin estado', className: 'bg-gray-100 text-gray-700 border border-gray-200' };
    }
  };

  const statusInfo = getStatusInfo(loan?.status);
  const promiseDate = (promise: any) => promise?.promisedDate || promise?.promiseDate || promise?.createdAt;
  const formatPromiseStatus = (status: unknown) => {
    switch (String(status || '').toLowerCase()) {
      case 'kept':
        return 'Cumplida';
      case 'broken':
        return 'Incumplida';
      case 'cancelled':
        return 'Cancelada';
      case 'pending':
        return 'Pendiente';
      default:
        return String(status || 'Sin estado');
    }
  };
  const installmentPaymentGuard = resolveOperationalGuard('installment.pay', {
    role: user?.role,
    permissions: user?.permissions,
    loanStatus: loan?.status,
  });
  const capitalPaymentGuard = resolveOperationalGuard('capital.payment', {
    role: user?.role,
    permissions: user?.permissions,
    loanStatus: loan?.status,
  });
  const lateFeeUpdateGuard = resolveOperationalGuard('lateFee.update', {
    role: user?.role,
    permissions: user?.permissions,
    loanStatus: loan?.status,
  });
  const creditStatusUpdateGuard = resolveOperationalGuard('credit.status.update', {
    role: user?.role,
    permissions: user?.permissions,
    loanStatus: loan?.status,
  });

  const paymentHistoryEntries = useMemo(() => {
    const source = history?.data?.history ?? history;
    const payments = Array.isArray(source?.payments) ? source.payments : [];
    const payoffHistory = Array.isArray(source?.payoffHistory) ? source.payoffHistory : [];

    return [
      ...payments.map((payment: any) => ({
        id: payment.id ?? payment.createdAt ?? Math.random(),
        paymentId: Number(payment.id),
        amount: payment.amount,
        paymentType: payment.paymentType,
        installmentNumber: payment.installmentNumber,
        principalApplied: payment.principalApplied,
        interestApplied: payment.interestApplied,
        penaltyApplied: payment.penaltyApplied,
        paymentMethod: payment.paymentMethod,
        paymentStatus: payment.status,
        paymentReconciled: Boolean(payment.reconciled || payment.isReconciled || String(payment.status || '').toLowerCase().includes('reconcil')),
        action: `Pago ${getPaymentTypeLabel(payment.paymentType)}`,
        description: `Monto: ${formatCurrency(payment.amount)}`,
        date: payment.paymentDate || payment.createdAt,
        type: 'payment',
      })),
      ...payoffHistory.map((event: any) => ({
        id: `payoff-${event.id ?? event.createdAt ?? Math.random()}`,
        action: 'Pago total aplicado',
        description: `Monto: ${formatCurrency(event.amount ?? event.quotedTotal)}`,
        date: event.paymentDate || event.createdAt,
        type: 'payoff',
      })),
    ].filter((entry) => entry.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [history]);

  let customerLabel = loan?.Customer?.name || loan?.customerName || '';
  if (customerLabel) {
    customerLabel = customerLabel.replace(/(qa|seed|test|dev|customer|socio|partner|admin|live|user|demo|example|sample)\s*/ig, '').trim();
  }
  customerLabel = customerLabel || (loan?.customerId ? `Cliente #${loan.customerId}` : 'Sin cliente');
  const calendarEntries = Array.isArray(calendar) ? calendar : [];
  const reportHistorySource = history?.data?.history ?? history;
  const reportAlertEntries = Array.isArray(reportHistorySource?.alerts) ? reportHistorySource.alerts : [];
  const reportPromiseEntries = Array.isArray(reportHistorySource?.promises) ? reportHistorySource.promises : [];
  const alertEntries = Array.isArray(alerts) && alerts.length > 0 ? alerts : reportAlertEntries;
  const promiseEntries = Array.isArray(promises) && promises.length > 0 ? promises : reportPromiseEntries;
  const activePayoffQuote = payoffEligibility?.allowed ? payoffQuote : null;
  const payoffUnavailableDescription = primaryPayoffDenialReason?.message
    || (
      (loan?.paymentContext?.snapshot?.outstandingBalance ?? 0) <= 0.01
      || ['closed', 'completed', 'paid', 'cancelled'].includes(String(loan?.status || '').toLowerCase())
    )
      ? 'Este crédito ya no tiene saldo pendiente para liquidar.'
      : 'Verifica el estado del crédito y la elegibilidad de la cartera antes de continuar con esta operación.';
  const operationalHistoryEntries = useMemo(() => {
    const alertEvents = alertEntries.flatMap((alert: any) => {
      const events = [{
        id: `alert-created-${alert.id}`,
        action: alert.status === 'resolved' ? 'Alerta resuelta' : 'Alerta activa',
        description: `${alert.alertType || 'Seguimiento'} ${alert.installmentNumber ? `cuota #${alert.installmentNumber}` : ''} · ${formatCurrency(alert.outstandingAmount)}`,
        date: alert.resolvedAt || alert.createdAt || alert.dueDate,
        type: 'alert',
        status: alert.status,
      }];

      if (alert.notes) {
        events.push({
          id: `alert-note-${alert.id}`,
          action: 'Seguimiento registrado',
          description: String(alert.notes),
          date: alert.updatedAt || alert.createdAt || alert.dueDate,
          type: 'alert',
          status: alert.status,
        });
      }

      return events;
    });

    const promiseEvents = promiseEntries.flatMap((promise: any) => {
      const baseEvents = [{
        id: `promise-created-${promise.id}`,
        action: 'Compromiso de pago creado',
        description: `${formatCurrency(promise.amount)} para el ${formatDate(promiseDate(promise))}`,
        date: promise.createdAt || promise.promisedDate,
        type: 'promise',
        status: promise.status,
      }];

      const statusEvents = Array.isArray(promise.statusHistory)
        ? promise.statusHistory.map((entry: any, index: number) => ({
          id: `promise-status-${promise.id}-${index}`,
          action: 'Estado de compromiso actualizado',
          description: `${formatPromiseStatus(entry.status)}${entry.note ? ` · ${entry.note}` : ''}`,
          date: entry.changedAt || promise.updatedAt || promise.promisedDate,
          type: 'promise',
          status: entry.status,
        }))
        : [];

      return [...baseEvents, ...statusEvents];
    });

    return [...paymentHistoryEntries, ...alertEvents, ...promiseEvents]
      .filter((entry) => entry.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [alertEntries, paymentHistoryEntries, promiseEntries]);
  const visibleTabs = useMemo(() => {
    const tabs: Array<typeof activeTab> = ['calendar'];

    if (isAdmin) {
      tabs.push('alerts', 'promises');
    }

    tabs.push('payouts');

    if (canViewPayoff) {
      tabs.push('payoff');
    }

    tabs.push('history');

    return tabs;
  }, [canViewPayoff, isAdmin]);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  // Modals state
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

  const [showLateFeeModal, setShowLateFeeModal] = useState(false);
  const [lateFeeRate, setLateFeeRate] = useState('');

  const { run: runPayoff } = useSafeMutationAction<{ asOfDate: string; quotedTotal: number }>({
    action: async (payload) => executePayoff.mutateAsync(payload),
    errorContext: { domain: 'credits', action: 'generic' },
    successMessage: 'Crédito liquidado exitosamente',
  });

  const { run: runDownloadVoucher } = useSafeMutationAction<number>({
    action: async (paymentId) => downloadVoucher(paymentId),
    errorContext: { domain: 'payments', action: 'generic' },
    successMessage: 'Comprobante descargado',
  });

  const payableStatuses = new Set(['pending', 'overdue', 'partial']);

  React.useEffect(() => {
    const validMethods = new Set(paymentMethodOptions.map((method) => method.value));
    if (!validMethods.has(paymentMethod)) setPaymentMethod(defaultPaymentMethod);
    if (!validMethods.has(newPaymentMethod)) setNewPaymentMethod(defaultPaymentMethod);
    if (!validMethods.has(capitalMethod)) setCapitalMethod(defaultPaymentMethod);
  }, [capitalMethod, defaultPaymentMethod, newPaymentMethod, paymentMethod, paymentMethodOptions]);

  React.useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] ?? 'calendar');
    }
  }, [activeTab, visibleTabs]);
  const nextPayableInstallmentNumber = useMemo(() => {
    const candidate = calendarEntries
      .filter((entry: any) => payableStatuses.has(String(entry?.status || '').toLowerCase()))
      .map((entry: any) => Number(entry?.installmentNumber))
      .filter((value: number) => Number.isFinite(value))
      .sort((a, b) => a - b)[0];

    return Number.isFinite(candidate) ? candidate : null;
  }, [calendarEntries]);

  const extractPaymentId = (eventId: unknown): number | null => {
    if (typeof eventId === 'number' && Number.isFinite(eventId)) {
      return eventId;
    }
    if (typeof eventId === 'string' && eventId.startsWith('payment-')) {
      const id = eventId.replace('payment-', '');
      return Number(id);
    }
    return null;
  };

  const isRecordPaymentModalOpen = operationalModal.is('record-payment');
  const isPromiseModalOpen = operationalModal.is('create-promise');
  const isFollowUpModalOpen = operationalModal.is('create-follow-up');
  const installmentQuoteQuery = useInstallmentQuote(loanId, selectedInstallmentNumber, paymentDate, {
    enabled: isRecordPaymentModalOpen && Boolean(selectedInstallmentNumber),
  });
  const installmentQuote = installmentQuoteQuery.data?.data?.quote;
  const installmentRows = useMemo(() => {
    const initialAmount = Number(loan?.amount ?? 0);

    return calendarEntries.reduce((rows: any[], installment: any, index: number) => {
      const scheduledPayment = installment.scheduledPayment ?? 0;
      const interestComponent = installment.interestComponent ?? installment.remainingInterest ?? 0;
      const principalComponent = installment.principalComponent ?? Math.max(0, scheduledPayment - interestComponent);
      const openingBalance = index === 0 ? initialAmount : rows[index - 1].closingBalance;
      const closingBalance = Number.isFinite(Number(installment.remainingBalance))
        ? Number(installment.remainingBalance)
        : Math.max(0, openingBalance - principalComponent);

      const normalizedInstallmentNumber = Number(installment.installmentNumber);

      rows.push({
        installmentNumber: Number.isFinite(normalizedInstallmentNumber)
          ? normalizedInstallmentNumber
          : installment.installmentNumber,
        scheduledPayment,
        interestComponent,
        principalComponent,
        openingBalance,
        closingBalance,
        outstandingAmount: installment.outstandingAmount,
        payableAmount: installment.payableAmount,
        lateFeeDue: installment.lateFeeDue,
        daysOverdue: installment.daysOverdue,
        canPay: installment.canPay,
        disabledReason: installment.disabledReason,
        status: installment.status,
      });

      return rows;
    }, []);
  }, [calendarEntries, loan?.amount]);

  if (!Number.isFinite(loanId) || loanId <= 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-text-primary mb-2">ID de crédito inválido</h2>
        <button onClick={() => navigate('/credits')} className="text-brand-primary hover:underline font-medium transition-all">
          ← Volver a créditos
        </button>
      </div>
    );
  }

  if (isLoadingLoans || isLoadingLoanRecord || isLoadingDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-text-secondary font-medium">Cargando detalles del crédito...</p>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <FileText className="w-12 h-12 text-text-secondary opacity-50 mb-4" />
        <h2 className="text-xl font-semibold text-text-primary mb-2">Crédito no encontrado</h2>
        <button onClick={() => navigate('/credits')} className="text-brand-primary hover:underline font-medium transition-all">
          ← Volver a créditos
        </button>
      </div>
    );
  }

  // Action Handlers
  const handlePayoff = async () => {
    if (!payoffQuote) return;
    const quotedTotal = payoffQuote.total ?? payoffQuote.totalPayoffAmount;
    const confirmed = await confirmDanger({
      title: tTerm('confirm.payoff.title'),
      message: tTerm('confirm.payoff.message').replace('{amount}', formatCurrency(quotedTotal)),
      confirmLabel: tTerm('confirm.payoff.confirm'),
    });
    if (!confirmed) return;
    await runPayoff({
      asOfDate: payoffQuote.asOfDate,
      quotedTotal,
    });
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    await executeGuardedAction({
      action: 'credit.status.update',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status },
      run: async () => {
        await updateLoanStatus.mutateAsync({ id: loanId, status: newStatus });
      },
      onSuccess: async () => {
        await invalidateAfterPromiseOrFollowUp(queryClient, { loanId });
        setShowStatusModal(false);
      },
      successMessage: 'Estado actualizado correctamente',
    });
  };

  const handleDownloadVoucher = async (paymentId: number) => {
    await runDownloadVoucher(paymentId);
  };

  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error({ title: 'Ingrese un monto válido' });
      return;
    }
    const installment = operationalModal.payload?.installment;
    const installmentNumber = installment?.installmentNumber ?? selectedInstallmentNumber;

    if (!installmentNumber) {
      toast.error({ title: 'No se pudo resolver la cuota seleccionada. Reintente desde la fila correspondiente.' });
      return;
    }

    await executeGuardedAction({
      action: 'installment.pay',
      context: {
        role: user?.role,
        permissions: user?.permissions,
        loanStatus: loan?.status,
        installmentStatus: installment?.status,
      },
      confirmationMessage: `¿Confirmar pago de cuota #${installmentNumber} por ${formatCurrency(amount)}?`,
      run: async () => {
        await recordPayment.mutateAsync({
          paymentAmount: amount,
          paymentDate,
          paymentMethod,
          installmentNumber,
        });
      },
      onSuccess: async () => {
        await invalidateAfterPayment(queryClient, { loanId });
        operationalModal.closeModal();
        setPaymentAmount('');
        setSelectedInstallmentNumber(null);
      },
      successMessage: 'Pago registrado exitosamente',
    });
  };

  const handleAnnulInstallment = async () => {
    if (!annulInstallmentNumber) {
      toast.error({ title: 'Seleccione una cuota para anular' });
      return;
    }
    await executeGuardedAction({
      action: 'installment.annul',
      context: {
        role: user?.role,
        permissions: user?.permissions,
        loanStatus: loan?.status,
        installmentStatus: operationalModal.payload?.installment?.status,
      },
      run: async () => {
        await annulInstallment.mutateAsync({ installmentNumber: annulInstallmentNumber, reason: annulReason || undefined });
      },
      onSuccess: async () => {
        await invalidateAfterPayment(queryClient, { loanId });
        setShowAnnulModal(false);
        setAnnulInstallmentNumber(null);
        setAnnulReason('');
      },
      successMessage: 'Cuota anulada exitosamente',
    });
  };

  const handleUpdatePaymentMethod = async () => {
    if (!editingPaymentId) return;
    await executeGuardedAction({
      action: 'installment.editPaymentMethod',
      context: {
        role: user?.role,
        permissions: user?.permissions,
        loanStatus: loan?.status,
        installmentStatus: operationalModal.payload?.installment?.status,
        paymentReconciled: editingPaymentReconciled,
      },
      confirmationMessage: '¿Confirmar actualización del método de pago?',
      run: async () => {
        await updatePaymentMethod.mutateAsync({ paymentId: editingPaymentId, paymentMethod: newPaymentMethod });
      },
      onSuccess: async () => {
        await invalidateAfterPayment(queryClient, { loanId });
        setShowEditPaymentMethodModal(false);
        operationalModal.closeModal();
        setEditingPaymentId(null);
        setEditingPaymentReconciled(false);
      },
      successMessage: 'Método de pago actualizado',
    });
  };

  const handleCreatePromise = async () => {
    const amount = parseFloat(promiseAmount);
    const installment = operationalModal.payload?.installment;
    const installmentNumber = installment?.installmentNumber;

    if (!installmentNumber) {
      toast.error({ title: 'No se pudo resolver la cuota para la promesa.' });
      return;
    }

    if (!amount || amount <= 0) {
      toast.error({ title: 'Ingrese un monto válido para la promesa.' });
      return;
    }

    await executeGuardedAction({
      action: 'installment.promise',
      context: {
        role: user?.role,
        permissions: user?.permissions,
        loanStatus: loan?.status,
        installmentStatus: installment?.status,
      },
      run: async () => {
        await createPromise.mutateAsync({
          amount,
          promisedDate: promiseDateInput,
          notes: promiseNotes || undefined,
          installmentNumber,
        });
      },
      onSuccess: async () => {
        await invalidateAfterPromiseOrFollowUp(queryClient, { loanId });
        operationalModal.closeModal();
        setPromiseAmount('');
        setPromiseNotes('');
      },
      successMessage: 'Promesa registrada correctamente',
    });
  };

  const handleCreateFollowUp = async () => {
    const installment = operationalModal.payload?.installment;
    const installmentNumber = installment?.installmentNumber;

    if (!installmentNumber) {
      toast.error({ title: 'No se pudo resolver la cuota para seguimiento.' });
      return;
    }

    if (!followUpNotes.trim()) {
      toast.error({ title: 'Ingrese una nota de seguimiento.' });
      return;
    }

    await executeGuardedAction({
      action: 'installment.followUp',
      context: {
        role: user?.role,
        permissions: user?.permissions,
        loanStatus: loan?.status,
        installmentStatus: installment?.status,
      },
      run: async () => {
        await createFollowUp.mutateAsync({
          notes: followUpNotes,
          installmentNumber,
        });
      },
      onSuccess: async () => {
        await invalidateAfterPromiseOrFollowUp(queryClient, { loanId });
        operationalModal.closeModal();
        setFollowUpNotes('');
      },
      successMessage: 'Seguimiento registrado correctamente',
    });
  };

  const handleUpdateAlertStatus = async (alert: any, status: 'active' | 'resolved') => {
    const alertId = Number(alert?.id);
    if (!Number.isFinite(alertId)) {
      toast.error({ title: 'No se pudo identificar la alerta.' });
      return;
    }

    const label = status === 'resolved' ? 'resolver' : 'reactivar';
    const confirmed = await confirmDanger({
      title: status === 'resolved' ? 'Resolver alerta' : 'Reactivar alerta',
      message: `¿Confirmar ${label} esta alerta del crédito?`,
      confirmLabel: status === 'resolved' ? 'Resolver' : 'Reactivar',
    });

    if (!confirmed) return;

    await updateAlertStatus.mutateAsync({
      alertId,
      status,
      notes: status === 'resolved' ? 'Resuelta manualmente desde detalle de crédito.' : 'Reactivada manualmente desde detalle de crédito.',
    });
    await invalidateAfterPromiseOrFollowUp(queryClient, { loanId });
    toast.success({ title: status === 'resolved' ? 'Alerta resuelta' : 'Alerta reactivada' });
  };

  const handleUpdatePromiseStatus = async (promise: any, status: 'pending' | 'kept' | 'broken' | 'cancelled') => {
    const promiseId = Number(promise?.id);
    if (!Number.isFinite(promiseId)) {
      toast.error({ title: 'No se pudo identificar el compromiso.' });
      return;
    }

    const confirmed = await confirmDanger({
      title: 'Actualizar compromiso',
      message: `¿Cambiar el compromiso a "${formatPromiseStatus(status)}"?`,
      confirmLabel: 'Actualizar',
    });

    if (!confirmed) return;

    await updatePromiseStatus.mutateAsync({
      promiseId,
      status,
      notes: `Actualizado a ${formatPromiseStatus(status)} desde detalle de crédito.`,
    });
    await invalidateAfterPromiseOrFollowUp(queryClient, { loanId });
    toast.success({ title: 'Compromiso actualizado' });
  };

  const handleDownloadPromise = async (promise: any) => {
    const promiseId = Number(promise?.id);
    if (!Number.isFinite(promiseId)) {
      toast.error({ title: 'No se pudo identificar el compromiso.' });
      return;
    }

    await downloadPromiseDocument.mutateAsync(promiseId);
    toast.success({ title: 'Documento de compromiso descargado' });
  };

  const handleRecordCapital = async () => {
    const amount = parseFloat(capitalAmount);
    if (!amount || amount <= 0) {
      toast.error({ title: 'Ingrese un monto válido' });
      return;
    }
    await executeGuardedAction({
      action: 'capital.payment',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status },
      run: async () => {
        await recordCapitalPayment.mutateAsync({ amount, paymentMethod: capitalMethod, strategy: capitalStrategy });
      },
      onSuccess: async () => {
        await invalidateAfterPayment(queryClient, { loanId });
        setShowCapitalModal(false);
        setCapitalAmount('');
      },
      successMessage: 'Aporte de capital registrado',
    });
  };

  const handleUpdateLateFeeRate = async () => {
    const rate = parseFloat(lateFeeRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error({ title: 'La tasa debe estar entre 0 y 100' });
      return;
    }
    await executeGuardedAction({
      action: 'lateFee.update',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status },
      run: async () => {
        await updateLateFeeRate.mutateAsync(rate);
      },
      onSuccess: async () => {
        await invalidateAfterPromiseOrFollowUp(queryClient, { loanId });
        setShowLateFeeModal(false);
        setLateFeeRate('');
      },
      successMessage: 'Tasa de mora actualizada',
    });
  };

  const openAnnulModal = (installmentNumber: number) => {
    setAnnulInstallmentNumber(installmentNumber);
    setShowAnnulModal(true);
  };

  const openEditPaymentMethodModal = (entry: any) => {
    const paymentId = Number(entry?.paymentId);
    if (!Number.isFinite(paymentId)) {
      toast.error({ title: 'No se pudo identificar el pago.' });
      return;
    }

    const normalizedMethod = String(entry?.paymentMethod || defaultPaymentMethod).toLowerCase();
    const hasMethod = paymentMethodOptions.some((method) => method.value === normalizedMethod);

    setEditingPaymentId(paymentId);
    setEditingPaymentReconciled(Boolean(entry?.paymentReconciled));
    setNewPaymentMethod((hasMethod ? normalizedMethod : defaultPaymentMethod) as PaymentMethod);
    setShowEditPaymentMethodModal(true);
  };

  const openInstallmentPayment = (row: any) => {
    const installmentNumber = Number(row?.installmentNumber);

    if (!Number.isFinite(installmentNumber) || installmentNumber <= 0) {
      toast.error({ title: 'No se pudo identificar la cuota.' });
      return;
    }

    setSelectedInstallmentNumber(installmentNumber);
    setPaymentAmount(String(row.payableAmount ?? row.outstandingAmount ?? row.scheduledPayment ?? ''));
    operationalModal.openModal('record-payment', {
      loanId,
      installment: {
        installmentId: installmentNumber,
        installmentNumber,
        amount: row.payableAmount ?? row.scheduledPayment,
        status: row.status,
      },
    });
  };

  const openNextInstallmentPayment = () => {
    const nextInstallment = calendarEntries.find(
      (entry: any) => Number(entry?.installmentNumber) === nextPayableInstallmentNumber,
    );

    if (!nextInstallment) {
      toast.error({ title: 'No hay cuotas pendientes para registrar pago.' });
      return;
    }

    openInstallmentPayment(nextInstallment);
  };

  const openPromiseFromInstallment = (row: any) => {
    const installmentNumber = Number(row?.installmentNumber);

    if (!Number.isFinite(installmentNumber) || installmentNumber <= 0) {
      toast.error({ title: 'No se pudo identificar la cuota para promesa.' });
      return;
    }

    operationalModal.openModal('create-promise', {
      loanId,
      installment: {
        installmentId: installmentNumber,
        installmentNumber,
        amount: row.scheduledPayment,
        status: row.status,
      },
    });
    setPromiseAmount(String(row.scheduledPayment ?? ''));
  };

  const openFollowUpFromInstallment = (row: any) => {
    const installmentNumber = Number(row?.installmentNumber);

    if (!Number.isFinite(installmentNumber) || installmentNumber <= 0) {
      toast.error({ title: 'No se pudo identificar la cuota para seguimiento.' });
      return;
    }

    operationalModal.openModal('create-follow-up', {
      loanId,
      installment: {
        installmentId: installmentNumber,
        installmentNumber,
        amount: row.scheduledPayment,
        status: row.status,
      },
    });
  };

  const formulaSummary = loan?.dagGraph?.name
    ? `${loan.dagGraph.name} (v${loan.dagGraph.version})`
    : 'Versión congelada del sistema';

  const getInstallmentStatusInfo = (status: unknown) => {
    switch (String(status || '').toLowerCase()) {
      case 'paid':
        return {
          label: 'Pagada',
          className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
        };
      case 'overdue':
        return {
          label: 'Vencida',
          className: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
        };
      case 'partial':
        return {
          label: 'Parcial',
          className: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30',
        };
      case 'annulled':
        return {
          label: 'Anulada',
          className: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30',
        };
      default:
        return {
          label: 'Pendiente',
          className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
        };
    }
  };

  const renderInstallmentActions = (row: any, options?: { alignClassName?: string; titlePrefix?: string }) => {
    if (!isAdmin || !['pending', 'overdue', 'partial'].includes(String(row?.status || '').toLowerCase())) {
      return null;
    }

    const alignClassName = options?.alignClassName ?? 'justify-center';
    const titlePrefix = options?.titlePrefix ?? '';
    const isNextPendingInstallment = row.installmentNumber === nextPayableInstallmentNumber;
    const paymentGuard = resolveOperationalGuard('installment.pay', {
      role: user?.role,
      permissions: user?.permissions,
      loanStatus: loan?.status,
      installmentStatus: row.status,
    });
    const annulGuard = resolveOperationalGuard('installment.annul', {
      role: user?.role,
      permissions: user?.permissions,
      loanStatus: loan?.status,
      installmentStatus: row.status,
    });
    const installmentReason = isNextPendingInstallment
      ? ''
      : (nextPayableInstallmentNumber
        ? `Solo puede operar la próxima cuota pendiente (#${nextPayableInstallmentNumber}).`
        : 'No hay cuotas pendientes para operar.');
    const paymentActionReason = paymentGuard.executable ? installmentReason : (paymentGuard.reason || installmentReason);
    const annulActionReason = annulGuard.executable ? installmentReason : (annulGuard.reason || installmentReason);

    return (
      <div className={`flex flex-wrap items-center gap-2 ${alignClassName}`}>
        <button
          onClick={() => openInstallmentPayment(row)}
          disabled={!isNextPendingInstallment || !paymentGuard.executable}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          title={isNextPendingInstallment && paymentGuard.executable ? `${titlePrefix}Registrar pago de cuota` : paymentActionReason}
          aria-label={isNextPendingInstallment && paymentGuard.executable ? `${titlePrefix}Registrar pago de cuota` : paymentActionReason}
        >
          <DollarSign size={16} />
        </button>
        <button
          onClick={() => openPromiseFromInstallment(row)}
          disabled={!isNextPendingInstallment}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-amber-50 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          title={isNextPendingInstallment ? `${titlePrefix}Crear compromiso de pago` : installmentReason}
          aria-label={isNextPendingInstallment ? `${titlePrefix}Crear compromiso de pago` : installmentReason}
        >
          <Clock size={16} />
        </button>
        <button
          onClick={() => openFollowUpFromInstallment(row)}
          disabled={!isNextPendingInstallment}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          title={isNextPendingInstallment ? `${titlePrefix}Crear seguimiento` : installmentReason}
          aria-label={isNextPendingInstallment ? `${titlePrefix}Crear seguimiento` : installmentReason}
        >
          <Bell size={16} />
        </button>
        <button
          onClick={() => openAnnulModal(row.installmentNumber)}
          disabled={!isNextPendingInstallment || !annulGuard.executable}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          title={isNextPendingInstallment && annulGuard.executable ? `${titlePrefix}Anular cuota` : annulActionReason}
          aria-label={isNextPendingInstallment && annulGuard.executable ? `${titlePrefix}Anular cuota` : annulActionReason}
        >
          <ShieldAlert size={16} />
        </button>
      </div>
    );
  };

  const InlineMetaLine = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
  }) => (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <Icon size={15} className="shrink-0 text-brand-primary" />
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{label}</span>
      <span className="min-w-0 break-words font-semibold leading-5 text-text-primary">{value}</span>
    </div>
  );

  const SummaryMetricItem = ({
    icon: Icon,
    label,
    value,
    tone = 'default',
  }: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
  }) => {
    const toneClassName = {
      default: 'text-text-primary',
      success: 'text-emerald-700 dark:text-emerald-300',
      warning: 'text-amber-700 dark:text-amber-300',
      danger: 'text-rose-700 dark:text-rose-300',
      brand: 'text-brand-primary',
    }[tone];

    const railClassName = {
      default: 'bg-slate-300 dark:bg-slate-600',
      success: 'bg-emerald-500',
      warning: 'bg-amber-500',
      danger: 'bg-rose-500',
      brand: 'bg-brand-primary',
    }[tone];

    return (
      <div className="relative min-w-0 rounded-xl border border-border-subtle bg-white px-4 py-4 shadow-sm dark:bg-bg-surface sm:px-5">
        <span className={`absolute inset-y-4 left-0 w-1 rounded-r-full ${railClassName}`} aria-hidden="true" />
        <div className="flex items-center gap-2 text-text-secondary">
          <Icon size={16} />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{label}</p>
        </div>
        <div className={`mt-1.5 break-words text-xl font-bold leading-tight tracking-tight sm:text-2xl ${toneClassName}`}>{value}</div>
      </div>
    );
  };

  const TabEmptyState = ({
    icon: Icon,
    title,
    description,
  }: {
    icon: React.ElementType;
    title: string;
    description: string;
  }) => (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-bg-base/70 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hover-bg text-text-secondary">
        <Icon size={24} />
      </div>
      <p className="mt-4 text-base font-semibold text-text-primary">{title}</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">{description}</p>
    </div>
  );

  const TabButton = ({ id, icon: Icon, label, badge }: { id: typeof activeTab, icon: any, label: string, badge?: number }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`relative flex items-center gap-2 rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-200 whitespace-nowrap outline-none ${
        activeTab === id 
          ? 'bg-brand-primary/8 text-brand-primary' 
          : 'text-text-secondary hover:bg-hover-bg hover:text-text-primary'
      }`}
    >
      <Icon size={18} className={activeTab === id ? 'text-brand-primary' : 'text-text-secondary opacity-70'} />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`ml-1.5 py-0.5 px-2 rounded-full text-[10px] font-bold ${
          activeTab === id ? 'bg-brand-primary text-white' : 'bg-border-strong text-text-primary'
        }`}>
          {badge}
        </span>
      )}
      {activeTab === id && (
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-primary rounded-t-full shadow-[0_-2px_10px_rgba(var(--color-brand-primary),0.5)]" />
      )}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-[88rem] min-w-0 space-y-5 overflow-x-hidden px-4 pb-12 pt-2 animate-in fade-in duration-300 lg:px-6" data-tour="credit-detail-page">
      <section className="border-b border-border-subtle pb-4" data-tour="credit-detail-header">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <button
                onClick={() => navigate('/credits')}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-hover-bg hover:text-text-primary"
                aria-label="Volver a créditos"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="min-w-0 text-3xl font-bold leading-tight tracking-tight text-text-primary md:text-[2.1rem]">Crédito #{loan.id}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${statusInfo.className}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="mt-1.5 max-w-3xl text-sm leading-5 text-text-secondary">
              Opera pagos, mora y seguimientos usando la fórmula congelada al crear este crédito.
            </p>

            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
              <InlineMetaLine icon={FileText} label="Cliente" value={customerLabel} />
              <InlineMetaLine icon={GitBranch} label="Fórmula" value={formulaSummary} />
            </div>
          </div>

          <div className="w-full xl:max-w-[34rem] xl:pt-1" data-tour="credit-detail-primary-actions">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <button
                type="button"
                onClick={() => startCreditDetailsTour({ loanId })}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-bg-base px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-hover-bg sm:w-auto sm:min-w-[12rem]"
              >
                <CircleHelp size={16} /> Guía rápida
              </button>
              {isAdmin && installmentPaymentGuard.visible && (
                <button
                  onClick={openNextInstallmentPayment}
                  disabled={!installmentPaymentGuard.executable}
                  title={installmentPaymentGuard.executable ? undefined : installmentPaymentGuard.reason}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-primary disabled:hover:shadow-none sm:w-auto sm:min-w-[12rem]"
                >
                  <DollarSign size={16} /> {tTerm('creditDetails.cta.recordPayment')}
                </button>
              )}
              {isAdmin && capitalPaymentGuard.visible && (
                <button
                  onClick={() => setShowCapitalModal(true)}
                  disabled={!capitalPaymentGuard.executable}
                  title={capitalPaymentGuard.executable ? undefined : capitalPaymentGuard.reason}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-bg-base px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-bg-base sm:w-auto sm:min-w-[12rem]"
                >
                  <Layers size={16} /> {tTerm('creditDetails.cta.capitalContribution')}
                </button>
              )}
              {isAdmin && lateFeeUpdateGuard.visible && (
                <button
                  onClick={() => {
                    setLateFeeRate(String(loan.annualLateFeeRate || ''));
                    setShowLateFeeModal(true);
                  }}
                  disabled={!lateFeeUpdateGuard.executable}
                  title={lateFeeUpdateGuard.executable ? undefined : lateFeeUpdateGuard.reason}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-bg-base px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-bg-base sm:w-auto"
                >
                  <Percent size={16} /> {tTerm('creditDetails.cta.lateFeeRate')}
                </button>
              )}
              {isAdmin && creditStatusUpdateGuard.visible && (
                <button
                  onClick={() => setShowStatusModal(true)}
                  disabled={!creditStatusUpdateGuard.executable}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-bg-base px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-bg-base sm:w-auto"
                  title={creditStatusUpdateGuard.executable ? 'Cambiar estado del crédito' : creditStatusUpdateGuard.reason}
                >
                  <Edit2 size={16} /> Estado
                </button>
              )}
              <button
                onClick={() => navigate(`/credits/${loanId}/schedule`)}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-bg-base px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-hover-bg sm:w-auto"
                title="Ver plan de pagos completo"
              >
                <Table size={16} /> Plan de Pagos
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7" data-tour="credit-detail-metrics">
          <SummaryMetricItem icon={Calendar} label="Cuotas Totales" value={loan.termMonths ?? '—'} />
          <SummaryMetricItem icon={Clock} label="Cuotas a Pagar" value={loan.paymentContext?.snapshot?.outstandingInstallments ?? '—'} />
          <SummaryMetricItem
            icon={Percent}
            label="Interés Total"
            value={<span title={formatCurrency(loan.paymentContext?.snapshot?.totalInterest)}>{formatCurrency(loan.paymentContext?.snapshot?.totalInterest)}</span>}
          />
          <SummaryMetricItem
            icon={CheckCircle}
            label="Capital Pagado"
            tone="success"
            value={<span title={formatCurrency(loan.paymentContext?.snapshot?.totalPaidPrincipal)}>{formatCurrency(loan.paymentContext?.snapshot?.totalPaidPrincipal)}</span>}
          />
          <SummaryMetricItem
            icon={DollarSign}
            label="Interés Pagado"
            tone="warning"
            value={<span title={formatCurrency(loan.paymentContext?.snapshot?.totalPaidInterest)}>{formatCurrency(loan.paymentContext?.snapshot?.totalPaidInterest)}</span>}
          />
          <SummaryMetricItem
            icon={ShieldAlert}
            label="Tasa Mora EA"
            tone="danger"
            value={loan.annualLateFeeRate ? `${loan.annualLateFeeRate}%` : '—'}
          />
          <SummaryMetricItem
            icon={Activity}
            label="Capital Vivo"
            tone="brand"
            value={<span title={formatCurrency(loan.paymentContext?.snapshot?.outstandingPrincipal)}>{formatCurrency(loan.paymentContext?.snapshot?.outstandingPrincipal)}</span>}
          />
      </section>

      <section className="min-w-0">
        <div className="overflow-x-auto border-b border-border-subtle py-2 hide-scrollbar" data-tour="credit-detail-tabs">
          <div className="flex min-w-max items-center gap-2">
            <TabButton id="calendar" icon={Calendar} label={tTerm('creditDetails.tab.calendar')} />
            {isAdmin && <TabButton id="alerts" icon={Bell} label={tTerm('creditDetails.tab.alerts')} badge={alertEntries.length} />}
            {isAdmin && <TabButton id="promises" icon={Clock} label={tTerm('creditDetails.tab.promises')} badge={promiseEntries.filter((p:any)=>p.status==='pending').length} />}
            <TabButton id="payouts" icon={DollarSign} label="Historial de Pagos" badge={paymentHistoryEntries.length} />
            {canViewPayoff && <TabButton id="payoff" icon={CreditCard} label={tTerm('creditDetails.tab.payoff')} />}
            <TabButton id="history" icon={Activity} label={tTerm('creditDetails.tab.history')} />
          </div>
        </div>

        <div className="py-4 sm:py-5 lg:py-6">
          {/* TAB: CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" data-tour="credit-detail-calendar">
              {calendarEntries.length > 0 ? (
                <div className="space-y-4">
                  <div className="border-b border-border-subtle pb-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-text-primary">Calendario operativo del crédito</p>
                        <p className="mt-1 text-sm leading-6 text-text-secondary">
                          Opera primero la próxima cuota pendiente. El sistema bloquea pagos y anulaciones fuera de secuencia para no romper la cartera.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-medium">
                        <span className="inline-flex items-center gap-2 rounded-full bg-hover-bg px-3 py-2 text-text-secondary">
                          Próxima cuota operable: {nextPayableInstallmentNumber ?? 'Sin pendientes'}
                        </span>
                        {calendarSnapshot && (
                          <span className="inline-flex items-center gap-2 rounded-full bg-hover-bg px-3 py-2 text-text-secondary">
                            Balance pendiente: {formatCurrency(calendarSnapshot.outstandingBalance)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:hidden">
                    {installmentRows.map((row: any, idx: number) => {
                      const installmentStatusInfo = getInstallmentStatusInfo(row.status);

                      return (
                        <div key={`installment-card-${idx}`} className="rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">Cuota #{row.installmentNumber}</p>
                              <p className="mt-2 text-xl font-bold text-text-primary">{formatCurrency(row.scheduledPayment)}</p>
                            </div>
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${installmentStatusInfo.className}`}>
                              {installmentStatusInfo.label}
                            </span>
                          </div>

                          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div>
                              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Interés</dt>
                              <dd className="mt-1 text-sm font-medium text-text-primary">{formatCurrency(row.interestComponent)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Mora</dt>
                              <dd className="mt-1 text-sm font-medium text-rose-600 dark:text-rose-300">{row.lateFeeDue ? formatCurrency(row.lateFeeDue) : '—'}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Amortización</dt>
                              <dd className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-300">{formatCurrency(row.principalComponent)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Capital vivo</dt>
                              <dd className="mt-1 text-sm font-medium text-text-primary">{formatCurrency(row.closingBalance)}</dd>
                            </div>
                          </dl>

                          {isAdmin && (
                            <div className="mt-4 border-t border-border-subtle pt-3">
                              {renderInstallmentActions(row, { alignClassName: 'justify-start', titlePrefix: 'Tarjeta · ' })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="text-xs text-text-secondary uppercase bg-hover-bg/50 border-b border-border-subtle">
                        <tr>
                          <th className="py-4 px-6 font-semibold text-center w-16">N°</th>
                          <th className="py-4 px-6 font-semibold text-right">Cuota a Pagar</th>
                          <th className="py-4 px-6 font-semibold text-right">Interés</th>
                          <th className="py-4 px-6 font-semibold text-right">Mora</th>
                          <th className="py-4 px-6 font-semibold text-right">Amortización</th>
                          <th className="py-4 px-6 font-semibold text-right">Capital Vivo</th>
                          <th className="py-4 px-6 font-semibold text-center w-32">Estado</th>
                          {isAdmin && <th className="py-4 px-6 font-semibold text-center w-16"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {/* Initial balance row */}
                        <tr className="bg-bg-base/30">
                          <td className="py-3 px-6 text-center text-text-secondary font-medium">0</td>
                          <td className="py-3 px-6 text-right text-text-secondary">—</td>
                          <td className="py-3 px-6 text-right text-text-secondary">—</td>
                          <td className="py-3 px-6 text-right text-text-secondary">—</td>
                          <td className="py-3 px-6 text-right text-text-secondary">—</td>
                          <td className="py-3 px-6 text-right font-bold text-text-primary">
                            {formatCurrency(loan.amount)}
                          </td>
                          <td className="py-3 px-6"></td>
                          {isAdmin && <td></td>}
                        </tr>
                      {installmentRows.map((row: any, idx: number) => {
                        const installmentStatusInfo = getInstallmentStatusInfo(row.status);

                        return (
                        <tr
                          key={idx}
                          data-tour={idx === 0 ? 'credit-detail-installment-row' : undefined}
                          className="hover:bg-hover-bg/50 transition-colors group"
                        >
                          <td className="py-3 px-5 text-center font-medium text-text-secondary">{row.installmentNumber}</td>
                          <td className="py-3 px-5 text-right font-medium text-text-primary">
                            {formatCurrency(row.scheduledPayment)}
                          </td>
                          <td className="py-3 px-5 text-right text-text-secondary">
                            {formatCurrency(row.interestComponent)}
                          </td>
                          <td className="py-3 px-5 text-right text-red-600 dark:text-red-400">
                            {row.lateFeeDue ? formatCurrency(row.lateFeeDue) : '—'}
                          </td>
                          <td className="py-3 px-5 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatCurrency(row.principalComponent)}
                          </td>
                          <td className="py-3 px-5 text-right font-medium text-text-primary">
                            {formatCurrency(row.closingBalance)}
                          </td>
                          <td className="py-3 px-5 text-center">
                            <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${installmentStatusInfo.className}`}>
                              {installmentStatusInfo.label}
                            </span>
                          </td>
                           {isAdmin && (
                           <td className="py-3 px-5 text-center">
                            {renderInstallmentActions(row)}
                            </td>
                          )}
                        </tr>
                      )})}
                    </tbody>
                    {calendarSnapshot && (
                      <tfoot className="bg-bg-base border-t border-border-strong">
                        <tr>
                          <td colSpan={5} className="py-4 px-5 text-right text-text-secondary">Balance pendiente total:</td>
                          <td className="py-4 px-5 text-right font-bold text-brand-primary text-base">
                            {formatCurrency(calendarSnapshot.outstandingBalance)}
                          </td>
                          <td colSpan={isAdmin ? 2 : 1}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  </div>
                </div>
              ) : (
                <TabEmptyState
                  icon={Calendar}
                  title="No hay cuotas programadas"
                  description="Este crédito todavía no tiene un plan operativo visible. Revisa la originación o genera el plan de pagos completo."
                />
              )}
            </div>
          )}

          {/* TAB: ALERTS */}
          {activeTab === 'alerts' && (
            <div className="animate-in fade-in duration-300 max-w-3xl">
              {alertEntries.length > 0 ? (
                <div className="space-y-4">
                  {alertEntries.map((alert: any, index: number) => (
                    <div key={alert.id || index} className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex gap-4">
                          <AlertCircle className={alert.status === 'resolved' ? 'text-emerald-500 shrink-0 mt-0.5' : 'text-amber-500 shrink-0 mt-0.5'} size={20} />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-text-primary">{alert.type || alert.alertType || 'Alerta de crédito'}</p>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                alert.status === 'resolved'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                              }`}>
                                {alert.status === 'resolved' ? 'Resuelta' : 'Activa'}
                              </span>
                            </div>
                            <p className="text-sm text-text-secondary mt-1">
                              {alert.message || `Cuota ${alert.installmentNumber || '—'} con saldo ${formatCurrency(alert.outstandingAmount)}`}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                              <span>Vence: {formatDate(alert.dueDate)}</span>
                              <span>Creada: {formatDate(alert.createdAt, true)}</span>
                              {alert.resolvedAt && <span>Resuelta: {formatDate(alert.resolvedAt, true)}</span>}
                            </div>
                            {alert.notes && (
                              <p className="mt-3 rounded-lg bg-bg-base p-3 text-sm text-text-secondary whitespace-pre-wrap">{alert.notes}</p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateAlertStatus(alert, alert.status === 'resolved' ? 'active' : 'resolved')}
                          disabled={updateAlertStatus.isPending}
                          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-text-primary hover:bg-hover-bg disabled:opacity-50"
                        >
                          {alert.status === 'resolved' ? <Bell size={16} /> : <CheckCircle size={16} />}
                          {alert.status === 'resolved' ? 'Reactivar' : 'Resolver'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <TabEmptyState
                  icon={CheckCircle}
                  title="Sin alertas activas"
                  description="No hay vencimientos ni seguimientos abiertos que requieran acción sobre este crédito."
                />
              )}
            </div>
          )}

          {/* TAB: PROMISES */}
          {activeTab === 'promises' && (
            <div className="animate-in fade-in duration-300">
              {promiseEntries.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {promiseEntries.map((promise: any, index: number) => {
                    const isKept = promise.status === 'kept';
                    const isBroken = promise.status === 'broken';
                    const isPending = promise.status === 'pending';
                    
                    return (
                      <div key={promise.id || index} className="p-5 border border-border-subtle rounded-xl bg-bg-surface shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-sm text-text-secondary mb-1">Monto Prometido</p>
                            <p className="text-xl font-medium text-text-primary">{formatCurrency(promise.amount)}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            isKept ? 'bg-emerald-100 text-emerald-700' :
                            isBroken ? 'bg-red-100 text-red-700' :
                            isPending ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {isKept ? 'Cumplida' : isBroken ? 'Incumplida' : isPending ? 'Pendiente' : 'Cancelada'}
                          </span>
                        </div>
                        
                        <p className="text-sm text-text-secondary flex items-center gap-2 mb-4">
                          <Calendar size={16} />
                          <span>Para el {formatDate(promiseDate(promise))}</span>
                        </p>

                        {promise.notes && (
                          <div className="text-sm text-text-secondary bg-bg-base p-3 rounded-lg mb-4">
                            {promise.notes}
                          </div>
                        )}

                        {promise.statusHistory && promise.statusHistory.length > 0 && (
                          <details className="group">
                            <summary className="text-sm text-brand-primary cursor-pointer hover:underline list-none flex items-center gap-1">
                              <ChevronRight size={14} className="group-open:rotate-90 transition-transform" /> Historial
                            </summary>
                            <div className="mt-3 pl-4 border-l-2 border-border-subtle space-y-3">
                              {promise.statusHistory.slice().reverse().map((entry: any, hi: number) => (
                                <div key={hi} className="text-sm">
                                  <span className="text-text-primary">{
                                    entry.status === 'kept' ? 'Cumplida' :
                                    entry.status === 'broken' ? 'Incumplida' :
                                    entry.status === 'cancelled' ? 'Cancelada' :
                                    entry.status === 'pending' ? 'Pendiente' : entry.status
                                  }</span>
                                  <span className="text-text-secondary ml-2">{formatDate(entry.changedAt, true)}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                        <div className="mt-5 flex flex-wrap gap-2">
                          {isPending ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdatePromiseStatus(promise, 'kept')}
                                disabled={updatePromiseStatus.isPending}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                <CheckCircle size={16} /> Cumplida
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdatePromiseStatus(promise, 'broken')}
                                disabled={updatePromiseStatus.isPending}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                              >
                                <AlertTriangle size={16} /> Incumplida
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdatePromiseStatus(promise, 'cancelled')}
                                disabled={updatePromiseStatus.isPending}
                                className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-text-secondary hover:bg-hover-bg disabled:opacity-50"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpdatePromiseStatus(promise, 'pending')}
                              disabled={updatePromiseStatus.isPending}
                              className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-text-primary hover:bg-hover-bg disabled:opacity-50"
                            >
                              <Clock size={16} /> Reabrir
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadPromise(promise)}
                            disabled={downloadPromiseDocument.isPending}
                            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-text-primary hover:bg-hover-bg disabled:opacity-50"
                          >
                            <FileText size={16} /> Descargar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <TabEmptyState
                  icon={Clock}
                  title="Sin compromisos de pago"
                  description="Todavía no hay promesas asociadas. Crea una desde la cuota pendiente cuando acuerdes una fecha con el cliente."
                />
              )}
            </div>
          )}

          {/* TAB: HISTORIAL DE PAGOS */}
          {activeTab === 'payouts' && (
            <div className="animate-in fade-in duration-300">
              {paymentHistoryEntries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-base border-b border-border-subtle">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">ID Pago</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">Tipo</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary"># Cuota</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">Monto</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">Capital</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">Interés</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary">Mora</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">Método</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">Fecha Pago</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistoryEntries.map((entry: any, index: number) => (
                        <tr key={index} className="border-b border-border-subtle hover:bg-hover-bg">
                          <td className="py-3 px-4 text-text-secondary">{entry.paymentId ? `#${entry.paymentId}` : entry.id ? `#${entry.id}` : '—'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              entry.type === 'payoff' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' :
                              entry.paymentType === 'capital' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' :
                              entry.paymentType === 'partial' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                              'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            }`}>
                              {entry.type === 'payoff' ? 'Pago total' :
                               getPaymentTypeLabel(entry.paymentType)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-text-secondary">{entry.installmentNumber || '—'}</td>
                          <td className="py-3 px-4 text-right font-medium text-text-primary">{formatCurrency(entry.amount)}</td>
                          <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">{entry.principalApplied ? formatCurrency(entry.principalApplied) : '—'}</td>
                          <td className="py-3 px-4 text-right text-amber-600 dark:text-amber-400">{entry.interestApplied ? formatCurrency(entry.interestApplied) : '—'}</td>
                          <td className="py-3 px-4 text-right text-red-600 dark:text-red-400">{entry.penaltyApplied ? formatCurrency(entry.penaltyApplied) : '—'}</td>
                          <td className="py-3 px-4 text-text-secondary capitalize">{entry.paymentMethod || '—'}</td>
                          <td className="py-3 px-4 text-text-secondary">{formatDate(entry.date || entry.paymentDate)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              entry.status === 'completed' || entry.paymentStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              entry.status === 'failed' || entry.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {entry.status === 'completed' || entry.paymentStatus === 'completed' ? 'Completado' :
                               entry.status === 'failed' || entry.paymentStatus === 'failed' ? 'Fallido' : 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <TabEmptyState
                  icon={DollarSign}
                  title="Sin pagos registrados"
                  description="Cuando registres un recaudo, aquí verás capital, interés, mora y el método usado para cada movimiento."
                />
              )}
            </div>
          )}

          {/* TAB: PAYOFF */}
          {activeTab === 'payoff' && (
            <div className="animate-in fade-in duration-300">
              {activePayoffQuote ? (
                <div className="max-w-md border border-border-subtle rounded-xl p-6 bg-bg-surface">
                  <h3 className="text-lg font-medium text-text-primary mb-1">Cotización de pago total</h3>
                  <p className="text-sm text-text-secondary mb-6">Válida al {formatDate(activePayoffQuote.asOfDate)}</p>
                    
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Capital restante:</span>
                      <span className="text-text-primary">{formatCurrency(activePayoffQuote.outstandingPrincipal ?? activePayoffQuote.principalBalance)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Intereses a la fecha:</span>
                    <span className="text-text-primary">{formatCurrency(activePayoffQuote.accruedInterest ?? activePayoffQuote.breakdown?.accruedInterest ?? 0)}</span>
                    </div>
                    {Number(activePayoffQuote.lateFees) > 0 && (
                      <div className="flex justify-between text-sm text-amber-600">
                        <span>Cargos por mora:</span>
                        <span>{formatCurrency(activePayoffQuote.lateFees)}</span>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t border-border-subtle flex justify-between items-end">
                      <span className="font-medium text-text-primary">Total a Pagar</span>
                      <span className="text-2xl font-bold text-brand-primary">{formatCurrency(activePayoffQuote.total ?? activePayoffQuote.totalPayoffAmount)}</span>
                    </div>
                  </div>

                  <button 
                    onClick={handlePayoff}
                    disabled={!canViewPayoff || !payoffEligibility?.allowed}
                    className={`w-full py-3 rounded-lg font-medium transition-colors ${
                      canViewPayoff && payoffEligibility?.allowed
                        ? 'bg-text-primary text-bg-base hover:bg-text-secondary' 
                        : 'bg-bg-base border border-border-subtle text-text-secondary cursor-not-allowed'
                    }`}
                  >
                    {canViewPayoff && payoffEligibility?.allowed ? 'Confirmar pago total' : 'Acción no disponible'}
                  </button>
                </div>
              ) : (
                <div className="max-w-2xl">
                  <TabEmptyState
                    icon={Info}
                    title="El pago total no está disponible"
                    description={payoffUnavailableDescription}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB: HISTORY */}
          {activeTab === 'history' && (
            <div className="animate-in fade-in duration-300 max-w-3xl" data-tour="credit-detail-history">
              {isLoadingHistory ? (
                <p className="text-text-secondary">Cargando historial...</p>
              ) : operationalHistoryEntries.length > 0 ? (
                <div className="space-y-6">
                  {operationalHistoryEntries.map((event: any, index: number) => {
                    const paymentId = extractPaymentId(event.id);
                    const isPayment = event.type === 'payment';
                    const isAlert = event.type === 'alert';
                    const isPromise = event.type === 'promise';
                    return (
                      <div key={event.id || index} className="flex gap-4">
                        <div className={`mt-1 p-2 rounded-full h-fit ${
                          isPayment ? 'bg-emerald-100 text-emerald-600' :
                          isAlert ? 'bg-amber-100 text-amber-600' :
                          isPromise ? 'bg-blue-100 text-blue-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {isPayment ? <DollarSign size={16} /> : isAlert ? <Bell size={16} /> : isPromise ? <Clock size={16} /> : <CreditCard size={16} />}
                        </div>
                        <div className="flex-1 pb-6 border-b border-border-subtle last:border-0">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-text-primary">{event.action}</p>
                              <p className="text-sm text-text-secondary mt-1">{event.description}</p>
                              <p className="text-xs text-text-secondary mt-2 flex items-center gap-1">
                                <Clock size={12} /> {formatDate(event.date, true)}
                              </p>
                            </div>
                            {paymentId && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleDownloadVoucher(paymentId)}
                                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-lg transition-colors border border-border-subtle"
                                >
                                  <FileText size={16} /> Recibo
                                </button>
                                {(() => {
                                  const editGuard = resolveOperationalGuard('installment.editPaymentMethod', {
                                    role: user?.role,
                                    permissions: user?.permissions,
                                    loanStatus: loan?.status,
                                    paymentStatus: event.paymentStatus,
                                    paymentReconciled: Boolean(event.paymentReconciled),
                                  });

                                  if (!isAdmin || !editGuard.visible) return null;

                                  return (
                                    <button
                                      onClick={() => openEditPaymentMethodModal(event)}
                                      disabled={!editGuard.executable}
                                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={editGuard.executable ? 'Editar método de pago' : (editGuard.reason || 'Acción no disponible')}
                                    >
                                      <Edit2 size={16} /> Método
                                    </button>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <TabEmptyState
                  icon={Activity}
                  title="Sin historial operativo"
                  description="Aquí aparecerán pagos, alertas, compromisos y actualizaciones relevantes del crédito en orden cronológico."
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* --- MODALS --- */}
      {/* ... keeping modals logic as is, but ensuring their classes are correct */}
      
      {/* Modal: Change Status */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-xl w-full max-w-sm border border-border-subtle shadow-xl overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <h3 className="text-lg font-medium text-text-primary">Cambiar Estado</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm text-text-secondary mb-2">Nuevo Estado</label>
              <select 
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full bg-bg-base border border-border-strong rounded-lg px-4 py-2 outline-none focus:border-text-primary text-sm"
              >
                <option value="">Seleccione un estado...</option>
                {BACKEND_SUPPORTED_LOAN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {LOAN_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-4 bg-bg-base border-t border-border-subtle flex gap-3">
              <button onClick={() => setShowStatusModal(false)} className="flex-1 py-2 text-sm text-text-secondary hover:bg-hover-bg rounded-lg">Cancelar</button>
              <button onClick={handleUpdateStatus} disabled={!newStatus} className="flex-1 py-2 text-sm bg-text-primary text-bg-base rounded-lg disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Record Payment */}
      {isRecordPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-xl w-full max-w-md border border-border-subtle shadow-xl overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <h3 className="text-lg font-medium text-text-primary">Registrar Pago</h3>
            </div>
            <div className="p-6 space-y-4">
              {selectedInstallmentNumber && (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">Cotización cuota #{selectedInstallmentNumber}</span>
                    {installmentQuoteQuery.isFetching && <span className="text-xs">Calculando...</span>}
                  </div>
                  {installmentQuote ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="block text-blue-700 dark:text-blue-300">Base pendiente</span>
                        <span className="font-semibold text-text-primary">{formatCurrency(installmentQuote.outstandingAmount)}</span>
                      </div>
                      <div>
                        <span className="block text-blue-700 dark:text-blue-300">Mora</span>
                        <span className="font-semibold text-red-700 dark:text-red-300">{formatCurrency(installmentQuote.lateFeeDue)}</span>
                      </div>
                      <div>
                        <span className="block text-blue-700 dark:text-blue-300">Días vencidos</span>
                        <span className="font-semibold text-text-primary">{installmentQuote.daysOverdue || 0}</span>
                      </div>
                      <div>
                        <span className="block text-blue-700 dark:text-blue-300">Total sugerido</span>
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(String(installmentQuote.totalDue ?? ''))}
                          className="font-semibold text-brand-primary hover:underline"
                        >
                          {formatCurrency(installmentQuote.totalDue)}
                        </button>
                      </div>
                      {!installmentQuote.canPay && installmentQuote.disabledReason && (
                        <div className="col-span-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                          {installmentQuote.disabledReason}
                        </div>
                      )}
                    </div>
                  ) : installmentQuoteQuery.isError ? (
                    <p className="text-xs text-red-700 dark:text-red-300">No se pudo calcular la cotización. Revisa la cuota y la fecha.</p>
                  ) : (
                    <p className="text-xs text-blue-700 dark:text-blue-300">Pago aplicado a esta cuota usando la regla real de cartera.</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm text-text-secondary mb-1">Monto a pagar</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full bg-bg-base border border-border-strong rounded-lg pl-8 pr-3 py-2 outline-none focus:border-text-primary"
                    placeholder="0.00" min="0" step="0.01"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Fecha</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full bg-bg-base border border-border-strong rounded-lg px-3 py-2 text-sm outline-none focus:border-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Método</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-bg-base border border-border-strong rounded-lg px-3 py-2 text-sm outline-none focus:border-text-primary"
                  >
                    {paymentMethodOptions.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 bg-bg-base border-t border-border-subtle flex gap-3">
              <button onClick={operationalModal.closeModal} className="flex-1 py-2 text-sm text-text-secondary hover:bg-hover-bg rounded-lg">Cancelar</button>
              <button
                onClick={handleRecordPayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || Boolean(installmentQuote && !installmentQuote.canPay)}
                className="flex-1 py-2 text-sm bg-text-primary text-bg-base rounded-lg disabled:opacity-50"
              >
                Registrar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Promise from installment */}
      {isPromiseModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-xl w-full max-w-md border border-border-subtle shadow-xl overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <h3 className="text-lg font-medium text-text-primary">Crear Promesa de Pago</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Monto prometido</label>
                <input
                  type="number"
                  value={promiseAmount}
                  onChange={(e) => setPromiseAmount(e.target.value)}
                  className="w-full bg-bg-base border border-border-strong rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Fecha comprometida</label>
                <input
                  type="date"
                  value={promiseDateInput}
                  onChange={(e) => setPromiseDateInput(e.target.value)}
                  className="w-full bg-bg-base border border-border-strong rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Notas</label>
                <textarea
                  value={promiseNotes}
                  onChange={(e) => setPromiseNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-bg-base border border-border-strong rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="p-4 bg-bg-base border-t border-border-subtle flex gap-3">
              <button onClick={operationalModal.closeModal} className="flex-1 py-2 text-sm text-text-secondary hover:bg-hover-bg rounded-lg">Cancelar</button>
              <button onClick={handleCreatePromise} className="flex-1 py-2 text-sm bg-text-primary text-bg-base rounded-lg">Guardar Promesa</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Follow-up from installment */}
      {isFollowUpModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-xl w-full max-w-md border border-border-subtle shadow-xl overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <h3 className="text-lg font-medium text-text-primary">Registrar Seguimiento</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Detalle</label>
                <textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  rows={4}
                  className="w-full bg-bg-base border border-border-strong rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="p-4 bg-bg-base border-t border-border-subtle flex gap-3">
              <button onClick={operationalModal.closeModal} className="flex-1 py-2 text-sm text-text-secondary hover:bg-hover-bg rounded-lg">Cancelar</button>
              <button onClick={handleCreateFollowUp} className="flex-1 py-2 text-sm bg-text-primary text-bg-base rounded-lg">Guardar Seguimiento</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Annul Installment */}
      {showAnnulModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-xl w-full max-w-md border border-border-subtle shadow-xl overflow-hidden">
             <div className="p-6 border-b border-border-subtle bg-red-50 dark:bg-red-500/10">
              <h3 className="text-lg font-medium text-red-600 dark:text-red-400">Anular Cuota #{annulInstallmentNumber}</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-text-secondary mb-4">Esta acción marcará la cuota como anulada y recalculará el calendario. No se puede deshacer.</p>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Razón de anulación (opcional)</label>
                <textarea
                  value={annulReason}
                  onChange={(e) => setAnnulReason(e.target.value)}
                  className="w-full bg-bg-base border border-border-strong rounded-lg px-3 py-2 text-sm outline-none focus:border-red-500 resize-none"
                  rows={3}
                />
              </div>
            </div>
            <div className="p-4 bg-bg-base border-t border-border-subtle flex gap-3">
              <button onClick={() => { setShowAnnulModal(false); setAnnulInstallmentNumber(null); }} className="flex-1 py-2 text-sm text-text-secondary hover:bg-hover-bg rounded-lg">Cancelar</button>
              <button onClick={handleAnnulInstallment} className="flex-1 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Confirmar Anulación</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Capital Contribution */}
      {showCapitalModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-xl w-full max-w-md border border-border-subtle shadow-xl overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <h3 className="text-lg font-medium text-text-primary">Aporte de Capital</h3>
            </div>
            <div className="p-6 space-y-4">
               <div>
                <label className="block text-sm text-text-secondary mb-1">Monto de aporte</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                  <input
                    type="number"
                    value={capitalAmount}
                    onChange={(e) => setCapitalAmount(e.target.value)}
                    className="w-full bg-bg-base border border-border-strong rounded-lg pl-8 pr-3 py-2 outline-none focus:border-text-primary"
                    placeholder="0.00" min="0" step="0.01"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Método</label>
                  <select
                    value={capitalMethod}
                    onChange={(e) => setCapitalMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-bg-base border border-border-strong rounded-lg px-3 py-2 text-sm outline-none focus:border-text-primary"
                  >
                    {paymentMethodOptions.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Estrategia</label>
                  <select
                    value={capitalStrategy}
                    onChange={(e) => setCapitalStrategy(e.target.value as CapitalStrategy)}
                    className="w-full bg-bg-base border border-border-strong rounded-lg px-3 py-2 text-sm outline-none focus:border-text-primary"
                  >
                    {CAPITAL_STRATEGIES.map((strategy) => (
                      <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 bg-bg-base border-t border-border-subtle flex gap-3">
              <button onClick={() => setShowCapitalModal(false)} className="flex-1 py-2 text-sm text-text-secondary hover:bg-hover-bg rounded-lg">Cancelar</button>
              <button onClick={handleRecordCapital} disabled={!capitalAmount || parseFloat(capitalAmount) <= 0} className="flex-1 py-2 text-sm bg-text-primary text-bg-base rounded-lg disabled:opacity-50">Registrar Aporte</button>
            </div>
          </div>
        </div>
      )}

      {showEditPaymentMethodModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-xl w-full max-w-sm border border-border-subtle shadow-xl overflow-hidden">
            <div className="p-6 border-b border-border-subtle">
              <h3 className="text-lg font-medium text-text-primary">Editar método de pago</h3>
            </div>
            <div className="p-6 space-y-4">
              {editingPaymentReconciled && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  El pago está conciliado. No se permite editar su método.
                </div>
              )}
              <div>
                <label htmlFor="credit-payment-method-select" className="block text-sm text-text-secondary mb-1">Nuevo método</label>
                <select
                  id="credit-payment-method-select"
                  value={newPaymentMethod}
                  onChange={(event) => setNewPaymentMethod(event.target.value as PaymentMethod)}
                  disabled={editingPaymentReconciled}
                  className="w-full bg-bg-base border border-border-strong rounded-lg px-3 py-2 text-sm outline-none focus:border-text-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {paymentMethodOptions.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 bg-bg-base border-t border-border-subtle flex gap-3">
              <button
                onClick={() => {
                  setShowEditPaymentMethodModal(false);
                  setEditingPaymentId(null);
                  setEditingPaymentReconciled(false);
                }}
                className="flex-1 py-2 text-sm text-text-secondary hover:bg-hover-bg rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdatePaymentMethod}
                disabled={editingPaymentReconciled}
                className="flex-1 py-2 text-sm bg-text-primary text-bg-base rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Late Fee Rate */}
      {showLateFeeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-xl w-full max-w-sm border border-border-subtle shadow-xl overflow-hidden">
             <div className="p-6 border-b border-border-subtle">
              <h3 className="text-lg font-medium text-text-primary">Tasa de Mora Anual</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm text-text-secondary mb-1">Tasa (%)</label>
              <div className="relative">
                <input
                  type="number"
                  value={lateFeeRate}
                  onChange={(e) => setLateFeeRate(e.target.value)}
                  className="w-full bg-bg-base border border-border-strong rounded-lg pl-3 pr-8 py-2 outline-none focus:border-text-primary"
                  placeholder="0.00" min="0" max="100" step="0.01"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">%</span>
              </div>
            </div>
            <div className="p-4 bg-bg-base border-t border-border-subtle flex gap-3">
              <button onClick={() => setShowLateFeeModal(false)} className="flex-1 py-2 text-sm text-text-secondary hover:bg-hover-bg rounded-lg">Cancelar</button>
              <button onClick={handleUpdateLateFeeRate} className="flex-1 py-2 text-sm bg-text-primary text-bg-base rounded-lg">Guardar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
