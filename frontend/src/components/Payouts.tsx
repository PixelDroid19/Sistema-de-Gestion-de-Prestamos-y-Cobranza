import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Eye, Edit, Trash2, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { usePayments, downloadVoucher } from '../services/paymentService';
import { usePaginationStore } from '../store/paginationStore';
import { toast } from '../lib/toast';

export default function Payouts() {
  const { page, setPage, pageSize: limit } = usePaginationStore();
  const { data: paymentsData, isLoading, isError, createPayment, createPartialPayment, createCapitalPayment } = usePayments({ page, limit });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'regular' | 'partial' | 'capital'>('regular');
  const [formData, setFormData] = useState({
    loanId: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    method: 'cash'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    try {
      await downloadVoucher(paymentId);
      toast.success({ title: 'Comprobante descargado' });
    } catch (error) {
      toast.error({ title: 'Error al descargar comprobante' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        loanId: parseInt(formData.loanId),
        paymentAmount: parseFloat(formData.amount),
        paymentDate: new Date(formData.paymentDate).toISOString(),
        paymentMethod: formData.method
      };

      if (paymentType === 'regular') {
        await createPayment.mutateAsync(payload);
      } else if (paymentType === 'partial') {
        await createPartialPayment.mutateAsync(payload);
      } else if (paymentType === 'capital') {
        await createCapitalPayment.mutateAsync(payload);
      }
      
      setShowPaymentModal(false);
      setFormData({ loanId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], method: 'cash' });
      toast.success({ title: 'Pago registrado exitosamente' });
    } catch (error) {
      toast.error({ title: 'Error al registrar pago' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Pagos y Cobranza</h2>
          <p className="text-sm text-text-secondary mt-1">Consulta global de pagos y aplicación de cuotas.</p>
        </div>
        <button 
          onClick={() => setShowPaymentModal(true)}
          className="flex items-center gap-2 bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> Registrar Pago
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

        <div className="overflow-x-auto">
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
              {isLoading ? (
                <tr><td colSpan={7} className="py-4 text-center text-text-secondary">Cargando pagos...</td></tr>
              ) : isError ? (
                <tr><td colSpan={7} className="py-4 text-center text-red-500">Error al cargar pagos.</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={7} className="py-4 text-center text-text-secondary">No hay pagos registrados.</td></tr>
              ) : (
                payments.map((payment: any) => (
                  <tr key={payment.id} className="hover:bg-hover-bg transition-colors">
                    <td className="py-4 text-text-secondary font-mono">{String(payment.id).substring(0, 8)}</td>
                    <td className="py-4 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-mono">{payment.loanId}</td>
                    <td className="py-4 text-text-secondary">{formatPaymentDate(payment)}</td>
                    <td className="py-4 font-medium">${Number(payment.amount ?? 0).toLocaleString()}</td>
                    <td className="py-4 text-text-secondary capitalize">{formatPaymentMethod(payment)}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded text-xs ${formatPaymentStatus(payment) === 'Aplicado' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'}`}>
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
                        <button className="p-1.5 text-text-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Ver detalles"><Eye size={16} /></button>
                        <button className="p-1.5 text-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors" title="Editar"><Edit size={16} /></button>
                        <button className="p-1.5 text-text-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {paymentsData && pagination && (
          <div className="mt-4 flex justify-between items-center text-sm text-text-secondary">
            <div>
              Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, pagination?.totalItems ?? pagination?.total ?? 0)} de {pagination?.totalItems ?? pagination?.total ?? 0} pagos
            </div>
            <div className="flex gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 border border-border-subtle rounded hover:bg-hover-bg disabled:opacity-50"
              >
                Anterior
              </button>
              <button 
                disabled={page === (pagination?.totalPages ?? 1)}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 border border-border-subtle rounded hover:bg-hover-bg disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-2xl w-full max-w-md p-6 border border-border-subtle">
            <h3 className="text-xl font-bold mb-4">Registrar Nuevo Pago</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Tipo de Pago</label>
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
