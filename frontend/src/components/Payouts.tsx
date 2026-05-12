import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, FileText } from 'lucide-react';
import { usePayments, downloadVoucher } from '../services/paymentService';
import { usePaginationStore } from '../store/paginationStore';
import { toast } from '../lib/toast';
import { useSessionStore } from '../store/sessionStore';
import { useQueryClient } from '@tanstack/react-query';
import { useOperationalActions } from './hooks/useOperationalActions';
import { resolveOperationalGuard } from '../services/operationalGuards';
import { useNavigate } from 'react-router-dom';
import { tTerm } from '../i18n/terminology';
import TableShell from './shared/TableShell';
import { getChipClassName } from '../constants/uiChips';
import { CAPITAL_STRATEGIES, PAYMENT_METHODS as FALLBACK_PAYMENT_METHODS, type CapitalStrategy, type PaymentMethod } from '../services/loanService';
import { useConfig } from '../services/configService';
import {
  ActionButton,
  FormField,
  ModalShell,
  PageHeader,
  PageShell,
  SelectInput,
  TextInput,
  ToolbarSurface,
} from './shared/Surfaces';
import { HelpLabel } from './shared/HelpSupport';

export default function Payouts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSessionStore();
  const { executeGuardedAction } = useOperationalActions(queryClient);
  const { paymentMethods: configuredPaymentMethods } = useConfig();
  const { page, setPage, pageSize, setPageSize } = usePaginationStore();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = deferredSearchQuery.trim();
  const previousNormalizedSearchQuery = useRef(normalizedSearchQuery);
  const { data: paymentsData, isLoading, isError, createPayment, createPartialPayment, createCapitalPayment, updatePaymentMetadata } = usePayments({
    page,
    pageSize,
    search: normalizedSearchQuery || undefined,
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'regular' | 'partial' | 'capital'>('regular');
  const [capitalStrategy, setCapitalStrategy] = useState<CapitalStrategy>('reduce_term');
  const [formData, setFormData] = useState({
    loanId: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [showEditMethodModal, setShowEditMethodModal] = useState(false);
  const [editedMethod, setEditedMethod] = useState<PaymentMethod>('transfer');
  const [editedReference, setEditedReference] = useState('');
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<number[]>([]);
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

  const role = user?.role;
  const permissions = user?.permissions;

  const payoutTypeOptions = useMemo(() => {
    const options = [
      { value: 'regular' as const, label: 'Pago regular (cuota)', description: 'Pago de cuota para clientes autenticados.' },
      { value: 'partial' as const, label: 'Pago parcial', description: 'Abono administrativo que regulariza saldos pendientes.' },
      { value: 'capital' as const, label: 'Abono a capital', description: 'Reduce capital vivo y recalcula el cronograma.' },
    ];

    return options
      .map((option) => ({
        ...option,
        guard: resolveOperationalGuard('payout.register', { role, permissions, payoutType: option.value }),
      }))
      .filter((option) => option.guard.visible);
  }, [permissions, role]);

  const selectedPayoutTypeGuard = useMemo(
    () => resolveOperationalGuard('payout.register', { role, permissions, payoutType: paymentType }),
    [permissions, paymentType, role],
  );
  const firstExecutablePayoutType = payoutTypeOptions.find((option) => option.guard.executable);
  const canOpenPaymentModal = Boolean(firstExecutablePayoutType);

  const payments = Array.isArray(paymentsData?.data?.payments)
    ? paymentsData.data.payments
    : Array.isArray(paymentsData?.data)
      ? paymentsData.data
      : [];
  const pagination = paymentsData?.data?.pagination ?? paymentsData?.pagination ?? paymentsData?.meta;

  useEffect(() => {
    if (previousNormalizedSearchQuery.current === normalizedSearchQuery) {
      return;
    }

    previousNormalizedSearchQuery.current = normalizedSearchQuery;
    setPage(1);
  }, [normalizedSearchQuery, setPage]);

  useEffect(() => {
    const currentOption = payoutTypeOptions.find((option) => option.value === paymentType && option.guard.executable);

    if (!currentOption && firstExecutablePayoutType) {
      setPaymentType(firstExecutablePayoutType.value);
    }
  }, [firstExecutablePayoutType, paymentType, payoutTypeOptions]);

  useEffect(() => {
    const configuredMethod = paymentMethodOptions.some((method) => method.value === formData.paymentMethod);

    if (!configuredMethod) {
      setFormData((current) => ({ ...current, paymentMethod: defaultPaymentMethod }));
    }
  }, [defaultPaymentMethod, formData.paymentMethod, paymentMethodOptions]);

  useEffect(() => {
    const visiblePaymentIds = new Set(
      payments
        .map((payment: any) => Number(payment?.id))
        .filter((paymentId: number): paymentId is number => Number.isFinite(paymentId)),
    );

    setSelectedPaymentIds((current) => {
      const nextSelection = current.filter((paymentId) => visiblePaymentIds.has(paymentId));
      const didSelectionChange = nextSelection.length !== current.length
        || nextSelection.some((paymentId, index) => paymentId !== current[index]);

      return didSelectionChange ? nextSelection : current;
    });
  }, [payments]);

  const selectedPayments = useMemo(
    () => payments.filter((payment: any) => selectedPaymentIds.includes(Number(payment.id))),
    [payments, selectedPaymentIds],
  );

  const allVisibleSelected = payments.length > 0 && selectedPayments.length === payments.length;

  const formatPaymentDate = (payment: any) => {
    const rawDate = payment?.paymentDate ?? payment?.date ?? payment?.createdAt;
    const parsedDate = rawDate ? new Date(rawDate) : null;

    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      return 'Sin fecha';
    }

    return parsedDate.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const formatPaymentMethod = (payment: any) => {
    const rawMethod = String(
      payment?.paymentMethod
      || '',
    ).trim().toLowerCase();

    if (!rawMethod) {
      return 'Sin método';
    }

    const matchingMethod = paymentMethodOptions.find((method) => method.value === rawMethod);
    return matchingMethod?.label || rawMethod;
  };

  const getPaymentStatusPresentation = (payment: any) => {
    const normalizedStatus = String(payment?.status || '').toLowerCase();

    if (normalizedStatus === 'applied' || normalizedStatus === 'completed') {
      return { label: 'Aplicado', tone: 'success' as const };
    }

    if (normalizedStatus === 'annulled') {
      return { label: 'Anulado', tone: 'neutral' as const };
    }

    if (normalizedStatus === 'failed') {
      return { label: 'Fallido', tone: 'danger' as const };
    }

    return { label: 'Pendiente', tone: 'warning' as const };
  };

  const handleDownloadVoucher = async (paymentId: number) => {
    await executeGuardedAction({
      action: 'payout.voucher.download',
      context: { role, permissions },
      run: async () => {
        await downloadVoucher(paymentId);
      },
      successMessage: tTerm('payouts.toast.voucher.success'),
    });
  };

  const handleViewCredit = async (loanId?: number) => {
    if (!loanId) {
      toast.error({ title: tTerm('payouts.toast.loanNotFound') });
      return;
    }

    await executeGuardedAction({
      action: 'payout.credit.view',
      context: { role, permissions },
      run: async () => {
        navigate(`/credits/${loanId}`);
      },
    });
  };

  const handleEditPayment = async (payment: any) => {
    const editGuard = resolveOperationalGuard('payout.metadata.edit', {
      role,
      permissions,
      paymentStatus: payment?.status,
      paymentReconciled: Boolean(payment?.reconciled || payment?.isReconciled || payment?.paymentMetadata?.reconciled),
    });

    if (!editGuard.executable) {
      toast.error({ title: editGuard.reason || 'Acción no disponible' });
      return;
    }

    const normalizedMethod = String(payment?.paymentMethod || defaultPaymentMethod).toLowerCase();
    const hasMethod = paymentMethodOptions.some((method) => method.value === normalizedMethod);
    setEditedMethod((hasMethod ? normalizedMethod : defaultPaymentMethod) as PaymentMethod);
    setEditedReference(payment?.paymentMetadata?.reference || '');
    setEditingPayment(payment);
    setShowEditMethodModal(true);
  };

  const handleSavePaymentMethod = async () => {
    if (!editingPayment) return;

    await executeGuardedAction({
      action: 'payout.metadata.edit',
      context: {
        role,
        permissions,
        paymentStatus: editingPayment?.status,
        paymentReconciled: Boolean(editingPayment?.reconciled || editingPayment?.isReconciled || editingPayment?.paymentMetadata?.reconciled),
      },
      confirmationMessage: '¿Confirmar cambio de método de pago?',
      run: async () => {
        await updatePaymentMetadata.mutateAsync({
          paymentId: Number(editingPayment.id),
          payload: {
            loanId: editingPayment?.loanId,
            paymentMethod: editedMethod,
            paymentMetadata: {
              ...(editingPayment?.paymentMetadata || {}),
              reference: editedReference,
            },
          },
        });
      },
      onSuccess: () => {
        setShowEditMethodModal(false);
        setEditingPayment(null);
      },
      successMessage: 'Método de pago actualizado',
    });
  };

  const handleToggleSelection = (paymentId: number, checked: boolean) => {
    setSelectedPaymentIds((previous) => {
      if (checked) {
        if (previous.includes(paymentId)) return previous;
        return [...previous, paymentId];
      }
      return previous.filter((id) => id !== paymentId);
    });
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedPaymentIds([]);
      return;
    }

    setSelectedPaymentIds(payments.map((payment: any) => Number(payment.id)).filter((value: number) => Number.isFinite(value)));
  };

  const handleBulkDownloadVouchers = async () => {
    if (selectedPayments.length === 0) {
      toast.error({ title: 'Seleccione al menos un pago para descargar comprobantes.' });
      return;
    }

    await executeGuardedAction({
      action: 'payout.voucher.download',
      context: { role, permissions },
      run: async () => {
        await Promise.all(
          selectedPayments.map((payment: any) => downloadVoucher(Number(payment.id))),
        );
      },
      successMessage: `${selectedPayments.length} comprobante(s) descargado(s)`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const loanId = parseInt(formData.loanId, 10);
    const amount = parseFloat(formData.amount);

    if (!Number.isInteger(loanId) || loanId <= 0) {
      toast.error({ title: 'Ingrese un ID de crédito válido.' });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error({ title: 'Ingrese un monto válido.' });
      return;
    }

    setIsSubmitting(true);

    const payload = {
      loanId,
      amount,
      paymentDate: new Date(formData.paymentDate).toISOString(),
      paymentMethod: formData.paymentMethod,
      ...(paymentType === 'capital' ? { strategy: capitalStrategy } : {}),
    };

    const wasExecuted = await executeGuardedAction({
      action: 'payout.register',
      context: { role, permissions, payoutType: paymentType },
      run: async () => {
        if (paymentType === 'regular') {
          await createPayment.mutateAsync(payload);
        } else if (paymentType === 'partial') {
          await createPartialPayment.mutateAsync(payload);
        } else if (paymentType === 'capital') {
          await createCapitalPayment.mutateAsync(payload);
        }
      },
      onSuccess: () => {
        setShowPaymentModal(false);
        setFormData({ loanId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentMethod: defaultPaymentMethod });
      },
      successMessage: tTerm('payouts.toast.register.success'),
    });

    if (!wasExecuted) {
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  const openPaymentModal = () => {
    if (!firstExecutablePayoutType) {
      toast.error({ title: selectedPayoutTypeGuard.reason || 'Acción no disponible para este usuario.' });
      return;
    }

    if (paymentType !== firstExecutablePayoutType.value && !selectedPayoutTypeGuard.executable) {
      setPaymentType(firstExecutablePayoutType.value);
    }

    setFormData((current) => ({ ...current, paymentMethod: defaultPaymentMethod }));
    setShowPaymentModal(true);
  };

  return (
    <PageShell className="h-full" data-tour="payouts-page">
      <PageHeader
        title={tTerm('payouts.module.title')}
        subtitle={tTerm('payouts.module.subtitle')}
        guideKey="payouts"
        tourId="payouts-header"
        actions={(
        <ActionButton
          onClick={openPaymentModal}
          disabled={!canOpenPaymentModal}
          title={canOpenPaymentModal ? 'Registrar pago' : (selectedPayoutTypeGuard.reason || 'Acción no disponible')}
          variant="primary"
          icon={<Plus size={16} />}
        >
          {tTerm('payouts.cta.recordPayment')}
        </ActionButton>
        )}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {selectedPayments.length > 0 && (
          <ToolbarSurface>
            <p className="text-sm text-text-secondary">
              {selectedPayments.length} pago(s) seleccionado(s)
            </p>
            <div className="flex items-center gap-2">
              <ActionButton
                type="button"
                onClick={handleBulkDownloadVouchers}
                variant="primary"
              >
                Descargar comprobantes
              </ActionButton>
              <ActionButton
                type="button"
                onClick={() => setSelectedPaymentIds([])}
                variant="ghost"
              >
                Limpiar selección
              </ActionButton>
            </div>
          </ToolbarSurface>
        )}

        <ToolbarSurface data-tour="payouts-search">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <TextInput
              type="text" 
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por ID de crédito o cliente…"
              className="pl-10"
            />
          </div>
        </ToolbarSurface>

        <TableShell
          data-tour="payouts-table"
          isLoading={isLoading}
          isError={isError}
          hasData={payments.length > 0}
          loadingContent={<div className="py-4 text-center text-text-secondary">Cargando pagos…</div>}
          errorContent={<div className="py-4 text-center text-red-500">Error al cargar pagos.</div>}
          emptyContent={<div className="py-4 text-center text-text-secondary">No hay pagos registrados.</div>}
          recordsLabel="pagos"
          pagination={pagination ? {
            page,
            pageSize,
            totalItems: pagination?.totalItems ?? pagination?.total ?? 0,
            totalPages: pagination?.totalPages ?? 1,
            onPrev: () => setPage(page - 1),
            onNext: () => setPage(page + 1),
            onPageSizeChange: (nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            },
          } : undefined}
          className="data-table-surface"
        >
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="pb-3 font-medium w-10">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos los pagos"
                    checked={allVisibleSelected}
                    onChange={(event) => handleToggleSelectAll(event.target.checked)}
                    className="rounded border-border-subtle"
                  />
                </th>
                <th className="pb-3 font-medium">Recibo ID</th>
                <th className="pb-3 font-medium">Crédito ID</th>
                <th className="pb-3 font-medium">Fecha</th>
                <th className="pb-3 font-medium">Monto</th>
                <th className="pb-3 font-medium">
                  <HelpLabel label="Método" text="Forma con la que se registró el pago: efectivo, transferencia u otro método disponible." />
                </th>
                <th className="pb-3 font-medium">
                  <HelpLabel label="Estado" text="Estado operativo del pago. Confirma si ya fue aplicado, sigue pendiente o fue anulado." />
                </th>
                <th className="pb-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {payments.map((payment: any) => (
                <tr key={payment.id} className="hover:bg-hover-bg transition-colors">
                  <td className="py-4">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar pago ${payment.id}`}
                      checked={selectedPaymentIds.includes(Number(payment.id))}
                      onChange={(event) => handleToggleSelection(Number(payment.id), event.target.checked)}
                      className="rounded border-border-subtle"
                    />
                  </td>
                  <td className="py-4 text-text-secondary font-mono">{String(payment.id).substring(0, 8)}</td>
                  <td className="cursor-pointer py-4 font-mono text-brand-primary hover:underline">{payment.loanId}</td>
                  <td className="py-4 text-text-secondary">{formatPaymentDate(payment)}</td>
                  <td className="py-4 font-medium">${Number(payment.amount ?? 0).toLocaleString()}</td>
                  <td className="py-4 text-text-secondary capitalize">{formatPaymentMethod(payment)}</td>
                  <td className="py-4">
                    {(() => {
                      const status = getPaymentStatusPresentation(payment);
                      return (
                        <span className={`px-2 py-1 rounded text-xs ${getChipClassName(status.tone)}`}>
                          {status.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-hover-bg hover:text-brand-primary"
                        title="Descargar Comprobante"
                        onClick={() => handleDownloadVoucher(payment.id)}
                      >
                        <FileText size={16} />
                      </button>
                      {(() => {
                        const viewGuard = resolveOperationalGuard('payout.credit.view', { role, permissions });
                        const editGuard = resolveOperationalGuard('payout.metadata.edit', {
                          role,
                          permissions,
                          paymentStatus: payment?.status,
                          paymentReconciled: Boolean(payment?.reconciled || payment?.isReconciled || payment?.paymentMetadata?.reconciled),
                        });
                        const deleteGuard = resolveOperationalGuard('payout.delete', {
                          role,
                          permissions,
                          paymentStatus: payment?.status,
                        });

                        return (
                          <>
                            {viewGuard.visible && (
                              <button
                                className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-hover-bg hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-40"
                                title={viewGuard.executable ? 'Ver crédito' : (viewGuard.reason || 'Acción no disponible')}
                                onClick={() => handleViewCredit(Number(payment.loanId))}
                                disabled={!viewGuard.executable}
                              >
                                <Eye size={16} />
                              </button>
                            )}
                            {editGuard.visible && (
                              <button
                                className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-hover-bg hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-40"
                                title={editGuard.executable ? 'Editar método de pago real' : (editGuard.reason || 'Acción no disponible')}
                                onClick={() => handleEditPayment(payment)}
                                disabled={!editGuard.executable}
                              >
                                <Edit size={16} />
                              </button>
                            )}
                            {deleteGuard.visible && (
                              <button
                                className="p-1.5 text-text-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title={deleteGuard.reason || 'Eliminar'}
                                onClick={() => toast.error({ title: deleteGuard.reason || 'Acción no disponible' })}
                                disabled={!deleteGuard.executable}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </div>

      {showPaymentModal && (
        <ModalShell title={tTerm('payouts.cta.recordPayment')}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                label="Tipo de pago"
                tooltip="Regular: cuota completa; Parcial: abono incompleto; Capital: reduce saldo principal."
                helper={payoutTypeOptions.find((option) => option.value === paymentType)?.description || selectedPayoutTypeGuard.reason}
              >
                <SelectInput
                  id="payout-type"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as any)}
                >
                  {payoutTypeOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={!option.guard.executable}>
                      {option.label}
                    </option>
                  ))}
                </SelectInput>
              </FormField>

              <FormField label="ID del crédito">
                <TextInput
                  id="payout-loan-id"
                  type="number"
                  required
                  value={formData.loanId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, loanId: e.target.value }))}
                  placeholder="Ej: 1"
                />
              </FormField>

              <FormField label="Monto a pagar">
                <TextInput
                  id="payout-amount"
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="Fecha de pago">
                <TextInput
                  id="payout-date"
                  type="date"
                  required
                  value={formData.paymentDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, paymentDate: e.target.value }))}
                />
              </FormField>

              <FormField label="Método de pago">
                <SelectInput
                  id="payout-method"
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                >
                  {paymentMethodOptions.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </SelectInput>
              </FormField>

              {paymentType === 'capital' && (
                <FormField label="Estrategia de abono">
                  <SelectInput
                    id="payout-capital-strategy"
                    value={capitalStrategy}
                    onChange={(event) => setCapitalStrategy(event.target.value as CapitalStrategy)}
                  >
                    {CAPITAL_STRATEGIES.map((strategy) => (
                      <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
                    ))}
                  </SelectInput>
                </FormField>
              )}

              <div className="flex gap-3 pt-4">
                <ActionButton
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  variant="secondary"
                  fullWidth
                >
                  Cancelar
                </ActionButton>
                <ActionButton
                  type="submit"
                  disabled={isSubmitting}
                  variant="primary"
                  fullWidth
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar Pago'}
                </ActionButton>
              </div>
            </form>
        </ModalShell>
      )}

      {showEditMethodModal && editingPayment && (
        <ModalShell title="Editar método de pago" subtitle={`Pago #${editingPayment.id}`}>
            {Boolean(editingPayment?.reconciled || editingPayment?.isReconciled || editingPayment?.paymentMetadata?.reconciled) && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                El pago está conciliado y no puede modificarse.
              </div>
            )}
            <div className="space-y-4">
              <FormField label="Método de pago">
                <SelectInput
                  id="edit-payment-method"
                  value={editedMethod}
                  onChange={(event) => setEditedMethod(event.target.value as PaymentMethod)}
                  disabled={Boolean(editingPayment?.reconciled || editingPayment?.isReconciled || editingPayment?.paymentMetadata?.reconciled)}
                >
                  {paymentMethodOptions.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Referencia de conciliación (opcional)">
                <TextInput
                  id="edit-payment-reference"
                  value={editedReference}
                  onChange={(event) => setEditedReference(event.target.value)}
                  placeholder="Ej: REF-123"
                  disabled={Boolean(editingPayment?.reconciled || editingPayment?.isReconciled || editingPayment?.paymentMetadata?.reconciled)}
                />
              </FormField>
            </div>
            <div className="flex gap-3 pt-4">
              <ActionButton
                type="button"
                onClick={() => {
                  setShowEditMethodModal(false);
                  setEditingPayment(null);
                }}
                variant="secondary"
                fullWidth
              >
                Cancelar
              </ActionButton>
              <ActionButton
                type="button"
                onClick={handleSavePaymentMethod}
                disabled={Boolean(editingPayment?.reconciled || editingPayment?.isReconciled || editingPayment?.paymentMetadata?.reconciled)}
                variant="primary"
                fullWidth
              >
                Guardar cambios
              </ActionButton>
            </div>
        </ModalShell>
      )}
    </PageShell>
  );
}
