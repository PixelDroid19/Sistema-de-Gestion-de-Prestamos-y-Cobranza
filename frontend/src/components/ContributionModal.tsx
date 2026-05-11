import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from '../lib/toast';
import { ActionButton, EmptyState, ModalShell, SectionSurface } from './shared/Surfaces';

interface Contribution {
  id: number;
  amount: number;
  date: string;
  displayAmount?: string;
  notes?: string;
}

interface ContributionModalProps {
  contributions: Contribution[] | undefined;
  isLoading: boolean;
  onAddContribution: (data: { amount: number; contributionDate: string }) => Promise<void>;
  onClose: () => void;
  canAddContribution?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat('es-CO');

const formatDate = (value: unknown) => {
  const timestamp = Date.parse(String(value || ''));
  return Number.isNaN(timestamp) ? '-' : dateFormatter.format(timestamp);
};

export default function ContributionModal({
  contributions,
  isLoading,
  onAddContribution,
  onClose,
  canAddContribution = true,
}: ContributionModalProps) {
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setIsSubmitting(true);
    try {
      await onAddContribution({
        amount: parseFloat(amount),
        contributionDate: new Date().toISOString(),
      });
      setAmount('');
      setShowAddForm(false);
      toast.success({ title: 'Aporte registrado correctamente' });
    } catch (error) {
      toast.error({ title: 'No se pudo registrar el aporte' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="Historial de aportes"
      subtitle="Consulta y registra aportes asociados al socio."
      maxWidthClassName="max-w-lg"
      footer={(
        <ActionButton onClick={onClose} fullWidth>
          Cerrar
        </ActionButton>
      )}
    >
          {canAddContribution && !showAddForm && (
            <ActionButton
              onClick={() => setShowAddForm(true)}
              variant="primary"
              fullWidth
              icon={<Plus size={16} />}
              className="mb-4"
            >
              Nuevo aporte
            </ActionButton>
          )}

          {canAddContribution && showAddForm && (
            <SectionSurface as="form" onSubmit={handleSubmit} className="mb-4" title="Registrar nuevo aporte">
              <div className="space-y-3">
                <div>
                  <label htmlFor="new-contribution-amount" className="block text-sm font-medium text-text-secondary mb-1">Monto</label>
                  <input
                    id="new-contribution-amount"
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-4 py-2 text-text-primary"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-2">
                  <ActionButton
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setAmount('');
                    }}
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
                    {isSubmitting ? 'Guardando...' : 'Confirmar'}
                  </ActionButton>
                </div>
              </div>
            </SectionSurface>
          )}

          {isLoading ? (
            <EmptyState compact title="Cargando historial..." />
          ) : contributions && contributions.length > 0 ? (
            <div className="space-y-2">
              {contributions.map((contribution) => (
                <div
                  key={contribution.id}
                  className="flex items-center justify-between p-3 bg-bg-base border border-border-subtle rounded-lg"
                >
                  <div>
                    <p className="font-medium text-text-primary">
                      {contribution.displayAmount || `$${contribution.amount.toLocaleString()}`}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {formatDate(contribution.date)}
                    </p>
                    {contribution.notes && (
                      <p className="text-xs text-text-secondary mt-1">{contribution.notes}</p>
                    )}
                  </div>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                    Completado
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No hay aportes registrados." />
          )}
    </ModalShell>
  );
}
