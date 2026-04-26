import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAssociateById, useAssociates } from '../services/associateService';
import { toast } from '../lib/toast';
import { useCreateEntitySubmit } from './hooks/useCreateEntitySubmit';

interface AssociateFormData {
  name: string;
  email: string;
  phone: string;
  status: string;
  participationPercentage: string;
}

interface NewAssociateProps {
  onBack: () => void;
}

const EMPTY_FORM: AssociateFormData = {
  name: '',
  email: '',
  phone: '',
  status: 'active',
  participationPercentage: '',
};

export default function NewAssociate({ onBack }: NewAssociateProps) {
  const { id } = useParams<{ id: string }>();
  const associateId = Number(id);
  const isEditing = Number.isFinite(associateId) && associateId > 0;

  const { createAssociate, updateAssociate } = useAssociates();
  const { data: associateResponse, isLoading: isLoadingAssociate, isError: isAssociateLoadError } = useAssociateById(associateId);
  const existingAssociate = associateResponse?.data?.associate || associateResponse?.data || null;
  const [formData, setFormData] = useState<AssociateFormData>(EMPTY_FORM);

  useEffect(() => {
    if (!isEditing || !existingAssociate) {
      return;
    }

    setFormData({
      name: existingAssociate.name || '',
      email: existingAssociate.email || '',
      phone: existingAssociate.phone || '',
      status: existingAssociate.status || 'active',
      participationPercentage: existingAssociate.participationPercentage || '',
    });
  }, [existingAssociate, isEditing]);

  const { isSubmitting, run } = useCreateEntitySubmit({
    mutate: (payload: AssociateFormData) => {
      if (isEditing) {
        return updateAssociate.mutateAsync({ id: associateId, ...payload });
      }

      return createAssociate.mutateAsync(payload);
    },
    errorContext: { domain: 'associates', action: isEditing ? 'associate.update' : 'associate.create' },
    onSuccess: onBack,
    successMessage: isEditing ? 'Socio actualizado exitosamente' : 'Socio creado exitosamente',
  });

  const title = useMemo(() => (isEditing ? 'Editar socio' : 'Nuevo Socio'), [isEditing]);
  const subtitle = useMemo(() => (
    isEditing
      ? 'Actualiza la información operativa del socio sin afectar su historial financiero.'
      : 'Crea el socio y define, si aplica, su porcentaje de participación en utilidades.'
  ), [isEditing]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.name.trim()) {
      toast.error({ title: 'El nombre es requerido' });
      return;
    }

    if (!formData.email.trim() || !formData.phone.trim()) {
      toast.error({ title: 'El correo y el teléfono son requeridos' });
      return;
    }

    await run(formData);
  };

  if (isEditing && isLoadingAssociate) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-border-subtle bg-bg-surface">
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <Loader2 size={16} className="animate-spin" />
          Cargando datos del socio...
        </div>
      </div>
    );
  }

  if (isEditing && isAssociateLoadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-border-subtle bg-bg-surface p-8 text-center">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">No fue posible cargar el socio</h2>
          <p className="mt-2 text-sm text-text-secondary">Vuelve a la lista e inténtalo de nuevo.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-hover-bg"
        >
          Volver a socios
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-xl p-2 text-text-secondary transition-colors hover:bg-hover-bg"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Nombre Completo *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-text-primary"
              placeholder="Nombre del socio"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Correo Electrónico</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-text-primary"
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Teléfono</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-text-primary"
              placeholder="Número de teléfono"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Estado</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-text-primary"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Participación sobre utilidades (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.0001"
              value={formData.participationPercentage}
              onChange={(e) => setFormData({ ...formData, participationPercentage: e.target.value })}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-text-primary"
              placeholder="Opcional. Ejemplo: 25"
            />
            <p className="mt-1 text-xs text-text-secondary">
              Úsalo cuando el socio participe en distribuciones proporcionales. La suma de socios activos debe cerrar en 100%.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 rounded-lg border border-border-subtle py-2 text-text-secondary hover:bg-hover-bg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-brand-primary py-2 text-white hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? (isEditing ? 'Guardando...' : 'Creando...') : (isEditing ? 'Guardar cambios' : 'Crear Socio')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
