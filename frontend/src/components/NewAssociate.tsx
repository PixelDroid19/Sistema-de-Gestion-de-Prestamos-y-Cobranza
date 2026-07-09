import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { tTerm } from '../i18n/terminology';
import { useAssociateById, useAssociates } from '../services/associateService';
import { parsePercentageWithPrecisionInput, parsePositiveIntegerInput, parsePositiveMoneyInput } from '../lib/moneyInput';
import { toast } from '../lib/toast';
import { useCreateEntitySubmit } from './hooks/useCreateEntitySubmit';
import {
  ActionButton,
  AppInput,
  CurrencyInput,
  EmptyState,
  FormField,
  OperationalSelect,
  PageHeader,
  PageShell,
  PercentInput,
  SectionSurface,
} from './shared/Surfaces';

interface AssociateFormData {
  name: string;
  email: string;
  phone: string;
  status: string;
  initialCapital: string;
  interestType: string;
  interestRate: string;
  interestPaymentDay: string;
  interestPaymentMonth: string;
}

interface NewAssociateProps {
  onBack: () => void;
  associateIdOverride?: number;
  embedded?: boolean;
}

const EMPTY_FORM: AssociateFormData = {
  name: '',
  email: '',
  phone: '',
  status: 'active',
  initialCapital: '',
  interestType: 'monthly',
  interestRate: '',
  interestPaymentDay: '1',
  interestPaymentMonth: '1',
};

const MONTH_TERM_KEYS = [
  'common.month.1',
  'common.month.2',
  'common.month.3',
  'common.month.4',
  'common.month.5',
  'common.month.6',
  'common.month.7',
  'common.month.8',
  'common.month.9',
  'common.month.10',
  'common.month.11',
  'common.month.12',
] as const;

const INTEREST_PAYMENT_DAY_OPTIONS = Array.from({ length: 28 }, (_, index) => String(index + 1));

