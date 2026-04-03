import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAssociates } from '../services/associateService';
import { toast } from '../lib/toast';
import { useCreateEntitySubmit } from './hooks/useCreateEntitySubmit';

interface NewAssociateProps {
  onBack: () => void;
}

export default function NewAssociate({ onBack }: NewAssociateProps) {
  const { createAssociate } = useAssociates();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'active',
  });
  const { isSubmitting, run } = useCreateEntitySubmit({
    mutate: (payload: typeof formData) => createAssociate.mutateAsync(payload),
    errorContext: { domain: 'associates', action: 'associate.create' },
    onSuccess: onBack,
    successMessage: 'Socio creado exitosamente',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error({ title: 'El nombre es requerido' });
      return;
    }

    if (!formData.email.trim() || !formData.phone.trim()) {
      toast.error({ title: 'El email y teléfono son requeridos' });
      return;
    }

    await run(formData);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-hover-bg rounded-xl text-text-secondary transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nuevo Socio</h1>
          <p className="text-sm text-text-secondary mt-1">Crear un nuevo socio en el sistema</p>
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Nombre Completo *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2 text-text-primary"
              placeholder="Nombre del socio"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2 text-text-primary"
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Teléfono</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2 text-text-primary"
              placeholder="Número de teléfono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Estado</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2 text-text-primary"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-2 border border-border-subtle rounded-lg hover:bg-hover-bg text-text-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Creando...' : 'Crear Socio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
