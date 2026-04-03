import React, { useState } from 'react';
import { X, Plus, History } from 'lucide-react';
import { toast } from '../lib/toast';

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
  associateId: number;
  onAddContribution: (data: { amount: number; date: string }) => Promise<void>;
  onClose: () => void;
}

export default function ContributionModal({
  contributions,
  isLoading,
  associateId,
  onAddContribution,
  onClose,
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
        date: new Date().toISOString(),
      });
      setAmount('');
      setShowAddForm(false);
      toast.success({ title: 'Aportación registrada exitosamente' });
    } catch (error) {
      toast.error({ title: 'Error al registrar la aportación' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-surface rounded-2xl w-full max-w-lg border border-border-subtle">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <History size={20} className="text-emerald-600" />
            <h3 className="text-lg font-bold text-text-primary">Historial de Aportaciones</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Add Contribution Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors mb-4"
            >
              <Plus size={16} /> Nueva Aportación
            </button>
          )}

          {/* Add Contribution Form */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="bg-bg-base border border-border-subtle rounded-xl p-4 mb-4">
              <h4 className="text-sm font-medium text-text-primary mb-3">Registrar Nueva Aportación</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Monto</label>
                  <input
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
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setAmount('');
                    }}
                    className="flex-1 py-2 border border-border-subtle rounded-lg hover:bg-hover-bg text-text-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Guardando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Contributions List */}
          {isLoading ? (
            <div className="text-center py-8 text-text-secondary">Cargando historial...</div>
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
                      {new Date(contribution.date).toLocaleDateString()}
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
            <div className="text-center py-8 text-text-secondary">
              No hay aportaciones registradas.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle">
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
