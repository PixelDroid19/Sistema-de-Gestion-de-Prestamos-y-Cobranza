import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar, Bell, Clock, CreditCard, CheckCircle,
  Edit2, FileText, DollarSign, ShieldAlert, History,
  AlertTriangle, AlertCircle, ChevronRight, Activity
} from 'lucide-react';
import { useInstallmentQuote, useLoanById, useLoanDetails, useLoans, PAYMENT_METHODS as FALLBACK_PAYMENT_METHODS, CAPITAL_STRATEGIES, type PaymentMethod, type CapitalStrategy } from '../services/loanService';
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
import { BACKEND_SUPPORTED_LOAN_STATUSES, LOAN_STATUS_LABELS } from '../constants/loanStates';
import { getPaymentTypeLabel } from '../constants/paymentTypes';
import { confirmDanger } from '../lib/confirmModal';
import { resolveOperationalGuard } from '../services/operationalGuards';
import { formatLoanAlertTypeLabel } from '../lib/loanAlertLabels';
import { CreditDetailHeader } from './creditDetails/CreditDetailHeader';
import { CreditSummaryMetrics } from './creditDetails/CreditSummaryMetrics';
import { CreditDetailsTabs, TabEmptyState, type CreditDetailsTab } from './creditDetails/CreditDetailsTabs';
import { InstallmentActionButton } from './creditDetails/InstallmentActionButton';
import { ActionButton, EmptyState, FormField, ModalShell, SelectInput, TextAreaInput, TextInput } from './shared/Surfaces';

type PayoffDenialReason = string | {
  code?: string;
  message?: string;
};

const PAYOFF_DENIAL_MESSAGES: Record<string, string> = {
  LOAN_ALREADY_PAID: 'Este crédito ya no tiene saldo pendiente para liquidar.',
  NO_OUTSTANDING_BALANCE: 'Este crédito ya no tiene saldo pendiente para liquidar.',
  LOAN_NOT_PAYABLE_STATUS: 'El estado actual del crédito no permite pago total.',
  PAYOFF_BEFORE_LOAN_START: 'El pago total solo puede ejecutarse desde la fecha de inicio del crédito.',
  OVERDUE_UNPAID_INSTALLMENTS: 'Regulariza las cuotas vencidas antes de ejecutar el pago total.',
  FINANCIAL_BLOCK: 'Este crédito tiene un bloqueo financiero activo.',
};

const CAPITAL_PAYMENT_DENIAL_MESSAGES: Record<string, string> = {
  FIRST_INSTALLMENT_PAYMENT_REQUIRED: 'Primero registra el pago completo de la primera cuota. Después podrás abonar a capital.',
  NO_OUTSTANDING_BALANCE: 'Este crédito no tiene capital vivo disponible para abonar.',
  LOAN_NOT_PAYABLE_STATUS: 'El estado actual del crédito no permite abonos a capital.',
  OVERDUE_UNPAID_INSTALLMENTS: 'Regulariza las cuotas vencidas antes de abonar a capital.',
  FINANCIAL_BLOCK: 'Este crédito tiene un bloqueo financiero activo.',
  PARTIAL_INSTALLMENT_PENDING: 'Completa la cuota parcial pendiente antes de abonar a capital.',
  DUE_INTEREST_PENDING: 'Primero paga el interés exigible de la cuota pendiente.',
};

const formatPayoffDenialReason = (reason: PayoffDenialReason | null) => {
  if (!reason) return '';
  if (typeof reason === 'string') return reason;
  if (reason.code && PAYOFF_DENIAL_MESSAGES[reason.code]) {
    return PAYOFF_DENIAL_MESSAGES[reason.code];
  }
  return reason.message || '';
};

const formatCapitalPaymentDenialReason = (reason: PayoffDenialReason | null) => {
  if (!reason) return '';
  if (typeof reason === 'string') return reason;
  if (reason.code && CAPITAL_PAYMENT_DENIAL_MESSAGES[reason.code]) {
    return CAPITAL_PAYMENT_DENIAL_MESSAGES[reason.code];
  }
  return reason.message || '';
};

function stableCreditKey(prefix: string, ...parts: Array<unknown>) {
  const body = parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join('-');

  return body ? `${prefix}-${body}` : prefix;
}

function getInstallmentRowKey(row: any) {
  return stableCreditKey(
    'installment',
    row?.id,
    row?.installmentNumber,
    row?.dueDate,
    row?.scheduledPayment,
    row?.closingBalance,
  );
}

