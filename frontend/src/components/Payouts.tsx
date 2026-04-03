import React, { useState } from 'react';
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
import { requestInput } from '../lib/confirmModal';
import TableShell from './shared/TableShell';
import { getChipClassName } from '../constants/uiChips';

export default function Payouts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSessionStore();
  const { executeGuardedAction } = useOperationalActions(queryClient);
  const { page, setPage, pageSize } = usePaginationStore();
  const { data: paymentsData, isLoading, isError, createPayment, createPartialPayment, createCapitalPayment, updatePaymentMetadata } = usePayments({ page, pageSize });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'regular' | 'partial' | 'capital'>('regular');
  const [formData, setFormData] = useState({
    loanId: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    method: 'cash'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const role = user?.role;
  const permissions = user?.permissions;

  const payments = Array.isArray(paymentsData?.data?.payments)
    ? paymentsData.data.payments
    : Array.isArray(paymentsData?.data)
      ? paymentsData.data
      : [];
  const pagination = paymentsData?.data?.pagination ?? paymentsData?.pagination ?? paymentsData?.meta;

  const formatPaymentDate = (payment: any) => {
    const rawDate = payment?.paymentDate ?? payment?.date ?? payment?.createdAt;
    const parsedDate = rawDate ? new Date(rawDate) : null;

    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      return 'Sin fecha';
    }

    return parsedDate.toLocaleString();
  };

  const formatPaymentMethod = (payment: any) => {
    return payment?.paymentMetadata?.method || payment?.method || payment?.paymentMethod || 'Sin metodo';
  };

  const formatPaymentStatus = (payment: any) => {
    if (payment?.status === 'applied' || payment?.status === 'completed') {
      return 'Aplicado';
    }

    return 'Pendiente';
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
    const reference = await requestInput({
      title: tTerm('prompt.payment.reference.title'),
      message: tTerm('prompt.payment.reference.message'),
      label: tTerm('prompt.payment.reference.label'),
      placeholder: tTerm('prompt.payment.reference.placeholder'),
      defaultValue: payment?.paymentMetadata?.reference || '',
      confirmLabel: tTerm('prompt.payment.reference.confirm'),
      cancelLabel: tTerm('prompt.payment.reference.cancel'),
    });

    if (reference === null) {
      return;
    }

    await executeGuardedAction({
      action: 'payout.metadata.edit',
      context: { role, permissions, paymentStatus: payment?.status },
      run: async () => {
        await updatePaymentMetadata.mutateAsync({
          paymentId: Number(payment.id),
          payload: {
            loanId: payment?.loanId,
            paymentMetadata: {
              ...(payment?.paymentMetadata || {}),
              reference,
            },
          },
        });
      },
      successMessage: tTerm('payouts.toast.edit.success'),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    const payload = {
      loanId: parseInt(formData.loanId),
      paymentAmount: parseFloat(formData.amount),
      paymentDate: new Date(formData.paymentDate).toISOString(),
      paymentMethod: formData.method
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
        setFormData({ loanId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], method: 'cash' });
      },
      successMessage: tTerm('payouts.toast.register.success'),
    });

    if (!wasExecuted) {
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">{tTerm('payouts.module.title')}</h2>
          <p className="text-sm text-text-secondary mt-1">{tTerm('payouts.module.subtitle')}</p>
        </div>
        <button 
          onClick={() => setShowPaymentModal(true)}
          className="flex items-center gap-2 bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> {tTerm('payouts.cta.recordPayment')}
        </button>
      </div>

      <div className="bg-bg-surface rounded-2xl p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input 
              type="text" 
              placeholder="Buscar por ID de préstamo o cliente..." 
              className="bg-bg-base text-sm text-text-primary rounded-lg pl-10 pr-4 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-border-strong border border-border-subtle"
            />
          </div>
        </div>

        <TableShell
          isLoading={isLoading}
          isError={isError}
          hasData={payments.length > 0}
          loadingContent={<div className="py-4 text-center text-text-secondary">Cargando pagos...</div>}
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
          } : undefined}
        >
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="pb-3 font-medium">Recibo ID</th>
                <th className="pb-3 font-medium">Préstamo ID</th>
                <th className="pb-3 font-medium">Fecha</th>
                <th className="pb-3 font-medium">Monto</th>
                <th className="pb-3 font-medium">Método</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {payments.map((payment: any) => (
                <tr key={payment.id} className="hover:bg-hover-bg transition-colors">
                  <td className="py-4 text-text-secondary font-mono">{String(payment.id).substring(0, 8)}</td>
                  <td className="py-4 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-mono">{payment.loanId}</td>
                  <td className="py-4 text-text-secondary">{formatPaymentDate(payment)}</td>
                  <td className="py-4 font-medium">${Number(payment.amount ?? 0).toLocaleString()}</td>
                  <td className="py-4 text-text-secondary capitalize">{formatPaymentMethod(payment)}</td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded text-xs ${formatPaymentStatus(payment) === 'Aplicado' ? getChipClassName('success') : getChipClassName('warning')}`}>
                      {formatPaymentStatus(payment)}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1.5 text-text-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
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
                        });
                        const deleteGuard = resolveOperationalGuard('payout.delete', {
                          role,
                          permissions,
                          paymentStatus: payment?.status,
                        });

                        return (
                          <>
                            <button
                              className="p-1.5 text-text-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={viewGuard.executable ? 'Ver crédito' : (viewGuard.reason || 'Acción no disponible')}
                              onClick={() => handleViewCredit(Number(payment.loanId))}
                              disabled={!viewGuard.executable || !viewGuard.visible}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="p-1.5 text-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={editGuard.executable ? 'Editar metadata del pago' : (editGuard.reason || 'Acción no disponible')}
                              onClick={() => handleEditPayment(payment)}
                              disabled={!editGuard.executable || !editGuard.visible}
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              className="p-1.5 text-text-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={deleteGuard.reason || 'Eliminar'}
                              onClick={() => toast.error({ title: deleteGuard.reason || 'Acción no disponible' })}
                              disabled={!deleteGuard.executable || !deleteGuard.visible}
                            >
                              <Trash2 size={16} />
                            </button>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-2xl w-full max-w-md p-6 border border-border-subtle">
            <h3 className="text-xl font-bold mb-4">{tTerm('payouts.cta.recordPayment')}</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1" title="Regular: cuota completa; Parcial: abono incompleto; Capital: reduce saldo principal">Tipo de Pago</label>
                <select 
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as any)}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2"
                >
                  <option value="regular">Pago Regular (Cuota)</option>
                  <option value="partial">Pago Parcial</option>
                  <option value="capital">Abono a Capital</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">ID del Préstamo</label>
                <input 
                  type="number"
                  required
                  value={formData.loanId}
                  onChange={(e) => setFormData({...formData, loanId: e.target.value})}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2"
                  placeholder="Ej: 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Monto a Pagar</label>
                <input 
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Fecha de Pago</label>
                <input 
                  type="date"
                  required
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Método de Pago</label>
                <select 
                  value={formData.method}
                  onChange={(e) => setFormData({...formData, method: e.target.value})}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2"
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2 border border-border-subtle rounded-lg hover:bg-hover-bg"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
