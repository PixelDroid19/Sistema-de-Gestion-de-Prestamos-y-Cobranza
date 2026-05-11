import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, User, Phone, MapPin, Mail, CreditCard, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useCustomers, useCustomerById } from '../services/customerService';
import { useCreateEntitySubmit } from './hooks/useCreateEntitySubmit';
import { ActionButton, EmptyState, PageHeader, PageShell, SectionSurface } from './shared/Surfaces';

type CustomerFormData = {
  firstName: string;
  lastName: string;
  documentId: string;
  status: string;
  phone: string;
  email: string;
  address: string;
};

const EMPTY_FORM: CustomerFormData = {
  firstName: '',
  lastName: '',
  documentId: '',
  status: 'active',
  phone: '',
  email: '',
  address: '',
};

const splitName = (fullName: string) => {
  const normalized = String(fullName || '').trim();
  if (!normalized) {
    return { firstName: '', lastName: '' };
  }

  const parts = normalized.split(/\s+/u);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1) || '',
  };
};

export default function NewCustomer({ onBack }: { onBack: () => void }) {
  const { id } = useParams<{ id: string }>();
  const customerId = Number(id);
  const isEditing = Number.isFinite(customerId) && customerId > 0;

  const { createCustomer, updateCustomer } = useCustomers();
  const { data: customerDetail, isLoading: isLoadingCustomer, isError: isCustomerLoadError } = useCustomerById(customerId);
  const existingCustomer = customerDetail?.data?.customer || customerDetail?.data || null;

  const [formData, setFormData] = useState<CustomerFormData>(EMPTY_FORM);

  useEffect(() => {
    if (!isEditing || !existingCustomer) {
      return;
    }

    const { firstName, lastName } = splitName(existingCustomer.name);
    setFormData({
      firstName,
      lastName,
      documentId: existingCustomer.documentNumber || '',
      status: existingCustomer.status || 'active',
      phone: existingCustomer.phone || '',
      email: existingCustomer.email || '',
      address: existingCustomer.address || '',
    });
  }, [existingCustomer, isEditing]);

  const buildCustomerPayload = (payload: CustomerFormData) => {
    const fullName = [payload.firstName, payload.lastName]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' ');

    return {
      name: fullName,
      email: payload.email.trim(),
      phone: payload.phone.trim(),
      address: payload.address.trim() || undefined,
      documentNumber: payload.documentId.trim() || undefined,
      status: payload.status,
    };
  };

  const submitConfig = useMemo(() => ({
    mutate: (payload: CustomerFormData) => {
      const normalizedPayload = buildCustomerPayload(payload);
      if (isEditing) {
        return updateCustomer.mutateAsync({ id: customerId, ...normalizedPayload });
      }

      return createCustomer.mutateAsync(normalizedPayload);
    },
    errorContext: { domain: 'customers', action: isEditing ? 'customer.update' : 'customer.create' } as const,
    onSuccess: onBack,
    successMessage: isEditing ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente',
  }), [createCustomer, customerId, isEditing, onBack, updateCustomer]);

  const { isSubmitting, run } = useCreateEntitySubmit(submitConfig);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await run(formData);
  };

  const title = isEditing ? 'Editar cliente' : 'Nuevo Cliente';
  const subtitle = isEditing
    ? 'Actualiza la información operativa del cliente sin perder su historial.'
    : 'Registrar un nuevo perfil de prestatario en el sistema.';
  const submitLabel = isEditing ? 'Guardar cambios' : 'Guardar Cliente';

  if (isEditing && isLoadingCustomer) {
    return (
      <PageShell>
        <SectionSurface>
          <EmptyState compact title="Cargando datos del cliente…" icon={<Loader2 size={16} className="animate-spin" />} />
        </SectionSurface>
      </PageShell>
    );
  }

  if (isEditing && isCustomerLoadError) {
    return (
      <PageShell>
        <SectionSurface>
          <EmptyState
            title="No fue posible cargar el cliente"
            description="Revisa la conexión o vuelve a la lista para intentarlo de nuevo."
            action={<ActionButton onClick={onBack}>Volver a clientes</ActionButton>}
          />
        </SectionSurface>
      </PageShell>
    );
  }

  return (
    <PageShell className="h-full" data-tour="new-customer-page">
      <PageHeader
        title={title}
        subtitle={subtitle}
        guideKey="new-customer"
        tourId="new-customer-header"
        actions={(
          <>
            <ActionButton type="button" onClick={onBack} icon={<ArrowLeft size={16} />}>
              Cancelar
            </ActionButton>
            <ActionButton
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              isLoading={isSubmitting}
              icon={isSubmitting ? undefined : <Save size={16} />}
              variant="primary"
            >
              {submitLabel}
            </ActionButton>
          </>
        )}
      />

      <div className="flex-1 overflow-y-auto pb-8">
        <form onSubmit={handleSubmit} className="grid w-full gap-6 xl:grid-cols-2">
          <SectionSurface
            data-tour="new-customer-personal"
            title={<span className="flex items-center gap-2"><User size={20} className="text-blue-500" /> Información personal</span>}
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="new-customer-first-name" className="text-sm font-medium text-text-secondary">Nombres</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input id="new-customer-first-name" type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className="w-full rounded-lg border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Ej. Juan" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="new-customer-last-name" className="text-sm font-medium text-text-secondary">Apellidos</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input id="new-customer-last-name" type="text" name="lastName" value={formData.lastName} onChange={handleChange} required className="w-full rounded-lg border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Ej. Pérez" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="new-customer-document-id" className="text-sm font-medium text-text-secondary">DNI / Identificación</label>
                <div className="relative">
                  <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input id="new-customer-document-id" type="text" name="documentId" value={formData.documentId} onChange={handleChange} required className="w-full rounded-lg border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Ej. 12345678" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="new-customer-status" className="text-sm font-medium text-text-secondary">Estado</label>
                <select id="new-customer-status" name="status" value={formData.status} onChange={handleChange} className="w-full cursor-pointer appearance-none rounded-lg border border-border-subtle bg-bg-base px-4 py-2.5 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="blacklisted">Bloqueado</option>
                </select>
              </div>
            </div>
          </SectionSurface>

          <SectionSurface
            data-tour="new-customer-contact"
            title={<span className="flex items-center gap-2"><MapPin size={20} className="text-emerald-500" /> Contacto y dirección</span>}
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="new-customer-phone" className="text-sm font-medium text-text-secondary">Teléfono</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input id="new-customer-phone" type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full rounded-lg border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="+1 234 567 890" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="new-customer-email" className="text-sm font-medium text-text-secondary">Correo electrónico</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input id="new-customer-email" type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full rounded-lg border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="correo@ejemplo.com" />
                </div>
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label htmlFor="new-customer-address" className="text-sm font-medium text-text-secondary">Dirección Completa</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-3 text-text-secondary" />
                  <textarea id="new-customer-address" name="address" value={formData.address} onChange={handleChange} rows={3} className="w-full resize-none rounded-lg border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Calle Principal 123, Ciudad, Provincia, Código Postal" />
                </div>
              </div>
            </div>
          </SectionSurface>
        </form>
      </div>
    </PageShell>
  );
}
