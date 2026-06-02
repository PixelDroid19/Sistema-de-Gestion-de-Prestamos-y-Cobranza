import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { tTerm } from '../i18n/terminology';
import { isValidOperationalDateOnly } from '../i18n/format';
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
  SectionSurface,
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
  associateIdOverride?: number;
  embedded?: boolean;
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

export default function NewAssociate({ onBack, associateIdOverride, embedded = false }: NewAssociateProps) {
  const { id } = useParams<{ id: string }>();
  const associateId = Number(associateIdOverride ?? id);
  const isEditing = Number.isFinite(associateId) && associateId > 0;

  const { createAssociate, updateAssociate } = useAssociates();
  const { data: associateResponse, isLoading: isLoadingAssociate, isError: isAssociateLoadError } = useAssociateById(associateId);
  const existingAssociate = associateResponse?.data?.associate || associateResponse?.data || null;
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

    if (formData.participationPercentage.trim() && parsePercentageWithPrecisionInput(formData.participationPercentage, 4) === null) {
      toast.error({ title: tTerm('newAssociate.validation.participationRange') });
      return;
    }

    const interestRate = parsePercentageWithPrecisionInput(formData.interestRate, 4);
    if (interestRate === null) {
      toast.error({ title: tTerm('newAssociate.validation.rateRange') });
      return;
    }

    const paymentDay = parsePositiveIntegerInput(formData.interestPaymentDay);
    if (paymentDay === null || paymentDay > 28) {
      toast.error({ title: tTerm('newAssociate.validation.dayRange') });
      return;
    }

    if (formData.interestStartDate.trim() && !isValidOperationalDateOnly(formData.interestStartDate)) {
      toast.error({ title: tTerm('newAssociate.validation.startDate') });
      return;
    }

    await run(formData);
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
    <SectionSurface as="form" onSubmit={handleSubmit} data-tour="new-associate-form" className={embedded ? 'border-0 bg-transparent p-0 shadow-none' : ''}>
        <div className="space-y-4">
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

          <FormField
            label={tTerm('newAssociate.field.participation')}
            helper={tTerm('newAssociate.helper.participation')}
          >
            <AppInput
              id="new-associate-participation"
              variant="percent"
              allowZero
              maxDecimals={4}
              value={formData.participationPercentage}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, participationPercentage: value }))}
              placeholder={tTerm('newAssociate.placeholder.participation')}
            />
          </FormField>

          <div className="grid gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2">
            {!isEditing && (
              <FormField
                label={tTerm('newAssociate.field.initialCapital')}
                helper={tTerm('newAssociate.helper.initialCapital')}
              >
                <CurrencyInput
                  id="new-associate-initial-capital"
                  value={formData.initialCapital}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, initialCapital: value }))}
                  placeholder={tTerm('newAssociate.placeholder.initialCapital')}
                />
              </FormField>
            )}

            <FormField
              label={tTerm('newAssociate.field.interestType')}
              helper={tTerm('newAssociate.helper.interestType')}
            >
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
              helper={tTerm('newAssociate.helper.interestRate')}
            >
              <AppInput
                id="new-associate-interest-rate"
                variant="percent"
                allowZero
                maxDecimals={4}
                value={formData.interestRate}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, interestRate: value }))}
                placeholder={tTerm('newAssociate.placeholder.interestRate')}
              />
            </FormField>

            {formData.interestType === 'annual' && (
              <FormField label={tTerm('newAssociate.field.interestMonth')} helper={tTerm('newAssociate.helper.interestMonth')}>
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

            <FormField label={tTerm('newAssociate.field.interestDay')} helper={tTerm('newAssociate.helper.interestDay')}>
              <AppInput
                id="new-associate-interest-day"
                variant="integer"
                minValue={1}
                maxValue={28}
                value={formData.interestPaymentDay}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, interestPaymentDay: value }))}
              />
            </FormField>

            <FormField label={tTerm('newAssociate.field.interestStartDate')} helper={tTerm('newAssociate.helper.interestStartDate')}>
              <AppInput
                id="new-associate-interest-start-date"
                variant="date"
                value={formData.interestStartDate}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, interestStartDate: value }))}
              />
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
    <PageShell className="mx-auto w-full max-w-3xl" data-tour="new-associate-page">
      <PageHeader
        title={title}
        subtitle={subtitle}
        guideKey="new-associate"
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
