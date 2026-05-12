import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAssociateById, useAssociates } from '../services/associateService';
import { toast } from '../lib/toast';
import { useCreateEntitySubmit } from './hooks/useCreateEntitySubmit';
import {
  ActionButton,
  EmptyState,
  FormField,
  PageHeader,
  PageShell,
  SectionSurface,
  SelectInput,
  TextInput,
} from './shared/Surfaces';

interface AssociateFormData {
  name: string;
  email: string;
  phone: string;
  status: string;
  participationPercentage: string;
  initialCapital: string;
  interestType: string;
  interestRate: string;
  interestPaymentDay: string;
  interestPaymentMonth: string;
  interestStartDate: string;
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
  initialCapital: '',
  interestType: 'monthly',
  interestRate: '0',
  interestPaymentDay: '1',
  interestPaymentMonth: '1',
  interestStartDate: '',
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
      initialCapital: '',
      interestType: existingAssociate.interestType || 'monthly',
      interestRate: existingAssociate.interestRate || '0',
      interestPaymentDay: String(existingAssociate.interestPaymentDay || 1),
      interestPaymentMonth: String(existingAssociate.interestPaymentMonth || 1),
      interestStartDate: existingAssociate.interestStartsAt || '',
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

    const interestRate = Number(formData.interestRate);
    if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100) {
      toast.error({ title: 'La tasa del socio debe estar entre 0% y 100%.' });
      return;
    }

    const paymentDay = Number(formData.interestPaymentDay);
    if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 28) {
      toast.error({ title: 'El día de pago debe estar entre 1 y 28.' });
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
          <FormField label="Nombre completo *">
            <TextInput
              id="new-associate-name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre del socio"
            />
          </FormField>

          <FormField label="Correo electrónico">
            <TextInput
              id="new-associate-email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="correo@ejemplo.com"
            />
          </FormField>

          <FormField label="Teléfono">
            <TextInput
              id="new-associate-phone"
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Número de teléfono"
            />
          </FormField>

          <FormField label="Estado">
            <SelectInput
              id="new-associate-status"
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </SelectInput>
          </FormField>

          <FormField
            label="Participación sobre utilidades (%)"
            helper="Úsalo cuando el socio participe en distribuciones proporcionales. La suma de socios activos debe cerrar en 100%."
          >
            <TextInput
              id="new-associate-participation"
              type="number"
              min="0"
              max="100"
              step="0.0001"
              value={formData.participationPercentage}
              onChange={(e) => setFormData((prev) => ({ ...prev, participationPercentage: e.target.value }))}
              placeholder="Opcional. Ejemplo: 25"
            />
          </FormField>

          <div className="grid gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2">
            {!isEditing && (
              <FormField
                label="Capital inicial aportado"
                helper="Opcional. Si lo registras aquí, el sistema crea el primer movimiento de capital y agenda el primer pago de interés."
              >
                <TextInput
                  id="new-associate-initial-capital"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.initialCapital}
                  onChange={(e) => setFormData((prev) => ({ ...prev, initialCapital: e.target.value }))}
                  placeholder="Ejemplo: 2000000"
                />
              </FormField>
            )}

            <FormField
              label="Tipo de interés"
              helper="Mensual cobra la tasa cada mes. Anual cobra una vez al año sobre el capital aportado."
            >
              <SelectInput
                id="new-associate-interest-type"
                value={formData.interestType}
                onChange={(e) => setFormData((prev) => ({ ...prev, interestType: e.target.value }))}
              >
                <option value="monthly">Mensual</option>
                <option value="annual">Anual</option>
              </SelectInput>
            </FormField>

            <FormField
              label={formData.interestType === 'annual' ? 'Tasa anual (%)' : 'Tasa mensual (%)'}
              helper="Porcentaje que se reconoce al socio sobre su capital aportado para cada periodo de pago."
            >
              <TextInput
                id="new-associate-interest-rate"
                type="number"
                min="0"
                max="100"
                step="0.0001"
                value={formData.interestRate}
                onChange={(e) => setFormData((prev) => ({ ...prev, interestRate: e.target.value }))}
                placeholder="Ejemplo: 2.5"
              />
            </FormField>

            {formData.interestType === 'annual' && (
              <FormField label="Mes de pago anual" helper="Mes en el que se paga el interés anual al socio.">
                <SelectInput
                  id="new-associate-interest-month"
                  value={formData.interestPaymentMonth}
                  onChange={(e) => setFormData((prev) => ({ ...prev, interestPaymentMonth: e.target.value }))}
                >
                  <option value="1">Enero</option>
                  <option value="2">Febrero</option>
                  <option value="3">Marzo</option>
                  <option value="4">Abril</option>
                  <option value="5">Mayo</option>
                  <option value="6">Junio</option>
                  <option value="7">Julio</option>
                  <option value="8">Agosto</option>
                  <option value="9">Septiembre</option>
                  <option value="10">Octubre</option>
                  <option value="11">Noviembre</option>
                  <option value="12">Diciembre</option>
                </SelectInput>
              </FormField>
            )}

            <FormField label="Día de pago de intereses" helper="Usamos días 1 a 28 para evitar errores por meses cortos.">
              <TextInput
                id="new-associate-interest-day"
                type="number"
                min="1"
                max="28"
                step="1"
                value={formData.interestPaymentDay}
                onChange={(e) => setFormData((prev) => ({ ...prev, interestPaymentDay: e.target.value }))}
              />
            </FormField>

            <FormField label="Fecha inicial de cálculo" helper="Opcional. Define desde cuándo se agenda el primer pago de interés.">
              <TextInput
                id="new-associate-interest-start-date"
                type="date"
                value={formData.interestStartDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, interestStartDate: e.target.value }))}
              />
            </FormField>
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
