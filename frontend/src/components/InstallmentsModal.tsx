import React from 'react';
import { X, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface Installment {
  id: number;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
}

interface InstallmentsModalProps {
  installments: { installments: Installment[]; totals: { totalPending: number; totalPaid: number; totalOverdue: number } } | undefined;
  isLoading: boolean;
  onClose: () => void;
}

export default function InstallmentsModal({
  installments,
  isLoading,
  onClose,
}: InstallmentsModalProps) {
  const installmentsData = installments || { installments: [], totals: { totalPending: 0, totalPaid: 0, totalOverdue: 0 } };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-surface rounded-2xl w-full max-w-2xl border border-border-subtle max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-amber-600" />
            <h3 className="text-lg font-bold text-text-primary">Cuotas del Socio</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-bg-base border border-border-subtle rounded-xl p-3">
              <h4 className="text-xs font-medium text-text-secondary flex items-center gap-1">
                <Clock size={12} className="text-amber-500" /> Pendiente
              </h4>
              <p className="text-lg font-semibold mt-1 text-amber-600">
                ${installmentsData.totals.totalPending.toLocaleString()}
              </p>
            </div>
            <div className="bg-bg-base border border-border-subtle rounded-xl p-3">
              <h4 className="text-xs font-medium text-text-secondary flex items-center gap-1">
                <CheckCircle size={12} className="text-emerald-500" /> Pagado
              </h4>
              <p className="text-lg font-semibold mt-1 text-emerald-600">
                ${installmentsData.totals.totalPaid.toLocaleString()}
              </p>
            </div>
            <div className="bg-bg-base border border-border-subtle rounded-xl p-3">
              <h4 className="text-xs font-medium text-text-secondary flex items-center gap-1">
                <AlertCircle size={12} className="text-red-500" /> Vencido
              </h4>
              <p className="text-lg font-semibold mt-1 text-red-600">
                ${installmentsData.totals.totalOverdue.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Installments Table */}
          {isLoading ? (
            <div className="text-center py-8 text-text-secondary">Cargando cuotas...</div>
          ) : installmentsData.installments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-text-secondary border-b border-border-subtle">
                  <tr>
                    <th className="pb-2 font-medium">#</th>
                    <th className="pb-2 font-medium">Monto</th>
                    <th className="pb-2 font-medium">Fecha Vencimiento</th>
                    <th className="pb-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {installmentsData.installments.map((inst) => (
                    <tr key={inst.id} className="hover:bg-hover-bg transition-colors">
                      <td className="py-3 font-medium">{inst.installmentNumber}</td>
                      <td className="py-3 font-medium">${Number(inst.amount).toLocaleString()}</td>
                      <td className="py-3">{new Date(inst.dueDate).toLocaleDateString()}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            inst.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : inst.status === 'overdue' || new Date(inst.dueDate) < new Date()
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {inst.status === 'paid'
                            ? 'Pagado'
                            : inst.status === 'overdue' || new Date(inst.dueDate) < new Date()
                            ? 'Vencido'
                            : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-text-secondary">No hay cuotas registradas.</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 border border-border-subtle rounded-lg hover:bg-hover-bg text-text-secondary"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
