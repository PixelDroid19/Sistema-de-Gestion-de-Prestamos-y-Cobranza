import React, { useEffect, useState } from 'react';
import { ArrowLeft, Save, User, Phone, MapPin, Mail, CreditCard, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useCustomers, useCustomerById } from '../services/customerService';
import { tTerm } from '../i18n/terminology';
import { useCreateEntitySubmit } from './hooks/useCreateEntitySubmit';
import {
  ActionButton,
  EmptyState,
  FormField,
  PageHeader,
  PageShell,
  SectionSurface,
  SelectInput,
  TextAreaInput,
  TextInput,
} from './shared/Surfaces';

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

  const submitConfig = {
    mutate: (payload: CustomerFormData) => {
      const normalizedPayload = buildCustomerPayload(payload);
      if (isEditing) {
        return updateCustomer.mutateAsync({ id: customerId, ...normalizedPayload });
      }

      return createCustomer.mutateAsync(normalizedPayload);
    },
    errorContext: { domain: 'customers', action: isEditing ? 'customer.update' : 'customer.create' } as const,
    onSuccess: onBack,
    successMessage: isEditing ? tTerm('newCustomer.success.edit') : tTerm('newCustomer.success.create'),
  };

  const { isSubmitting, run } = useCreateEntitySubmit(submitConfig);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await run(formData);
  };

  const title = isEditing ? tTerm('newCustomer.title.edit') : tTerm('newCustomer.title.create');
  const subtitle = isEditing
    ? tTerm('newCustomer.subtitle.edit')
    : tTerm('newCustomer.subtitle.create');
  const submitLabel = isEditing ? tTerm('newCustomer.submit.edit') : tTerm('newCustomer.submit.create');

  if (isEditing && isLoadingCustomer) {
    return (
      <PageShell>
        <SectionSurface>
          <EmptyState compact title={tTerm('newCustomer.loading')} icon={<Loader2 size={16} className="animate-spin" />} />
        </SectionSurface>
      </PageShell>
    );
  }

  if (isEditing && isCustomerLoadError) {
    return (
      <PageShell>
        <SectionSurface>
          <EmptyState
            title={tTerm('newCustomer.loadError.title')}
            description={tTerm('newCustomer.loadError.description')}
            action={<ActionButton onClick={onBack}>{tTerm('newCustomer.actions.back')}</ActionButton>}
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
              {tTerm('newCustomer.actions.cancel')}
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
            title={<span className="flex items-center gap-2"><User size={20} className="text-blue-500" /> {tTerm('newCustomer.section.personal')}</span>}
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField label={tTerm('newCustomer.field.firstName')}>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <TextInput id="new-customer-first-name" type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className="pl-10" placeholder={tTerm('newCustomer.placeholder.firstName')} />
                </div>
              </FormField>
              <FormField label={tTerm('newCustomer.field.lastName')}>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <TextInput id="new-customer-last-name" type="text" name="lastName" value={formData.lastName} onChange={handleChange} required className="pl-10" placeholder={tTerm('newCustomer.placeholder.lastName')} />
                </div>
              </FormField>
              <FormField label={tTerm('newCustomer.field.documentId')}>
                <div className="relative">
                  <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <TextInput id="new-customer-document-id" type="text" name="documentId" value={formData.documentId} onChange={handleChange} required className="pl-10" placeholder={tTerm('newCustomer.placeholder.documentId')} />
                </div>
              </FormField>
              <FormField label={tTerm('newCustomer.field.status')}>
                <SelectInput id="new-customer-status" name="status" value={formData.status} onChange={handleChange}>
                  <option value="active">{tTerm('common.status.active')}</option>
                  <option value="inactive">{tTerm('common.status.inactive')}</option>
                  <option value="blacklisted">{tTerm('common.status.blacklisted')}</option>
                </SelectInput>
              </FormField>
            </div>
          </SectionSurface>

          <SectionSurface
            data-tour="new-customer-contact"
            title={<span className="flex items-center gap-2"><MapPin size={20} className="text-emerald-500" /> {tTerm('newCustomer.section.contact')}</span>}
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField label={tTerm('newCustomer.field.phone')}>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <TextInput id="new-customer-phone" type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="pl-10" placeholder={tTerm('newCustomer.placeholder.phone')} />
                </div>
              </FormField>
              <FormField label={tTerm('newCustomer.field.email')}>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <TextInput id="new-customer-email" type="text" inputMode="email" name="email" value={formData.email} onChange={handleChange} required className="pl-10" placeholder={tTerm('newCustomer.placeholder.email')} />
                </div>
              </FormField>
              <FormField label={tTerm('newCustomer.field.address')} className="md:col-span-2">
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-3 text-text-secondary" />
                  <TextAreaInput id="new-customer-address" name="address" value={formData.address} onChange={handleChange} rows={3} className="pl-10" placeholder={tTerm('newCustomer.placeholder.address')} />
                </div>
              </FormField>
            </div>
          </SectionSurface>
        </form>
      </div>
    </PageShell>
  );
}
