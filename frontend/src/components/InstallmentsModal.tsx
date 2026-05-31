import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { formatCurrency as formatCurrencyValue, formatDate as formatDateValue } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { ActionButton, DataTableSurface, EmptyState, InsightStrip, ModalShell } from './shared/Surfaces';

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

const formatInstallmentDate = (value: unknown) => formatDateValue(value) || '-';

const getInstallmentStatusPresentation = (installment: Installment) => {
  if (installment.status === 'paid') {
    return { label: tTerm('associateDetails.installments.metric.paid'), className: 'bg-emerald-100 text-emerald-700' };
  }

  const dueTimestamp = Date.parse(String(installment.dueDate || ''));
  if (installment.status === 'overdue' || (Number.isFinite(dueTimestamp) && dueTimestamp < Date.now())) {
    return { label: tTerm('associateDetails.installments.metric.overdue'), className: 'bg-red-100 text-red-700' };
  }

  return { label: tTerm('associateDetails.installments.metric.pending'), className: 'bg-amber-100 text-amber-700' };
};

export default function InstallmentsModal({
  installments,
  isLoading,
  onClose,
}: InstallmentsModalProps) {
  const installmentsData = installments || { installments: [], totals: { totalPending: 0, totalPaid: 0, totalOverdue: 0 } };

  return (
    <ModalShell
      title={tTerm('associateDetails.installments.title')}
      subtitle={tTerm('associateDetails.installments.description')}
      maxWidthClassName="max-w-2xl"
      onClose={onClose}
      footer={(
        <ActionButton onClick={onClose} fullWidth>
          {tTerm('common.cta.close')}
        </ActionButton>
      )}
    >
          <InsightStrip
            className="mb-4"
            aria-label={tTerm('associateDetails.installments.ariaLabel')}
            items={[
              { id: 'installments-modal-pending', label: tTerm('associateDetails.installments.metric.pending'), value: formatCurrencyValue(installmentsData.totals.totalPending), helper: tTerm('associateDetails.installments.metric.pendingHelper'), icon: <Clock size={18} />, accent: 'amber' },
              { id: 'installments-modal-paid', label: tTerm('associateDetails.installments.metric.paid'), value: formatCurrencyValue(installmentsData.totals.totalPaid), helper: tTerm('associateDetails.installments.metric.paidHelper'), icon: <CheckCircle size={18} />, accent: 'emerald' },
              { id: 'installments-modal-overdue', label: tTerm('associateDetails.installments.metric.overdue'), value: formatCurrencyValue(installmentsData.totals.totalOverdue), helper: tTerm('associateDetails.installments.metric.overdueHelper'), icon: <AlertCircle size={18} />, accent: 'rose' },
            ]}
          />

          {isLoading ? (
            <DataTableSurface>
              <EmptyState compact title={tTerm('associateDetails.installments.loading')} />
            </DataTableSurface>
          ) : installmentsData.installments.length > 0 ? (
            <DataTableSurface>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th>{tTerm('associateDetails.installments.header.number')}</th>
                    <th>{tTerm('associateDetails.installments.header.amount')}</th>
                    <th>{tTerm('associateDetails.installments.header.dueDate')}</th>
                    <th>{tTerm('associateDetails.installments.header.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {installmentsData.installments.map((inst) => {
                    const status = getInstallmentStatusPresentation(inst);

                    return (
                    <tr key={inst.id}>
                      <td className="font-medium">{inst.installmentNumber}</td>
                      <td className="font-medium">{formatCurrencyValue(inst.amount)}</td>
                      <td>{formatInstallmentDate(inst.dueDate)}</td>
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
              <EmptyState title={tTerm('associateDetails.installments.empty')} />
            </DataTableSurface>
          )}
    </ModalShell>
  );
}