export default function CreditDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loanId = Number(id);
  const [activeTab, setActiveTab] = useState<CreditDetailsTab>('calendar');
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
  const capitalEligibility = loan?.paymentContext?.capitalEligibility;
  const shouldFetchPayoffQuote = canViewPayoff && Boolean(payoffEligibility?.allowed);
  const primaryPayoffDenialReason = Array.isArray(payoffEligibility?.denialReasons)
    ? payoffEligibility.denialReasons[0]
    : null;
  const primaryCapitalDenialReason = Array.isArray(capitalEligibility?.denialReasons)
    ? capitalEligibility.denialReasons[0]
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

  const formatMetricCurrency = (value: unknown) => {
    const numericValue = Number(value ?? 0);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(Number.isFinite(numericValue) ? numericValue : 0);
  };

  const cleanAlertDisplayText = (value: unknown) => {
    if (!value) return '';

    return String(value)
      .split(/\r?\n/)
      .map((line) => line
        .trim()
        .replace(/^\[[^\]]+\]\s*/, '')
        .replace(/^(REMINDER|PAYMENT_REMINDER|OVERDUE|FOLLOW_UP|ALERT)\b[:\s-]*/i, '')
        .replace(/\b(actor|actorId|user|userId|loan|loanId|alert|alertId|status)[:=][^\s]+/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim())
      .filter(Boolean)
      .join('\n');
  };

  const getAlertPresentation = (alert: any) => {
    const status = String(alert?.status || '').toLowerCase();
    const isResolved = status === 'resolved';
    const installmentLabel = alert?.installmentNumber != null
      ? `Cuota n.º ${alert.installmentNumber}`
      : 'Cuota sin número';
    const outstandingAmount = Number(alert?.outstandingAmount ?? alert?.amount ?? 0);
    const balanceLabel = Number.isFinite(outstandingAmount) && Math.abs(outstandingAmount) > 0.005
      ? `Saldo ${formatCurrency(outstandingAmount)}`
      : 'Sin saldo pendiente';
    const cleanMessage = cleanAlertDisplayText(alert?.message);
    const cleanNotes = cleanAlertDisplayText(alert?.notes);

    return {
      typeLabel: formatLoanAlertTypeLabel(alert?.alertType || alert?.type),
      statusLabel: isResolved ? 'Resuelta' : 'Activa',
      statusClassName: isResolved
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300'
        : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300',
      iconClassName: isResolved
        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
        : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
      summary: cleanMessage || `${installmentLabel} · ${balanceLabel}`,
      installmentLabel,
      balanceLabel,
      notes: cleanNotes,
    };
  };

  const formatOperationalStatus = (status: unknown) => {
    const normalizedStatus = String(status || '').toLowerCase();
    const labels: Record<string, string> = {
      active: 'Activa',
      resolved: 'Resuelta',
      pending: 'Pendiente',
      completed: 'Completado',
      failed: 'Fallido',
      kept: 'Cumplida',
      broken: 'Incumplida',
      cancelled: 'Cancelada',
    };

    return labels[normalizedStatus] || String(status || '');
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Activo', className: 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-100 dark:border-blue-500/30' };
      case 'approved':
        return { label: 'Aprobado', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30' };
      case 'overdue':
        return { label: 'Vencido', className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 border border-orange-200 dark:border-orange-500/30' };
      case 'paid':
        return { label: 'Pagado', className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-200 dark:border-slate-500/30' };
      case 'completed':
      case 'closed':
        return { label: 'Completado', className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-200 dark:border-slate-500/30' };
      case 'defaulted':
        return { label: 'En mora', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-200 dark:border-red-500/30' };
      case 'cancelled':
        return { label: 'Cancelado', className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-200 dark:border-slate-500/30' };
      case 'pending':
        return {
          label: 'Pendiente',
          className:
            'bg-amber-200/95 text-amber-950 border border-amber-500/45 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-400/35',
        };
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
  const baseCapitalPaymentGuard = resolveOperationalGuard('capital.payment', {
    role: user?.role,
    permissions: user?.permissions,
    loanStatus: loan?.status,
  });
  const capitalUnavailableDescription = formatCapitalPaymentDenialReason(primaryCapitalDenialReason)
    || 'Primero debe existir al menos la primera cuota pagada para abonar a capital.';
  const capitalPaymentGuard = {
    ...baseCapitalPaymentGuard,
    executable: Boolean(baseCapitalPaymentGuard.executable && capitalEligibility?.allowed !== false),
    reason: baseCapitalPaymentGuard.executable && capitalEligibility?.allowed === false
      ? capitalUnavailableDescription
      : baseCapitalPaymentGuard.reason,
  };
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
  const showInstallmentActionColumn = isAdmin || installmentPaymentGuard.visible;
  const creditDetailSubtitle = isAdmin
    ? 'Opera pagos, mora y seguimientos usando la fórmula congelada al crear este crédito.'
    : 'Consulta tu plan de pagos, historial y opciones de pago disponibles para este crédito.';

  const paymentHistoryEntries = useMemo(() => {
    const source = history?.data?.history ?? history;
    const payments = Array.isArray(source?.payments) ? source.payments : [];
    const payoffHistory = Array.isArray(source?.payoffHistory) ? source.payoffHistory : [];

    return [
      ...payments.map((payment: any) => ({
        id: payment.id ?? stableCreditKey('payment', payment.paymentDate, payment.createdAt, payment.amount, payment.installmentNumber),
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
        id: stableCreditKey('payoff', event.id, event.paymentDate, event.createdAt, event.amount, event.quotedTotal),
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
  const paymentSnapshot = loan?.paymentContext?.snapshot;
  const alertEntries = Array.isArray(alerts) && alerts.length > 0 ? alerts : reportAlertEntries;
  const promiseEntries = Array.isArray(promises) && promises.length > 0 ? promises : reportPromiseEntries;
  const hasNoOutstandingPayoffBalance = (
    (loan?.paymentContext?.snapshot?.outstandingBalance ?? 0) <= 0.01
    || ['closed', 'completed', 'paid', 'cancelled'].includes(String(loan?.status || '').toLowerCase())
  );
  const payoffUnavailableDescription = formatPayoffDenialReason(primaryPayoffDenialReason)
    || (
      hasNoOutstandingPayoffBalance
        ? 'Este crédito ya no tiene saldo pendiente para liquidar.'
        : 'Verifica el estado del crédito y la elegibilidad de la cartera antes de continuar con esta operación.'
    );
  const payoffPaymentGuard = {
    visible: canViewPayoff,
    executable: Boolean(canViewPayoff && payoffEligibility?.allowed && payoffQuote),
    reason: payoffEligibility?.allowed
      ? 'Estamos preparando la cotización de liquidación. Intenta de nuevo en unos segundos.'
      : payoffUnavailableDescription,
  };
  const operationalHistoryEntries = useMemo(() => {
    const alertEvents = alertEntries.flatMap((alert: any) => {
      const alertPresentation = getAlertPresentation(alert);
      const events = [{
        id: `alert-created-${alert.id}`,
        action: alert.status === 'resolved' ? 'Alerta resuelta' : 'Alerta activa',
        description: `${alertPresentation.typeLabel} · ${alertPresentation.summary}`,
        date: alert.resolvedAt || alert.createdAt || alert.dueDate,
        type: 'alert',
        status: alert.status,
      }];

      if (alertPresentation.notes) {
        events.push({
          id: `alert-note-${alert.id}`,
          action: 'Seguimiento registrado',
          description: alertPresentation.notes,
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

    tabs.push('payouts', 'history');

    return tabs;
  }, [isAdmin]);

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
  const [capitalPaymentDate, setCapitalPaymentDate] = useState(new Date().toISOString().slice(0, 10));

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

  const { run: runExportCreditExcel, isSubmitting: isExportingCreditExcel } = useSafeMutationAction<number>({
    action: async (targetLoanId) => exportCreditExcel(targetLoanId),
    errorContext: { domain: 'reports', action: 'reports.export' },
    successMessage: 'Excel del crédito descargado',
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

  const capitalPreview = useMemo(() => {
    const amount = Number(capitalAmount || 0);
    const currentPrincipal = Number(paymentSnapshot?.outstandingPrincipal ?? loan?.principalOutstanding ?? 0);
    const remainingInstallments = Number(paymentSnapshot?.outstandingInstallments ?? 0);
    const currentInstallment = Number(paymentSnapshot?.nextInstallment?.scheduledPayment ?? loan?.installmentAmount ?? 0);
    const annualRate = Number(loan?.interestRate ?? 0);
    const newPrincipal = Math.max(0, currentPrincipal - (Number.isFinite(amount) ? amount : 0));
    const monthlyRate = annualRate / 100 / 12;

    const estimatePayment = (principal: number, term: number) => {
      if (principal <= 0 || term <= 0) return 0;
      if (monthlyRate <= 0) return principal / term;
      return (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
    };

    const estimateTerm = () => {
      if (newPrincipal <= 0) return 0;
      if (currentInstallment <= 0 || remainingInstallments <= 0) return remainingInstallments;
      if (monthlyRate <= 0) return Math.min(remainingInstallments, Math.ceil(newPrincipal / currentInstallment));
      if (currentInstallment <= newPrincipal * monthlyRate) return remainingInstallments;
      const rawTerm = Math.ceil(-Math.log(1 - ((newPrincipal * monthlyRate) / currentInstallment)) / Math.log(1 + monthlyRate));
      return Number.isFinite(rawTerm) ? Math.max(1, Math.min(remainingInstallments, rawTerm)) : remainingInstallments;
    };

    const estimatedInstallments = capitalStrategy === 'reduce_payment'
      ? remainingInstallments
      : estimateTerm();
    const estimatedPayment = capitalStrategy === 'reduce_payment'
      ? estimatePayment(newPrincipal, remainingInstallments)
      : Math.min(currentInstallment, estimatePayment(newPrincipal, estimatedInstallments) || currentInstallment);

    return {
      amount,
      currentPrincipal,
      newPrincipal,
      currentInstallment,
      estimatedPayment,
      remainingInstallments,
      estimatedInstallments,
    };
  }, [capitalAmount, capitalStrategy, loan?.installmentAmount, loan?.interestRate, loan?.principalOutstanding, paymentSnapshot]);

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
      <div className="mx-auto w-full max-w-[88rem] px-4 py-8 lg:px-6">
        <EmptyState
          title="ID de crédito inválido"
          icon={<AlertCircle size={18} />}
          action={(
            <ActionButton onClick={() => navigate('/credits')}>
              Volver a créditos
            </ActionButton>
          )}
        />
      </div>
    );
  }

  if (isLoadingLoans || isLoadingLoanRecord || isLoadingDetails) {
    return (
      <div className="mx-auto w-full max-w-[88rem] px-4 py-8 lg:px-6">
        <EmptyState title="Cargando detalles del crédito…" icon={<Activity size={18} />} compact />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="mx-auto w-full max-w-[88rem] px-4 py-8 lg:px-6">
        <EmptyState
          title="Crédito no encontrado"
          icon={<FileText size={18} />}
          action={(
            <ActionButton onClick={() => navigate('/credits')}>
              Volver a créditos
            </ActionButton>
          )}
        />
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
        operationalModal.closeModal();
        setPaymentAmount('');
        setSelectedInstallmentNumber(null);
        await invalidateAfterPayment(queryClient, { loanId });
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
        operationalModal.closeModal();
        setPromiseAmount('');
        setPromiseNotes('');
        await invalidateAfterPromiseOrFollowUp(queryClient, { loanId });
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
        operationalModal.closeModal();
        setFollowUpNotes('');
        await invalidateAfterPromiseOrFollowUp(queryClient, { loanId });
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
    if (!capitalPaymentGuard.executable) {
      toast.error({
        title: 'Abono a capital no disponible',
        description: capitalPaymentGuard.reason || capitalUnavailableDescription,
      });
      return;
    }
    await executeGuardedAction({
      action: 'capital.payment',
      context: { role: user?.role, permissions: user?.permissions, loanStatus: loan?.status },
      run: async () => {
        await recordCapitalPayment.mutateAsync({
          amount,
          paymentDate: capitalPaymentDate,
          paymentMethod: capitalMethod,
          strategy: capitalStrategy,
        });
      },
      onSuccess: async () => {
        await invalidateAfterPayment(queryClient, { loanId });
        setShowCapitalModal(false);
        setCapitalAmount('');
        setCapitalPaymentDate(new Date().toISOString().slice(0, 10));
      },
      successMessage: 'Abono a capital registrado',
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

  const calculationProfileSummary = loan?.calculationProfile?.name
    ? `${loan.calculationProfile.name} (v${loan.calculationProfile.version})`
    : loan?.calculationProfileVersionId
      ? `Regla de cálculo v${loan.calculationProfileVersionId}`
      : 'Snapshot financiero congelado';

  const getInstallmentStatusInfo = (status: unknown) => {
    switch (String(status || '').toLowerCase()) {
      case 'paid':
        return {
          label: 'Pagada',
          className: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30',
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
    if (!['pending', 'overdue', 'partial'].includes(String(row?.status || '').toLowerCase())) {
      return null;
    }

    const alignClassName = options?.alignClassName ?? 'justify-end';
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
      <div
        className={`credit-installment-actions inline-flex flex-nowrap items-center gap-1.5 ${alignClassName}`}
        role="toolbar"
        aria-label={`Acciones de la cuota ${row.installmentNumber}`}
      >
        {paymentGuard.visible && (
          <InstallmentActionButton
            onClick={() => openInstallmentPayment(row)}
            disabled={!isNextPendingInstallment || !paymentGuard.executable}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-text-secondary transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
            label={isNextPendingInstallment && paymentGuard.executable ? `${titlePrefix}${isAdmin ? 'Registrar pago de cuota' : 'Pagar cuota'}` : paymentActionReason}
          >
            <DollarSign size={16} />
          </InstallmentActionButton>
        )}
        {isAdmin && (
          <>
            <InstallmentActionButton
              onClick={() => openPromiseFromInstallment(row)}
              disabled={!isNextPendingInstallment}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-text-secondary transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10 dark:hover:text-amber-200"
              label={isNextPendingInstallment ? `${titlePrefix}Crear compromiso de pago` : installmentReason}
            >
              <Clock size={16} />
            </InstallmentActionButton>
            <InstallmentActionButton
              onClick={() => openFollowUpFromInstallment(row)}
              disabled={!isNextPendingInstallment}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-text-secondary transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent dark:hover:border-slate-500/30 dark:hover:bg-slate-500/10 dark:hover:text-slate-200"
              label={isNextPendingInstallment ? `${titlePrefix}Crear seguimiento` : installmentReason}
            >
              <Bell size={16} />
            </InstallmentActionButton>
            <InstallmentActionButton
              onClick={() => openAnnulModal(row.installmentNumber)}
              disabled={!isNextPendingInstallment || !annulGuard.executable}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-text-secondary transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
              label={isNextPendingInstallment && annulGuard.executable ? `${titlePrefix}Anular cuota` : annulActionReason}
            >
              <ShieldAlert size={16} />
            </InstallmentActionButton>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[88rem] min-w-0 space-y-5 overflow-x-hidden px-4 pb-12 pt-2 animate-in fade-in duration-300 lg:px-6" data-tour="credit-detail-page">
      <CreditDetailHeader
        loanId={loan.id}
        statusInfo={statusInfo}
        subtitle={creditDetailSubtitle}
        customerLabel={customerLabel}
        calculationProfileSummary={calculationProfileSummary}
        registerPaymentLabel={isAdmin ? tTerm('creditDetails.cta.recordPayment') : 'Pagar cuota'}
        capitalContributionLabel={tTerm('creditDetails.cta.capitalContribution')}
        isAdmin={isAdmin}
        isExportingCreditExcel={isExportingCreditExcel}
        installmentPaymentGuard={installmentPaymentGuard}
        capitalPaymentGuard={capitalPaymentGuard}
        payoffPaymentGuard={payoffPaymentGuard}
        lateFeeUpdateGuard={lateFeeUpdateGuard}
        creditStatusUpdateGuard={creditStatusUpdateGuard}
        onBack={() => navigate('/credits')}
        onRegisterPayment={openNextInstallmentPayment}
        onOpenCapitalPayment={() => setShowCapitalModal(true)}
        onPayoff={handlePayoff}
        onOpenLateFeeRate={() => {
          setLateFeeRate(String(loan.annualLateFeeRate || ''));
          setShowLateFeeModal(true);
        }}
        onOpenStatus={() => setShowStatusModal(true)}
        onExportCreditExcel={() => runExportCreditExcel(loanId)}
        onOpenSchedule={() => navigate(`/credits/${loanId}/schedule`)}
      />

      <CreditSummaryMetrics
        loan={loan}
        paymentSnapshot={paymentSnapshot}
        formatCurrency={formatCurrency}
        formatMetricCurrency={formatMetricCurrency}
      />

      <section className="min-w-0">
        <CreditDetailsTabs
          activeTab={activeTab}
          isAdmin={isAdmin}
          alertCount={alertEntries.length}
          pendingPromiseCount={promiseEntries.filter((promise: any) => promise.status === 'pending').length}
          paymentHistoryCount={paymentHistoryEntries.length}
          labels={{
            calendar: tTerm('creditDetails.tab.calendar'),
            alerts: tTerm('creditDetails.tab.alerts'),
            promises: tTerm('creditDetails.tab.promises'),
            history: tTerm('creditDetails.tab.history'),
          }}
          onSelect={setActiveTab}
        />

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
                    {installmentRows.map((row: any) => {
                      const installmentStatusInfo = getInstallmentStatusInfo(row.status);

                      return (
                        <div key={getInstallmentRowKey(row)} className="rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
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

                          {showInstallmentActionColumn && (
                            <div className="mt-4 border-t border-border-subtle pt-3">
                              {renderInstallmentActions(row, { alignClassName: 'justify-start', titlePrefix: 'Tarjeta · ' })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="data-table-surface hidden overflow-x-auto lg:block">
                    <table className="min-w-[1080px] w-full text-sm text-left whitespace-nowrap">
                      <thead>
                        <tr>
                          <th className="w-16 text-center">N°</th>
                          <th className="text-right">Cuota a pagar</th>
                          <th className="text-right">Interés</th>
                          <th className="text-right">Mora</th>
                          <th className="text-right">Amortización</th>
                          <th className="text-right">Capital vivo</th>
                          <th className="w-32 text-center">Estado</th>
                          {showInstallmentActionColumn && <th className="w-44 min-w-[11rem] text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Initial balance row */}
                        <tr>
                          <td className="text-center text-text-secondary font-medium">0</td>
                          <td className="text-right text-text-secondary">—</td>
                          <td className="text-right text-text-secondary">—</td>
                          <td className="text-right text-text-secondary">—</td>
                          <td className="text-right text-text-secondary">—</td>
                          <td className="text-right font-bold text-text-primary">
                            {formatCurrency(loan.amount)}
                          </td>
                          <td></td>
                          {showInstallmentActionColumn && <td></td>}
                        </tr>
                      {installmentRows.map((row: any, idx: number) => {
                        const installmentStatusInfo = getInstallmentStatusInfo(row.status);

                        return (
                        <tr
                          key={getInstallmentRowKey(row)}
                          data-tour={idx === 0 ? 'credit-detail-installment-row' : undefined}
                          className="group"
                        >
                          <td className="text-center font-medium text-text-secondary">{row.installmentNumber}</td>
                          <td className="text-right font-medium text-text-primary">
                            {formatCurrency(row.scheduledPayment)}
                          </td>
                          <td className="text-right text-text-secondary">
                            {formatCurrency(row.interestComponent)}
                          </td>
                          <td className="text-right text-red-600 dark:text-red-400">
                            {row.lateFeeDue ? formatCurrency(row.lateFeeDue) : '—'}
                          </td>
                          <td className="text-right text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatCurrency(row.principalComponent)}
                          </td>
                          <td className="text-right font-medium text-text-primary">
                            {formatCurrency(row.closingBalance)}
                          </td>
                          <td className="text-center">
                            <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${installmentStatusInfo.className}`}>
                              {installmentStatusInfo.label}
                            </span>
                          </td>
                           {showInstallmentActionColumn && (
                           <td className="w-44 min-w-[11rem] text-right">
                            {renderInstallmentActions(row)}
                            </td>
                          )}
                        </tr>
                      )})}
                    </tbody>
                    {calendarSnapshot && (
                    <tfoot>
                        <tr>
                          <td colSpan={5} className="text-right text-text-secondary">Balance pendiente total:</td>
                          <td className="text-right font-bold text-brand-primary text-base">
                            {formatCurrency(calendarSnapshot.outstandingBalance)}
                          </td>
                          <td colSpan={showInstallmentActionColumn ? 2 : 1}></td>
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
            <div className="animate-in fade-in duration-300 max-w-5xl">
              {alertEntries.length > 0 ? (
                <div className="space-y-4">
                  {alertEntries.map((alert: any) => {
                    const alertPresentation = getAlertPresentation(alert);

                    return (
                    <div key={stableCreditKey('alert', alert.id, alert.type, alert.installmentNumber, alert.dueDate, alert.createdAt)} className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex gap-4">
                          <span className={`mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full ${alertPresentation.iconClassName}`}>
                            <AlertCircle size={20} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-text-primary">{alertPresentation.typeLabel}</p>
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${alertPresentation.statusClassName}`}>
                                {alertPresentation.statusLabel}
                              </span>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-text-secondary">{alertPresentation.summary}</p>
                            <dl className="mt-3 grid gap-3 text-xs text-text-secondary sm:grid-cols-3">
                              <div>
                                <dt className="font-semibold uppercase tracking-[0.12em]">Cuota</dt>
                                <dd className="mt-1 text-text-primary">{alertPresentation.installmentLabel}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold uppercase tracking-[0.12em]">Saldo</dt>
                                <dd className="mt-1 text-text-primary">{alertPresentation.balanceLabel}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold uppercase tracking-[0.12em]">Vence</dt>
                                <dd className="mt-1 text-text-primary">{formatDate(alert.dueDate)}</dd>
                              </div>
                            </dl>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                              <span>Creada: {formatDate(alert.createdAt, true)}</span>
                              {alert.resolvedAt && <span>Resuelta: {formatDate(alert.resolvedAt, true)}</span>}
                            </div>
                            {alertPresentation.notes && (
                              <p className="mt-3 rounded-lg bg-bg-base p-3 text-sm leading-6 text-text-secondary whitespace-pre-wrap">{alertPresentation.notes}</p>
                            )}
                          </div>
                        </div>
                        <ActionButton
                          type="button"
                          onClick={() => handleUpdateAlertStatus(alert, alert.status === 'resolved' ? 'active' : 'resolved')}
                          disabled={updateAlertStatus.isPending}
                          icon={alert.status === 'resolved' ? <Bell size={16} /> : <CheckCircle size={16} />}
                        >
                          {alert.status === 'resolved' ? 'Reactivar' : 'Resolver'}
                        </ActionButton>
                      </div>
                    </div>
                  )})}
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
                  {promiseEntries.map((promise: any) => {
                    const isKept = promise.status === 'kept';
                    const isBroken = promise.status === 'broken';
                    const isPending = promise.status === 'pending';

                    return (
                      <div key={stableCreditKey('promise', promise.id, promiseDate(promise), promise.createdAt, promise.amount)} className="p-5 border border-border-subtle rounded-xl bg-bg-surface shadow-sm">
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
                              {promise.statusHistory.slice().reverse().map((entry: any) => (
                                <div key={stableCreditKey('promise-history', promise.id, entry.id, entry.status, entry.changedAt)} className="text-sm">
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
                              <ActionButton
                                type="button"
                                onClick={() => handleUpdatePromiseStatus(promise, 'kept')}
                                disabled={updatePromiseStatus.isPending}
                                variant="primary"
                                icon={<CheckCircle size={16} />}
                              >
                                Cumplida
                              </ActionButton>
                              <ActionButton
                                type="button"
                                onClick={() => handleUpdatePromiseStatus(promise, 'broken')}
                                disabled={updatePromiseStatus.isPending}
                                variant="danger"
                                icon={<AlertTriangle size={16} />}
                              >
                                Incumplida
                              </ActionButton>
                              <ActionButton
                                type="button"
                                onClick={() => handleUpdatePromiseStatus(promise, 'cancelled')}
                                disabled={updatePromiseStatus.isPending}
                                variant="ghost"
                              >
                                Cancelar
                              </ActionButton>
                            </>
                          ) : (
                            <ActionButton
                              type="button"
                              onClick={() => handleUpdatePromiseStatus(promise, 'pending')}
                              disabled={updatePromiseStatus.isPending}
                              icon={<Clock size={16} />}
                            >
                              Reabrir
                            </ActionButton>
                          )}
                          <ActionButton
                            type="button"
                            onClick={() => handleDownloadPromise(promise)}
                            disabled={downloadPromiseDocument.isPending}
                            icon={<FileText size={16} />}
                          >
                            Descargar
                          </ActionButton>
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
                      {paymentHistoryEntries.map((entry: any) => (
                        <tr key={stableCreditKey('payment-row', entry.id, entry.date, entry.amount, entry.installmentNumber)} className="border-b border-border-subtle hover:bg-hover-bg">
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

          {/* TAB: HISTORY */}
          {activeTab === 'history' && (
            <div className="animate-in fade-in duration-300 max-w-5xl" data-tour="credit-detail-history">
              {isLoadingHistory ? (
                <p className="text-text-secondary">Cargando historial…</p>
              ) : operationalHistoryEntries.length > 0 ? (
                <div className="space-y-3">
                  {operationalHistoryEntries.map((event: any) => {
                    const paymentId = extractPaymentId(event.id);
                    const isPayment = event.type === 'payment';
                    const isAlert = event.type === 'alert';
                    const isPromise = event.type === 'promise';
                    return (
                      <div key={stableCreditKey('history', event.id, event.type, event.date, event.createdAt, event.action)} className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
                        <div className="flex gap-4">
                          <span className={`mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full ${
                            isPayment ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' :
                            isAlert ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' :
                            isPromise ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300'
                        }`}>
                            {isPayment ? <DollarSign size={16} /> : isAlert ? <Bell size={16} /> : isPromise ? <Clock size={16} /> : <CreditCard size={16} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-text-primary">{event.action}</p>
                                  {event.status && (
                                    <span className="inline-flex rounded-full bg-hover-bg px-2.5 py-1 text-xs font-semibold text-text-secondary">
                                      {formatOperationalStatus(event.status)}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-sm leading-6 text-text-secondary whitespace-pre-wrap">{event.description}</p>
                                <p className="mt-2 flex items-center gap-1 text-xs text-text-secondary">
                                  <Clock size={12} /> {formatDate(event.date, true)}
                                </p>
                              </div>
                              {paymentId && (
                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                  <ActionButton
                                    onClick={() => handleDownloadVoucher(paymentId)}
                                    className="!min-h-0 !px-3 !py-1.5"
                                    icon={<FileText size={16} />}
                                  >
                                    Recibo
                                  </ActionButton>
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
                                      <ActionButton
                                        onClick={() => openEditPaymentMethodModal(event)}
                                        disabled={!editGuard.executable}
                                        className="!min-h-0 !px-3 !py-1.5"
                                        icon={<Edit2 size={16} />}
                                        title={editGuard.executable ? 'Editar método de pago' : (editGuard.reason || 'Acción no disponible')}
                                      >
                                        Método
                                      </ActionButton>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
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
        <ModalShell
          title="Cambiar estado"
          footer={(
            <>
              <ActionButton onClick={() => setShowStatusModal(false)} fullWidth>
                Cancelar
              </ActionButton>
              <ActionButton onClick={handleUpdateStatus} disabled={!newStatus} variant="primary" fullWidth>
                Guardar
              </ActionButton>
            </>
          )}
        >
          <FormField label="Nuevo estado">
            <SelectInput
              id="credit-status-select"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <option value="">Seleccione un estado…</option>
              {BACKEND_SUPPORTED_LOAN_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {LOAN_STATUS_LABELS[status]}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </ModalShell>
      )}

      {/* Modal: Record Payment */}
      {isRecordPaymentModalOpen && (
        <ModalShell
          title="Registrar pago"
          footer={(
            <>
              <ActionButton onClick={operationalModal.closeModal} fullWidth>
                Cancelar
              </ActionButton>
              <ActionButton
                onClick={handleRecordPayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || Boolean(installmentQuote && !installmentQuote.canPay)}
                variant="primary"
                fullWidth
              >
                Registrar pago
              </ActionButton>
            </>
          )}
        >
            <div className="space-y-4">
              {selectedInstallmentNumber && (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">Cotización cuota #{selectedInstallmentNumber}</span>
                    {installmentQuoteQuery.isFetching && <span className="text-xs">Calculando…</span>}
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
                        <ActionButton
                          type="button"
                          onClick={() => setPaymentAmount(String(installmentQuote.totalDue ?? ''))}
                          variant="ghost"
                          className="!min-h-0 !border-0 !bg-transparent !p-0 !font-semibold !text-brand-primary hover:!bg-transparent"
                        >
                          {formatCurrency(installmentQuote.totalDue)}
                        </ActionButton>
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
              <FormField label="Monto a pagar">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                  <TextInput
                    id="credit-payment-amount"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="pl-8"
                    placeholder="0.00" min="0" step="0.01"
                  />
                </div>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Fecha">
                  <TextInput
                    id="credit-payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </FormField>
                <FormField label="Método">
                  <SelectInput
                    id="credit-payment-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  >
                    {paymentMethodOptions.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </SelectInput>
                </FormField>
              </div>
            </div>
          </ModalShell>
      )}

      {/* Modal: Promise from installment */}
      {isPromiseModalOpen && (
        <ModalShell
          title="Crear compromiso de pago"
          footer={(
            <>
              <ActionButton onClick={operationalModal.closeModal} fullWidth>
                Cancelar
              </ActionButton>
              <ActionButton onClick={handleCreatePromise} variant="primary" fullWidth>
                Guardar compromiso
              </ActionButton>
            </>
          )}
        >
            <div className="space-y-4">
              <FormField label="Monto prometido">
                <TextInput
                  id="credit-promise-amount"
                  type="number"
                  value={promiseAmount}
                  onChange={(e) => setPromiseAmount(e.target.value)}
                />
              </FormField>
              <FormField label="Fecha comprometida">
                <TextInput
                  id="credit-promise-date"
                  type="date"
                  value={promiseDateInput}
                  onChange={(e) => setPromiseDateInput(e.target.value)}
                />
              </FormField>
              <FormField label="Notas">
                <TextAreaInput
                  id="credit-promise-notes"
                  value={promiseNotes}
                  onChange={(e) => setPromiseNotes(e.target.value)}
                  rows={3}
                />
              </FormField>
            </div>
          </ModalShell>
      )}

      {/* Modal: Follow-up from installment */}
      {isFollowUpModalOpen && (
        <ModalShell
          title="Registrar seguimiento"
          footer={(
            <>
              <ActionButton onClick={operationalModal.closeModal} fullWidth>
                Cancelar
              </ActionButton>
              <ActionButton onClick={handleCreateFollowUp} variant="primary" fullWidth>
                Guardar seguimiento
              </ActionButton>
            </>
          )}
        >
            <div className="space-y-4">
              <FormField label="Detalle">
                <TextAreaInput
                  id="credit-follow-up-notes"
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  rows={4}
                />
              </FormField>
            </div>
          </ModalShell>
      )}

      {/* Modal: Annul Installment */}
      {showAnnulModal && (
        <ModalShell
          title={<span className="text-red-600 dark:text-red-400">Anular cuota #{annulInstallmentNumber}</span>}
          subtitle="Esta acción marcará la cuota como anulada y recalculará el calendario. No se puede deshacer."
          footer={(
            <>
              <ActionButton
                onClick={() => {
                  setShowAnnulModal(false);
                  setAnnulInstallmentNumber(null);
                }}
                fullWidth
              >
                Cancelar
              </ActionButton>
              <ActionButton onClick={handleAnnulInstallment} variant="danger" fullWidth>
                Confirmar anulación
              </ActionButton>
            </>
          )}
        >
          <FormField label="Razón de anulación (opcional)">
            <TextAreaInput
              id="credit-annul-reason"
              value={annulReason}
              onChange={(e) => setAnnulReason(e.target.value)}
              rows={3}
            />
          </FormField>
        </ModalShell>
      )}

      {/* Modal: Capital Contribution */}
      {showCapitalModal && (
        <ModalShell
          title="Abono a capital"
          subtitle="Reduce capital vivo. No paga cuotas futuras; recalcula el cronograma pendiente."
          maxWidthClassName="max-w-2xl"
          footer={(
            <>
              <ActionButton onClick={() => setShowCapitalModal(false)} fullWidth>
                Cancelar
              </ActionButton>
              <ActionButton
                onClick={handleRecordCapital}
                disabled={!capitalPaymentGuard.executable || !capitalAmount || parseFloat(capitalAmount) <= 0}
                title={capitalPaymentGuard.executable ? undefined : capitalPaymentGuard.reason}
                variant="primary"
                fullWidth
              >
                Registrar abono
              </ActionButton>
            </>
          )}
        >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Monto del abono">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                    <TextInput
                      id="credit-capital-amount"
                      type="number"
                      value={capitalAmount}
                      onChange={(e) => setCapitalAmount(e.target.value)}
                      className="pl-8"
                      placeholder="0.00" min="0" step="0.01"
                    />
                  </div>
                </FormField>
                <FormField label="Fecha del abono">
                  <TextInput
                    id="credit-capital-date"
                    type="date"
                    value={capitalPaymentDate}
                    onChange={(e) => setCapitalPaymentDate(e.target.value)}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Método">
                  <SelectInput
                    id="credit-capital-method"
                    value={capitalMethod}
                    onChange={(e) => setCapitalMethod(e.target.value as PaymentMethod)}
                  >
                    {paymentMethodOptions.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Estrategia">
                  <SelectInput
                    id="credit-capital-strategy"
                    value={capitalStrategy}
                    onChange={(e) => setCapitalStrategy(e.target.value as CapitalStrategy)}
                  >
                    {CAPITAL_STRATEGIES.map((strategy) => (
                      <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
                    ))}
                  </SelectInput>
                </FormField>
              </div>
              <div className="rounded-xl border border-border-subtle bg-bg-base/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Previsualización</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-text-secondary">Capital vivo actual</p>
                    <p className="mt-1 font-semibold text-text-primary">{formatCurrency(capitalPreview.currentPrincipal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Capital vivo nuevo</p>
                    <p className="mt-1 font-semibold text-text-primary">{formatCurrency(capitalPreview.newPrincipal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">
                      {capitalStrategy === 'reduce_payment' ? 'Cuota estimada' : 'Cuotas restantes'}
                    </p>
                    <p className="mt-1 font-semibold text-text-primary">
                      {capitalStrategy === 'reduce_payment'
                        ? formatCurrency(capitalPreview.estimatedPayment)
                        : `${capitalPreview.estimatedInstallments} de ${capitalPreview.remainingInstallments}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Efecto esperado</p>
                    <p className="mt-1 font-semibold text-text-primary">
                      {capitalStrategy === 'reduce_payment' ? 'Baja la cuota' : 'Reduce el plazo'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-text-secondary">
                  Para abonar a capital, la primera cuota debe estar pagada. Si hay cuotas vencidas, intereses exigibles o una cuota parcial, primero se debe regularizar esa cuota.
                </p>
                {!capitalPaymentGuard.executable && (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100">
                    {capitalPaymentGuard.reason || capitalUnavailableDescription}
                  </p>
                )}
              </div>
            </div>
          </ModalShell>
      )}

      {showEditPaymentMethodModal && (
        <ModalShell
          title="Editar método de pago"
          footer={(
            <>
              <ActionButton
                onClick={() => {
                  setShowEditPaymentMethodModal(false);
                  setEditingPaymentId(null);
                  setEditingPaymentReconciled(false);
                }}
                fullWidth
              >
                Cancelar
              </ActionButton>
              <ActionButton
                onClick={handleUpdatePaymentMethod}
                disabled={editingPaymentReconciled}
                variant="primary"
                fullWidth
              >
                Guardar
              </ActionButton>
            </>
          )}
        >
            <div className="space-y-4">
              {editingPaymentReconciled && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  El pago está conciliado. No se permite editar su método.
                </div>
              )}
              <FormField label="Nuevo método">
                <SelectInput
                  id="credit-payment-method-select"
                  value={newPaymentMethod}
                  onChange={(event) => setNewPaymentMethod(event.target.value as PaymentMethod)}
                  disabled={editingPaymentReconciled}
                >
                  {paymentMethodOptions.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </SelectInput>
              </FormField>
            </div>
          </ModalShell>
      )}

      {/* Modal: Late Fee Rate */}
      {showLateFeeModal && (
        <ModalShell
          title="Tasa de mora anual"
          footer={(
            <>
              <ActionButton onClick={() => setShowLateFeeModal(false)} fullWidth>
                Cancelar
              </ActionButton>
              <ActionButton onClick={handleUpdateLateFeeRate} variant="primary" fullWidth>
                Guardar
              </ActionButton>
            </>
          )}
        >
          <FormField label="Tasa (%)">
            <div className="relative">
              <TextInput
                id="credit-late-fee-rate"
                type="number"
                value={lateFeeRate}
                onChange={(e) => setLateFeeRate(e.target.value)}
                className="pr-8"
                placeholder="0.00" min="0" max="100" step="0.01"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">%</span>
            </div>
          </FormField>
        </ModalShell>
      )}

    </div>
  );
}
