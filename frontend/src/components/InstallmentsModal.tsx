import React from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { ActionButton, DataTableSurface, EmptyState, MetricCard, ModalShell } from './shared/Surfaces';

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

const dateFormatter = new Intl.DateTimeFormat('es-CO');

const formatDate = (value: unknown) => {
  const timestamp = Date.parse(String(value || ''));
  return Number.isNaN(timestamp) ? '-' : dateFormatter.format(timestamp);
};

const getInstallmentStatusPresentation = (installment: Installment) => {
  if (installment.status === 'paid') {
    return { label: 'Pagado', className: 'bg-emerald-100 text-emerald-700' };
  }

  const dueTimestamp = Date.parse(String(installment.dueDate || ''));
  if (installment.status === 'overdue' || (Number.isFinite(dueTimestamp) && dueTimestamp < Date.now())) {
    return { label: 'Vencido', className: 'bg-red-100 text-red-700' };
  }

  return { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' };
};

export default function InstallmentsModal({
  installments,
  isLoading,
  onClose,
}: InstallmentsModalProps) {
  const installmentsData = installments || { installments: [], totals: { totalPending: 0, totalPaid: 0, totalOverdue: 0 } };

  return (
    <ModalShell
      title="Cuotas del socio"
      subtitle="Resumen y calendario de cuotas asociadas al socio."
      maxWidthClassName="max-w-2xl"
      footer={(
        <ActionButton onClick={onClose} fullWidth>
          Cerrar
        </ActionButton>
      )}
    >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Pendiente"
              value={`$${installmentsData.totals.totalPending.toLocaleString()}`}
              icon={<Clock size={14} />}
              accent="amber"
            />
            <MetricCard
              label="Pagado"
              value={`$${installmentsData.totals.totalPaid.toLocaleString()}`}
              icon={<CheckCircle size={14} />}
              accent="emerald"
            />
            <MetricCard
              label="Vencido"
              value={`$${installmentsData.totals.totalOverdue.toLocaleString()}`}
              icon={<AlertCircle size={14} />}
              accent="rose"
            />
          </div>

          {isLoading ? (
            <DataTableSurface>
              <EmptyState compact title="Cargando cuotas..." />
            </DataTableSurface>
          ) : installmentsData.installments.length > 0 ? (
            <DataTableSurface>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Monto</th>
                    <th>Fecha vencimiento</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {installmentsData.installments.map((inst) => {
                    const status = getInstallmentStatusPresentation(inst);

                    return (
                    <tr key={inst.id}>
                      <td className="font-medium">{inst.installmentNumber}</td>
                      <td className="font-medium">${Number(inst.amount).toLocaleString()}</td>
                      <td>{formatDate(inst.dueDate)}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </DataTableSurface>
          ) : (
            <DataTableSurface>
              <EmptyState title="No hay cuotas registradas." />
            </DataTableSurface>
          )}
    </ModalShell>
  );
}