export default function NewAssociate({ onBack, associateIdOverride, embedded = false }: NewAssociateProps) {
  const { id } = useParams<{ id: string }>();
  const associateId = Number(associateIdOverride ?? id);
  const isEditing = Number.isFinite(associateId) && associateId > 0;

  const { createAssociate, updateAssociate } = useAssociates(undefined, { enabled: false });
  const { data: associateResponse, isLoading: isLoadingAssociate, isError: isAssociateLoadError } = useAssociateById(associateId);
  const existingAssociate = associateResponse?.data?.associate || null;
  const [formData, setFormData] = useState<AssociateFormData>(EMPTY_FORM);
  const monthOptions = MONTH_TERM_KEYS.map((key, index) => ({
    value: String(index + 1),
    label: tTerm(key),
  }));

  useEffect(() => {
    if (!isEditing || !existingAssociate) {
      return;
    }

    setFormData({
      name: existingAssociate.name || '',
      email: existingAssociate.email || '',
      phone: existingAssociate.phone || '',
      status: existingAssociate.status || 'active',
      initialCapital: '',
      interestType: existingAssociate.interestType || 'monthly',
      interestRate: existingAssociate.interestRate != null && existingAssociate.interestRate !== ''
        ? String(Number(existingAssociate.interestRate))
        : '',
      interestPaymentDay: String(existingAssociate.interestPaymentDay || 1),
      interestPaymentMonth: String(existingAssociate.interestPaymentMonth || 1),
    });
  }, [existingAssociate, isEditing]);

  const { isSubmitting, run } = useCreateEntitySubmit({
    mutate: (payload: Partial<AssociateFormData>) => {
      if (isEditing) {
        return updateAssociate.mutateAsync({ id: associateId, ...payload });
      }

      return createAssociate.mutateAsync(payload);
    },
    errorContext: { domain: 'associates', action: isEditing ? 'associate.update' : 'associate.create' },
    onSuccess: onBack,
    successMessage: isEditing ? tTerm('newAssociate.success.edit') : tTerm('newAssociate.success.create'),
  });

  const title = isEditing ? tTerm('newAssociate.title.edit') : tTerm('newAssociate.title.create');
  const subtitle = isEditing ? tTerm('newAssociate.subtitle.edit') : tTerm('newAssociate.subtitle.create');

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.name.trim()) {
      toast.error({ title: tTerm('newAssociate.validation.nameRequired') });
      return;
    }

    if (!formData.email.trim() || !formData.phone.trim()) {
      toast.error({ title: tTerm('newAssociate.validation.contactRequired') });
      return;
    }

    if (formData.initialCapital.trim() && parsePositiveMoneyInput(formData.initialCapital) === null) {
      toast.error({ title: tTerm('newAssociate.validation.initialCapital') });
      return;
    }

    const interestRate = formData.interestRate.trim() === ''
      ? 0
      : parsePercentageWithPrecisionInput(formData.interestRate, 4);
    if (interestRate === null) {
      toast.error({ title: tTerm('newAssociate.validation.rateRange') });
      return;
    }

    const paymentDay = parsePositiveIntegerInput(formData.interestPaymentDay);
    if (paymentDay === null || paymentDay > 28) {
      toast.error({ title: tTerm('newAssociate.validation.dayRange') });
      return;
    }

    const payload: Partial<AssociateFormData> = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      status: formData.status,
      interestType: formData.interestType,
      interestRate: String(interestRate),
      interestPaymentDay: String(paymentDay),
      interestPaymentMonth: formData.interestType === 'annual' ? formData.interestPaymentMonth : '1',
    };

    // Empty initial capital is not part of the create contract; omit it instead of
    // sending "" which the API rejects as an invalid positive amount.
    if (!isEditing && formData.initialCapital.trim()) {
      payload.initialCapital = formData.initialCapital;
    }

    await run(payload);
  };

  if (isEditing && isLoadingAssociate) {
    return (
      <PageShell>
        <SectionSurface>
          <EmptyState compact title={tTerm('newAssociate.loading')} icon={<Loader2 size={16} className="animate-spin" />} />
        </SectionSurface>
      </PageShell>
    );
  }

  if (isEditing && isAssociateLoadError) {
    return (
      <PageShell>
        <SectionSurface>
          <EmptyState
            title={tTerm('newAssociate.loadError.title')}
            description={tTerm('newAssociate.loadError.description')}
            action={<ActionButton onClick={onBack}>{tTerm('newAssociate.actions.back')}</ActionButton>}
          />
        </SectionSurface>
      </PageShell>
    );
  }

  const form = (
    <SectionSurface as="form" onSubmit={handleSubmit} data-tour="new-associate-form" className={`associate-form ${embedded ? 'border-0 bg-transparent p-0 shadow-none' : ''}`}>
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-semibold text-text-primary">{tTerm('newAssociate.section.person')}</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={tTerm('newAssociate.field.name')}>
            <AppInput
              id="new-associate-name"
              variant="text"
              trimText
              maxLength={120}
              value={formData.name}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, name: value }))}
              placeholder={tTerm('newAssociate.placeholder.name')}
              required
            />
          </FormField>

          <FormField label={tTerm('newAssociate.field.status')}>
            <OperationalSelect
              id="new-associate-status"
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="active">{tTerm('common.status.active')}</option>
              <option value="inactive">{tTerm('common.status.inactive')}</option>
            </OperationalSelect>
          </FormField>

          <FormField label={tTerm('newAssociate.field.email')}>
            <AppInput
              id="new-associate-email"
              variant="text"
              inputMode="email"
              trimText
              maxLength={160}
              value={formData.email}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, email: value }))}
              placeholder={tTerm('newAssociate.placeholder.email')}
              required
            />
          </FormField>

          <FormField label={tTerm('newAssociate.field.phone')}>
            <AppInput
              id="new-associate-phone"
              variant="text"
              inputMode="tel"
              maxLength={40}
              value={formData.phone}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, phone: value }))}
              placeholder={tTerm('newAssociate.placeholder.phone')}
              required
            />
          </FormField>
          </div>

          <div className="border-t border-border-subtle pt-4">
            <h3 className="text-base font-semibold text-text-primary">{tTerm('newAssociate.section.deposit')}</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {!isEditing && (
              <FormField label={tTerm('newAssociate.field.initialCapital')} className="sm:col-span-2">
                <CurrencyInput
                  id="new-associate-initial-capital"
                  value={formData.initialCapital}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, initialCapital: value }))}
                  placeholder={tTerm('newAssociate.placeholder.initialCapital')}
                />
              </FormField>
            )}

            <FormField label={tTerm('newAssociate.field.interestType')}>
              <OperationalSelect
                id="new-associate-interest-type"
                value={formData.interestType}
                onChange={(e) => setFormData((prev) => ({ ...prev, interestType: e.target.value }))}
              >
                <option value="monthly">{tTerm('common.interestType.monthly')}</option>
                <option value="annual">{tTerm('common.interestType.annual')}</option>
              </OperationalSelect>
            </FormField>

            <FormField
              label={formData.interestType === 'annual' ? tTerm('newAssociate.field.interestRate.annual') : tTerm('newAssociate.field.interestRate.monthly')}
            >
              <PercentInput
                id="new-associate-interest-rate"
                allowZero
                maxDecimals={4}
                value={formData.interestRate}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, interestRate: value }))}
                placeholder={tTerm('newAssociate.placeholder.interestRate')}
              />
            </FormField>

            {formData.interestType === 'annual' && (
              <FormField label={tTerm('newAssociate.field.interestMonth')}>
                <OperationalSelect
                  id="new-associate-interest-month"
                  value={formData.interestPaymentMonth}
                  onChange={(e) => setFormData((prev) => ({ ...prev, interestPaymentMonth: e.target.value }))}
                >
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </OperationalSelect>
              </FormField>
            )}

            <FormField label={tTerm('newAssociate.field.interestDay')}>
              <OperationalSelect
                id="new-associate-interest-day"
                value={formData.interestPaymentDay}
                onChange={(e) => setFormData((prev) => ({ ...prev, interestPaymentDay: e.target.value }))}
              >
                {INTEREST_PAYMENT_DAY_OPTIONS.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </OperationalSelect>
            </FormField>
          </div>

          <div className="flex gap-3 pt-4">
            <ActionButton type="button" onClick={onBack} fullWidth>
              {tTerm('newAssociate.actions.cancel')}
            </ActionButton>
            <ActionButton
              type="submit"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              variant="primary"
              fullWidth
            >
              {isEditing ? tTerm('newAssociate.actions.save') : tTerm('newAssociate.actions.create')}
            </ActionButton>
          </div>
        </div>
      </SectionSurface>
  );

  if (embedded) {
    return form;
  }

  return (
    <PageShell className="associate-module-page associate-new-page mx-auto w-full max-w-3xl" data-tour="new-associate-page">
      <PageHeader
        title={title}
        subtitle={subtitle}
        tourId="new-associate-header"
        actions={(
          <ActionButton onClick={onBack} icon={<ArrowLeft size={16} />}>
            {tTerm('newAssociate.actions.back')}
          </ActionButton>
        )}
      />

      {form}
    </PageShell>
  );
}
