import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { tTerm } from '../i18n/terminology';
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

const isValidDateOnly = (value: string) => {
  if (!value.trim()) return true;
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

export default function NewAssociate({ onBack }: NewAssociateProps) {
  const { id } = useParams<{ id: string }>();
  const associateId = Number(id);
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

    const interestRate = Number(formData.interestRate);
    if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100) {
      toast.error({ title: tTerm('newAssociate.validation.rateRange') });
      return;
    }

    const paymentDay = Number(formData.interestPaymentDay);
    if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 28) {
      toast.error({ title: tTerm('newAssociate.validation.dayRange') });
      return;
    }

    if (!isValidDateOnly(formData.interestStartDate)) {
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

      <SectionSurface as="form" onSubmit={handleSubmit} data-tour="new-associate-form">
        <div className="space-y-4">
          <FormField label={tTerm('newAssociate.field.name')}>
            <TextInput
              id="new-associate-name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={tTerm('newAssociate.placeholder.name')}
            />
          </FormField>

          <FormField label={tTerm('newAssociate.field.email')}>
            <TextInput
              id="new-associate-email"
              type="text"
              inputMode="email"
              required
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder={tTerm('newAssociate.placeholder.email')}
            />
          </FormField>

          <FormField label={tTerm('newAssociate.field.phone')}>
            <TextInput
              id="new-associate-phone"
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder={tTerm('newAssociate.placeholder.phone')}
            />
          </FormField>

          <FormField label={tTerm('newAssociate.field.status')}>
            <SelectInput
              id="new-associate-status"
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="active">{tTerm('common.status.active')}</option>
              <option value="inactive">{tTerm('common.status.inactive')}</option>
            </SelectInput>
          </FormField>

          <FormField
            label={tTerm('newAssociate.field.participation')}
            helper={tTerm('newAssociate.helper.participation')}
          >
            <TextInput
              id="new-associate-participation"
              type="number"
              min="0"
              max="100"
              step="0.0001"
              value={formData.participationPercentage}
              onChange={(e) => setFormData((prev) => ({ ...prev, participationPercentage: e.target.value }))}
              placeholder={tTerm('newAssociate.placeholder.participation')}
            />
          </FormField>

          <div className="grid gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2">
            {!isEditing && (
              <FormField
                label={tTerm('newAssociate.field.initialCapital')}
                helper={tTerm('newAssociate.helper.initialCapital')}
              >
                <TextInput
                  id="new-associate-initial-capital"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.initialCapital}
                  onChange={(e) => setFormData((prev) => ({ ...prev, initialCapital: e.target.value }))}
                  placeholder={tTerm('newAssociate.placeholder.initialCapital')}
                />
              </FormField>
            )}

            <FormField
              label={tTerm('newAssociate.field.interestType')}
              helper={tTerm('newAssociate.helper.interestType')}
            >
              <SelectInput
                id="new-associate-interest-type"
                value={formData.interestType}
                onChange={(e) => setFormData((prev) => ({ ...prev, interestType: e.target.value }))}
              >
                <option value="monthly">{tTerm('common.interestType.monthly')}</option>
                <option value="annual">{tTerm('common.interestType.annual')}</option>
              </SelectInput>
            </FormField>

            <FormField
              label={formData.interestType === 'annual' ? tTerm('newAssociate.field.interestRate.annual') : tTerm('newAssociate.field.interestRate.monthly')}
              helper={tTerm('newAssociate.helper.interestRate')}
            >
              <TextInput
                id="new-associate-interest-rate"
                type="number"
                min="0"
                max="100"
                step="0.0001"
                value={formData.interestRate}
                onChange={(e) => setFormData((prev) => ({ ...prev, interestRate: e.target.value }))}
                placeholder={tTerm('newAssociate.placeholder.interestRate')}
              />
            </FormField>

            {formData.interestType === 'annual' && (
              <FormField label={tTerm('newAssociate.field.interestMonth')} helper={tTerm('newAssociate.helper.interestMonth')}>
                <SelectInput
                  id="new-associate-interest-month"
                  value={formData.interestPaymentMonth}
                  onChange={(e) => setFormData((prev) => ({ ...prev, interestPaymentMonth: e.target.value }))}
                >
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </SelectInput>
              </FormField>
            )}

            <FormField label={tTerm('newAssociate.field.interestDay')} helper={tTerm('newAssociate.helper.interestDay')}>
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

            <FormField label={tTerm('newAssociate.field.interestStartDate')} helper={tTerm('newAssociate.helper.interestStartDate')}>
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
    </PageShell>
  );
}
