import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, User, Phone, MapPin, Mail, CreditCard, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useCustomers, useCustomerById } from '../services/customerService';
import { useCreateEntitySubmit } from './hooks/useCreateEntitySubmit';

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
      <div className="flex h-full items-center justify-center rounded-2xl border border-border-subtle bg-bg-surface">
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <Loader2 size={16} className="animate-spin" />
          Cargando datos del cliente...
        </div>
      </div>
    );
  }

  if (isEditing && isCustomerLoadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-border-subtle bg-bg-surface p-8 text-center">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">No fue posible cargar el cliente</h2>
          <p className="mt-2 text-sm text-text-secondary">Revisa la conexión o vuelve a la lista para intentarlo de nuevo.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-hover-bg"
        >
          Volver a clientes
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="rounded-lg border border-border-subtle bg-bg-surface p-2 transition-colors hover:bg-hover-bg">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-hover-bg hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-bg-base shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {submitLabel}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-4xl flex-col gap-6">
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6">
            <h3 className="mb-6 flex items-center gap-2 border-b border-border-subtle pb-4 text-lg font-medium">
              <User size={20} className="text-blue-500" /> Información Personal
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">Nombres</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className="w-full rounded-lg border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Ej. Juan" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">Apellidos</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required className="w-full rounded-lg border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Ej. Pérez" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">DNI / Identificación</label>
                <div className="relative">
                  <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input type="text" name="documentId" value={formData.documentId} onChange={handleChange} required className="w-full rounded-lg border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Ej. 12345678" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">Estado</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full cursor-pointer appearance-none rounded-lg border border-border-subtle bg-bg-base px-4 py-2.5 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="blacklisted">Bloqueado</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6">
            <h3 className="mb-6 flex items-center gap-2 border-b border-border-subtle pb-4 text-lg font-medium">
              <MapPin size={20} className="text-emerald-500" /> Contacto y Dirección
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">Teléfono</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full rounded-lg border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="+1 234 567 890" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">Correo Electrónico</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full rounded-lg border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="correo@ejemplo.com" />
                </div>
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-sm font-medium text-text-secondary">Dirección Completa</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-3 text-text-secondary" />
                  <textarea name="address" value={formData.address} onChange={handleChange} rows={3} className="w-full resize-none rounded-lg border border-border-subtle bg-bg-base py-2.5 pl-10 pr-4 text-text-primary transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Calle Principal 123, Ciudad, Provincia, Código Postal" />
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
