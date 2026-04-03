import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Bell, Clock, CreditCard, CheckCircle, 
  Edit2, FileText, DollarSign, ShieldAlert, Percent, History, 
  Layers, AlertTriangle, AlertCircle, Info, ChevronRight, Activity
} from 'lucide-react';
import { useLoanById, useLoanDetails, useLoans, PAYMENT_METHODS, CAPITAL_STRATEGIES, type PaymentMethod, type CapitalStrategy } from '../services/loanService';
import { useCreditReports } from '../services/reportService';
import { useUsers } from '../services/userService';
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

export default function CreditDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loanId = Number(id);
  const [activeTab, setActiveTab] = useState<'calendar' | 'alerts' | 'promises' | 'payoff' | 'history'>('calendar');
  const { user } = useSessionStore();
  const { executeGuardedAction } = useOperationalActions(queryClient);
  const operationalModal = useOperationalModalState();

  const { data: loansData, isLoading: isLoadingLoans, updateLoanStatus } = useLoans();
  const { data: loanData, isLoading: isLoadingLoanRecord } = useLoanById(loanId);
  const loans = Array.isArray(loansData?.data?.loans)
    ? loansData.data.loans
    : Array.isArray(loansData?.data)
      ? loansData.data
      : [];
  const loan = loanData?.data?.loan ?? loans.find((l: any) => Number(l?.id) === loanId);

  const { calendar, calendarSnapshot, alerts, promises, payoffQuote, isLoading: isLoadingDetails, createPromise, createFollowUp, executePayoff, recordPayment, annulInstallment, updatePaymentMethod, recordCapitalPayment, updateLateFeeRate } = useLoanDetails(loanId);
  const { history, isLoading: isLoadingHistory } = useCreditReports(loanId);
  const { data: usersData } = useUsers({ pageSize: 100 });
  const users = Array.isArray(usersData?.data?.users)
    ? usersData.data.users
    : Array.isArray(usersData?.data)
      ? usersData.data
      : [];

  const formatDate = (value: unknown, withTime = false) => {
    if (!value) return 'Sin fecha';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return 'Sin fecha';
    return withTime ? date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : date.toLocaleDateString('es-ES', { dateStyle: 'medium' });
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
      case 'completed':
      case 'closed':
        return { label: 'Completado', className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-200 dark:border-slate-500/30' };
      case 'defaulted':
        return { label: 'En mora', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-200 dark:border-red-500/30' };
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

  const historyEntries = useMemo(() => {
    const source = history?.data?.history ?? history;
    const payments = Array.isArray(source?.payments) ? source.payments : [];
    const payoffHistory = Array.isArray(source?.payoffHistory) ? source.payoffHistory : [];

    return [
      ...payments.map((payment: any) => ({
        id: `payment-${payment.id ?? payment.createdAt ?? Math.random()}`,
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
    customerLabel = customerLabel.replace(/(qa|seed|test|dev)\s*/ig, '').trim();
  }
  customerLabel = customerLabel || (loan?.customerId ? `Cliente #${loan.customerId}` : 'Sin cliente');
  const calendarEntries = Array.isArray(calendar) ? calendar : [];
  const alertEntries = Array.isArray(alerts) ? alerts : [];
  const promiseEntries = Array.isArray(promises) ? promises : [];

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  // Modals state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
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
  const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethod>('transfer');

  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [capitalAmount, setCapitalAmount] = useState('');
  const [capitalMethod, setCapitalMethod] = useState<PaymentMethod>('transfer');
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
      },
      run: async () => {
        await updatePaymentMethod.mutateAsync({ paymentId: editingPaymentId, paymentMethod: newPaymentMethod });
      },
      onSuccess: async () => {
        await invalidateAfterPayment(queryClient, { loanId });
        setShowEditPaymentMethodModal(false);
        operationalModal.closeModal();
        setEditingPaymentId(null);
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
        await recordCapitalPayment.mutateAsync({ amount, strategy: capitalStrategy });
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

  const openInstallmentPayment = (row: any) => {
    if (!row?.installmentNumber) {
      toast.error({ title: 'No se pudo identificar la cuota.' });
      return;
    }

    setSelectedInstallmentNumber(row.installmentNumber);
    setPaymentAmount(String(row.scheduledPayment ?? ''));
    operationalModal.openModal('record-payment', {
      loanId,
      installment: {
        installmentId: row.installmentNumber,
        installmentNumber: row.installmentNumber,
        amount: row.scheduledPayment,
        status: row.status,
      },
    });
  };

  const openPromiseFromInstallment = (row: any) => {
    if (!row?.installmentNumber) {
      toast.error({ title: 'No se pudo identificar la cuota para promesa.' });
      return;
    }

    operationalModal.openModal('create-promise', {
      loanId,
      installment: {
        installmentId: row.installmentNumber,
        installmentNumber: row.installmentNumber,
        amount: row.scheduledPayment,
        status: row.status,
      },
    });
    setPromiseAmount(String(row.scheduledPayment ?? ''));
  };

  const openFollowUpFromInstallment = (row: any) => {
    if (!row?.installmentNumber) {
      toast.error({ title: 'No se pudo identificar la cuota para seguimiento.' });
      return;
    }

    operationalModal.openModal('create-follow-up', {
      loanId,
      installment: {
        installmentId: row.installmentNumber,
        installmentNumber: row.installmentNumber,
        amount: row.scheduledPayment,
        status: row.status,
      },
    });
  };

  const isRecordPaymentModalOpen = operationalModal.is('record-payment');
  const isPromiseModalOpen = operationalModal.is('create-promise');
  const isFollowUpModalOpen = operationalModal.is('create-follow-up');

  const extractPaymentId = (eventId: string): number | null => {
    if (eventId.startsWith('payment-')) {
      const id = eventId.replace('payment-', '');
      return Number(id);
    }
    return null;
  };

  const TabButton = ({ id, icon: Icon, label, badge }: { id: typeof activeTab, icon: any, label: string, badge?: number }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`relative flex items-center gap-2 px-5 py-4 text-sm font-medium transition-all duration-200 whitespace-nowrap outline-none ${
        activeTab === id 
          ? 'text-brand-primary' 
          : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg/50 rounded-t-xl'
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
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in duration-300">
      
      {/* Top Section: Header & Summary in a single clean card */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-6 md:p-8 border-b border-border-subtle">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <button 
                onClick={() => navigate('/credits')}
                className="p-2 mt-0.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-lg transition-colors group"
              >
                <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-text-primary tracking-tight leading-none">Crédito #{loan.id}</h1>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${statusInfo.className}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <p className="text-sm text-text-secondary flex items-center gap-1.5">
                  <FileText size={14} className="opacity-70" />
                  Cliente: <span className="font-medium text-text-primary">{customerLabel}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {user?.role !== 'customer' && (
                <>
                  <button
                    onClick={() => operationalModal.openModal('record-payment', { loanId })}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary/90 hover:shadow-md transition-all"
                  >
                    <DollarSign size={16} /> {tTerm('creditDetails.cta.recordPayment')}
                  </button>
                  <button
                    onClick={() => setShowCapitalModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-bg-base border border-border-strong text-text-primary rounded-xl text-sm font-medium hover:bg-hover-bg transition-colors shadow-sm"
                  >
                    <Layers size={16} /> {tTerm('creditDetails.cta.capitalContribution')}
                  </button>
                  <button
                    onClick={() => {
                      setLateFeeRate(String(loan.annualLateFeeRate || ''));
                      setShowLateFeeModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-bg-base border border-border-strong text-text-primary rounded-xl text-sm font-medium hover:bg-hover-bg transition-colors shadow-sm"
                  >
                    <Percent size={16} /> {tTerm('creditDetails.cta.lateFeeRate')}
                  </button>
                </>
              )}
              <button 
                onClick={() => setShowStatusModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-bg-base border border-border-strong text-text-primary rounded-xl text-sm font-medium hover:bg-hover-bg transition-colors shadow-sm"
                title="Cambiar estado del crédito"
              >
                <Edit2 size={16} /> Estado
              </button>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-bg-base/50 p-6 md:px-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide truncate">Cuotas Totales</p>
            <p className="text-xl font-bold text-text-primary truncate">{loan.termMonths ?? '—'}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide truncate">Cuotas a Pagar</p>
            <p className="text-xl font-bold text-text-primary truncate">{loan.paymentContext?.snapshot?.outstandingInstallments ?? '—'}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide truncate">Interés Total</p>
            <p className="text-xl font-bold text-text-primary truncate" title={formatCurrency(loan.paymentContext?.snapshot?.totalInterest)}>{formatCurrency(loan.paymentContext?.snapshot?.totalInterest)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide truncate">Capital Amortizado</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate" title={formatCurrency(loan.paymentContext?.snapshot?.totalPaidPrincipal)}>{formatCurrency(loan.paymentContext?.snapshot?.totalPaidPrincipal)}</p>
          </div>
          <div className="lg:border-l border-border-strong lg:pl-6 min-w-0 md:col-span-2 lg:col-span-1">
            <p className="text-xs font-bold text-brand-primary mb-1.5 uppercase tracking-wide flex items-center gap-1 truncate">
              <Activity size={12} className="shrink-0" /> Capital Vivo
            </p>
            <p className="text-2xl font-black text-brand-primary tracking-tight leading-none truncate" title={formatCurrency(loan.paymentContext?.snapshot?.outstandingPrincipal)}>{formatCurrency(loan.paymentContext?.snapshot?.outstandingPrincipal)}</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border-subtle overflow-x-auto hide-scrollbar">
          <TabButton id="calendar" icon={Calendar} label={tTerm('creditDetails.tab.calendar')} />
          <TabButton id="alerts" icon={Bell} label={tTerm('creditDetails.tab.alerts')} badge={alertEntries.length} />
          <TabButton id="promises" icon={Clock} label={tTerm('creditDetails.tab.promises')} badge={promiseEntries.filter((p:any)=>p.status==='pending').length} />
          <TabButton id="payoff" icon={CreditCard} label={tTerm('creditDetails.tab.payoff')} />
          <TabButton id="history" icon={Activity} label={tTerm('creditDetails.tab.history')} />
        </div>

        <div className="pt-2">
          {/* TAB: CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {calendarEntries.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="text-xs text-text-secondary uppercase bg-hover-bg/50 border-b border-border-subtle">
                        <tr>
                          <th className="py-4 px-6 font-semibold text-center w-16">N°</th>
                          <th className="py-4 px-6 font-semibold text-right">Cuota a Pagar</th>
                          <th className="py-4 px-6 font-semibold text-right">Interés</th>
                          <th className="py-4 px-6 font-semibold text-right">Amortización</th>
                          <th className="py-4 px-6 font-semibold text-right">Capital Vivo</th>
                          <th className="py-4 px-6 font-semibold text-center w-32">Estado</th>
                          {user?.role !== 'customer' && <th className="py-4 px-6 font-semibold text-center w-16"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {/* Initial balance row */}
                        <tr className="bg-bg-base/30">
                          <td className="py-3 px-6 text-center text-text-secondary font-medium">0</td>
                          <td className="py-3 px-6 text-right text-text-secondary">—</td>
                          <td className="py-3 px-6 text-right text-text-secondary">—</td>
                          <td className="py-3 px-6 text-right text-text-secondary">—</td>
                          <td className="py-3 px-6 text-right font-bold text-text-primary">
                            {formatCurrency(loan.amount)}
                          </td>
                          <td className="py-3 px-6"></td>
                          {user?.role !== 'customer' && <td></td>}
                        </tr>
                      {calendarEntries.reduce((rows: any[], installment: any, index: number) => {
                        const scheduledPayment = installment.scheduledPayment ?? 0;
                        const interestComponent = installment.remainingInterest ?? 0;
                        const principalComponent = scheduledPayment - interestComponent;
                        const openingBalance = index === 0 ? Number(loan.amount) : rows[index - 1].closingBalance;
                        const closingBalance = Math.max(0, openingBalance - principalComponent);
                        
                        rows.push({
                          installmentNumber: installment.installmentNumber,
                          scheduledPayment, interestComponent, principalComponent, openingBalance, closingBalance,
                          status: installment.status,
                        });
                        return rows;
                      }, []).map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-hover-bg/50 transition-colors group">
                          <td className="py-3 px-5 text-center font-medium text-text-secondary">{row.installmentNumber}</td>
                          <td className="py-3 px-5 text-right font-medium text-text-primary">
                            {formatCurrency(row.scheduledPayment)}
                          </td>
                          <td className="py-3 px-5 text-right text-text-secondary">
                            {formatCurrency(row.interestComponent)}
                          </td>
                          <td className="py-3 px-5 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatCurrency(row.principalComponent)}
                          </td>
                          <td className="py-3 px-5 text-right font-medium text-text-primary">
                            {formatCurrency(row.closingBalance)}
                          </td>
                          <td className="py-3 px-5 text-center">
                            <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium w-full ${
                              row.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
                              row.status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' :
                              row.status === 'partial' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' :
                              row.status === 'annulled' ? 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}>
                              {row.status === 'paid' ? 'Pagada' : row.status === 'overdue' ? 'Vencida' : row.status === 'partial' ? 'Parcial' : row.status === 'annulled' ? 'Anulada' : 'Pendiente'}
                            </span>
                          </td>
                          {user?.role !== 'customer' && (
                            <td className="py-3 px-5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {(row.status === 'pending' || row.status === 'overdue') && (
                                  <>
                                    <button
                                      onClick={() => openInstallmentPayment(row)}
                                      className="p-1.5 text-text-secondary hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                                      title="Registrar pago de cuota"
                                    >
                                      <DollarSign size={16} />
                                    </button>
                                    <button
                                      onClick={() => openPromiseFromInstallment(row)}
                                      className="p-1.5 text-text-secondary hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                                      title="Crear compromiso de pago"
                                    >
                                      <Clock size={16} />
                                    </button>
                                    <button
                                      onClick={() => openFollowUpFromInstallment(row)}
                                      className="p-1.5 text-text-secondary hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                                      title="Crear seguimiento"
                                    >
                                      <Bell size={16} />
                                    </button>
                                    <button
                                      onClick={() => openAnnulModal(row.installmentNumber)}
                                      className="p-1.5 text-text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                      title="Anular cuota"
                                    >
                                      <ShieldAlert size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    {calendarSnapshot && (
                      <tfoot className="bg-bg-base border-t border-border-strong">
                        <tr>
                          <td colSpan={4} className="py-4 px-5 text-right text-text-secondary">Balance pendiente total:</td>
                          <td className="py-4 px-5 text-right font-bold text-brand-primary text-base">
                            {formatCurrency(calendarSnapshot.outstandingBalance)}
                          </td>
                          <td colSpan={user?.role !== 'customer' ? 2 : 1}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="mx-auto h-12 w-12 text-border-strong mb-3" />
                  <p className="text-text-secondary">No hay cuotas programadas para este crédito.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: ALERTS */}
          {activeTab === 'alerts' && (
            <div className="animate-in fade-in duration-300 max-w-3xl">
              {alertEntries.length > 0 ? (
                <div className="space-y-4">
                  {alertEntries.map((alert: any, index: number) => (
                    <div key={index} className="flex gap-4 pb-4 border-b border-border-subtle last:border-0">
                      <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                      <div>
                        <p className="font-medium text-text-primary">{alert.type || alert.alertType}</p>
                        <p className="text-sm text-text-secondary mt-1">
                          {alert.message || `Cuota ${alert.installmentNumber} con saldo ${formatCurrency(alert.outstandingAmount)}`}
                        </p>
                        <p className="text-xs text-text-secondary mt-2">{formatDate(alert.createdAt, true)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="mx-auto h-12 w-12 text-border-strong mb-3" />
                  <p className="text-text-secondary">No hay alertas activas para este crédito.</p>
                </div>
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
                      <div key={index} className="p-5 border border-border-subtle rounded-xl bg-bg-surface">
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
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="mx-auto h-12 w-12 text-border-strong mb-3" />
                  <p className="text-text-secondary">No hay compromisos de pago registrados.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: PAYOFF */}
          {activeTab === 'payoff' && (
            <div className="animate-in fade-in duration-300">
              {payoffQuote ? (
                <div className="max-w-md border border-border-subtle rounded-xl p-6 bg-bg-surface">
                  <h3 className="text-lg font-medium text-text-primary mb-1">Cotización de pago total</h3>
                  <p className="text-sm text-text-secondary mb-6">Válida al {formatDate(payoffQuote.asOfDate)}</p>
                    
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Capital restante:</span>
                      <span className="text-text-primary">{formatCurrency(payoffQuote.outstandingPrincipal ?? payoffQuote.principalBalance)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Intereses a la fecha:</span>
                      <span className="text-text-primary">{formatCurrency(payoffQuote.accruedInterest ?? 0)}</span>
                    </div>
                    {Number(payoffQuote.lateFees) > 0 && (
                      <div className="flex justify-between text-sm text-amber-600">
                        <span>Cargos por mora:</span>
                        <span>{formatCurrency(payoffQuote.lateFees)}</span>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t border-border-subtle flex justify-between items-end">
                      <span className="font-medium text-text-primary">Total a Pagar</span>
                      <span className="text-2xl font-bold text-brand-primary">{formatCurrency(payoffQuote.total ?? payoffQuote.totalPayoffAmount)}</span>
                    </div>
                  </div>

                  <button 
                    onClick={handlePayoff}
                    disabled={user?.role !== 'customer'}
                    className={`w-full py-3 rounded-lg font-medium transition-colors ${
                      user?.role === 'customer' 
                        ? 'bg-text-primary text-bg-base hover:bg-text-secondary' 
                        : 'bg-bg-base border border-border-subtle text-text-secondary cursor-not-allowed'
                    }`}
                  >
                    {user?.role === 'customer' ? 'Confirmar pago total' : 'Acción reservada para clientes'}
                  </button>
                </div>
              ) : (
                 <div className="text-center py-12">
                  <Info className="mx-auto h-12 w-12 text-border-strong mb-3" />
                  <p className="text-text-secondary">No se pudo generar la cotización de pago total.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: HISTORY */}
          {activeTab === 'history' && (
            <div className="animate-in fade-in duration-300 max-w-3xl">
              {isLoadingHistory ? (
                <p className="text-text-secondary">Cargando historial...</p>
              ) : historyEntries.length > 0 ? (
                <div className="space-y-6">
                  {historyEntries.map((event: any, index: number) => {
                    const paymentId = extractPaymentId(event.id);
                    const isPayment = event.type === 'payment';
                    return (
                      <div key={event.id || index} className="flex gap-4">
                        <div className={`mt-1 p-2 rounded-full h-fit ${isPayment ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                          {isPayment ? <DollarSign size={16} /> : <CreditCard size={16} />}
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
                              <button
                                onClick={() => handleDownloadVoucher(paymentId)}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-lg transition-colors border border-border-subtle"
                              >
                                <FileText size={16} /> Recibo
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Activity className="mx-auto h-12 w-12 text-border-strong mb-3" />
                  <p className="text-text-secondary">Aún no hay transacciones registradas.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
                  Pago aplicado a cuota #{selectedInstallmentNumber}
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
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 bg-bg-base border-t border-border-subtle flex gap-3">
              <button onClick={operationalModal.closeModal} className="flex-1 py-2 text-sm text-text-secondary hover:bg-hover-bg rounded-lg">Cancelar</button>
              <button onClick={handleRecordPayment} disabled={!paymentAmount || parseFloat(paymentAmount) <= 0} className="flex-1 py-2 text-sm bg-text-primary text-bg-base rounded-lg disabled:opacity-50">Registrar Pago</button>
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
                    {PAYMENT_METHODS.map((method) => (
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
