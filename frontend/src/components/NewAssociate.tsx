import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAssociateById, useAssociates } from '../services/associateService';
import { toast } from '../lib/toast';
import { useCreateEntitySubmit } from './hooks/useCreateEntitySubmit';
import { ActionButton, EmptyState, PageHeader, PageShell, SectionSurface } from './shared/Surfaces';

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

  const title = useMemo(() => (isEditing ? 'Editar socio' : 'Nuevo socio'), [isEditing]);
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
      <PageShell>
        <SectionSurface>
          <EmptyState compact title="Cargando datos del socio…" icon={<Loader2 size={16} className="animate-spin" />} />
        </SectionSurface>
      </PageShell>
    );
  }

  if (isEditing && isAssociateLoadError) {
    return (
      <PageShell>
        <SectionSurface>
          <EmptyState
            title="No fue posible cargar el socio"
            description="Vuelve a la lista e inténtalo de nuevo."
            action={<ActionButton onClick={onBack}>Volver a socios</ActionButton>}
          />
        </SectionSurface>
      </PageShell>
    );
  }

  return (
    <PageShell className="mx-auto w-full max-w-3xl" data-tour="new-associate-page">
      <PageHeader
        title={title}
        subtitle={subtitle}
        guideKey="new-associate"
        tourId="new-associate-header"
        actions={(
          <ActionButton onClick={onBack} icon={<ArrowLeft size={16} />}>
            Volver
          </ActionButton>
        )}
      />

      <SectionSurface as="form" onSubmit={handleSubmit} data-tour="new-associate-form">
        <div className="space-y-4">
          <div>
            <label htmlFor="new-associate-name" className="mb-1 block text-sm font-medium text-text-secondary">Nombre Completo *</label>
            <input
              id="new-associate-name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-text-primary"
              placeholder="Nombre del socio"
            />
          </div>

          <div>
            <label htmlFor="new-associate-email" className="mb-1 block text-sm font-medium text-text-secondary">Correo electrónico</label>
            <input
              id="new-associate-email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-text-primary"
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div>
            <label htmlFor="new-associate-phone" className="mb-1 block text-sm font-medium text-text-secondary">Teléfono</label>
            <input
              id="new-associate-phone"
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-text-primary"
              placeholder="Número de teléfono"
            />
          </div>

          <div>
            <label htmlFor="new-associate-status" className="mb-1 block text-sm font-medium text-text-secondary">Estado</label>
            <select
              id="new-associate-status"
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-text-primary"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>

          <div>
            <label htmlFor="new-associate-participation" className="mb-1 block text-sm font-medium text-text-secondary">Participación sobre utilidades (%)</label>
            <input
              id="new-associate-participation"
              type="number"
              min="0"
              max="100"
              step="0.0001"
              value={formData.participationPercentage}
              onChange={(e) => setFormData((prev) => ({ ...prev, participationPercentage: e.target.value }))}
              className="w-full rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-text-primary"
              placeholder="Opcional. Ejemplo: 25"
            />
            <p className="mt-1 text-xs text-text-secondary">
              Úsalo cuando el socio participe en distribuciones proporcionales. La suma de socios activos debe cerrar en 100%.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <ActionButton type="button" onClick={onBack} fullWidth>
              Cancelar
            </ActionButton>
            <ActionButton
              type="submit"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              variant="primary"
              fullWidth
            >
              {isEditing ? 'Guardar cambios' : 'Crear socio'}
            </ActionButton>
          </div>
        </div>
      </SectionSurface>
    </PageShell>
  );
}
