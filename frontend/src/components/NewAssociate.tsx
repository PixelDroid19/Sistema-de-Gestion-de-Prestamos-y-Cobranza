import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { formatCurrency, formatDate } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { useAssociateById, useAssociates } from '../services/associateService';
import { parsePercentageWithPrecisionInput, parsePositiveMoneyInput } from '../lib/moneyInput';
import {
  calculatePeriodicReturn,
  getDefaultFirstPaymentDate,
  getFirstPaymentDateBounds,
  getNextConfiguredPaymentDate,
  isFirstPaymentDateWithinBounds,
  parseFirstPaymentTerms,
  type AssociateInterestType,
} from '../lib/associateCreationTerms';
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
  interestType: AssociateInterestType;
  interestRate: string;
  firstPaymentDate: string;
}

type AssociateMutationPayload = {
  name: string;
  email: string;
  phone: string;
  status: string;
  interestType: AssociateInterestType;
  interestRate: string;
  interestPaymentDay: string;
  interestPaymentMonth: string;
  initialCapital?: string;
};

type AssociateFormErrors = Partial<Record<'initialCapital' | 'interestRate' | 'firstPaymentDate', string>>;

interface NewAssociateProps {
  onBack: () => void;
  associateIdOverride?: number;
  embedded?: boolean;
}

const createEmptyForm = (): AssociateFormData => ({
  name: '',
  email: '',
  phone: '',
  status: 'active',
  initialCapital: '',
  interestType: 'annual',
  interestRate: '',
  firstPaymentDate: getDefaultFirstPaymentDate('annual'),
});

export default function NewAssociate({ onBack, associateIdOverride, embedded = false }: NewAssociateProps) {
  const { id } = useParams<{ id: string }>();
  const associateId = Number(associateIdOverride ?? id);
  const isEditing = Number.isFinite(associateId) && associateId > 0;

  const { createAssociate, updateAssociate } = useAssociates(undefined, { enabled: false });
  const { data: associateResponse, isLoading: isLoadingAssociate, isError: isAssociateLoadError } = useAssociateById(associateId);
  const existingAssociate = associateResponse?.data?.associate || null;
  const [formData, setFormData] = useState<AssociateFormData>(createEmptyForm);
  const [fieldErrors, setFieldErrors] = useState<AssociateFormErrors>({});

  useEffect(() => {
    if (!isEditing || !existingAssociate) {
      return;
    }

    const interestType: AssociateInterestType = existingAssociate.interestType === 'monthly' ? 'monthly' : 'annual';
    setFormData({
      name: existingAssociate.name || '',
      email: existingAssociate.email || '',
      phone: existingAssociate.phone || '',
      status: existingAssociate.status || 'active',
      initialCapital: '',
      interestType,
      interestRate: existingAssociate.interestRate != null && existingAssociate.interestRate !== ''
        ? String(Number(existingAssociate.interestRate))
        : '',
      firstPaymentDate: getNextConfiguredPaymentDate({
        interestType,
        paymentDay: Number(existingAssociate.interestPaymentDay || 1),
        paymentMonth: Number(existingAssociate.interestPaymentMonth || 1),
      }),
    });
  }, [existingAssociate, isEditing]);

  const { isSubmitting, run } = useCreateEntitySubmit<AssociateMutationPayload>({
    mutate: (payload) => {
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
  const firstPaymentBounds = getFirstPaymentDateBounds(formData.interestType);
  const capitalAmount = parsePositiveMoneyInput(formData.initialCapital) ?? 0;
  const parsedRate = parsePercentageWithPrecisionInput(formData.interestRate, 4);
  const interestRate = parsedRate ?? 0;
  const periodicReturn = calculatePeriodicReturn(capitalAmount, interestRate);
  const hasReturnPreview = capitalAmount > 0 && interestRate > 0;

  const clearFieldError = (field: keyof AssociateFormErrors) => {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const selectInterestType = (interestType: AssociateInterestType) => {
    setFormData((current) => ({
      ...current,
      interestType,
      firstPaymentDate: getDefaultFirstPaymentDate(interestType),
    }));
    clearFieldError('firstPaymentDate');
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!formData.name.trim()) {
      toast.error({ title: tTerm('newAssociate.validation.nameRequired') });
      return;
    }

    if (!formData.email.trim() || !formData.phone.trim()) {
      toast.error({ title: tTerm('newAssociate.validation.contactRequired') });
      return;
    }

    const nextErrors: AssociateFormErrors = {};
    const initialCapital = parsePositiveMoneyInput(formData.initialCapital);
    if (!isEditing && initialCapital === null) {
      nextErrors.initialCapital = tTerm('newAssociate.validation.initialCapitalRequired');
    }

    if (parsedRate === null || parsedRate <= 0) {
      nextErrors.interestRate = tTerm('newAssociate.validation.rateRange');
    }

    const paymentTerms = parseFirstPaymentTerms(formData.firstPaymentDate);
    if (!paymentTerms || !isFirstPaymentDateWithinBounds(formData.firstPaymentDate, formData.interestType)) {
      nextErrors.firstPaymentDate = tTerm('newAssociate.validation.firstPaymentDate');
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !paymentTerms) {
      return;
    }

    const payload: AssociateMutationPayload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      status: isEditing ? formData.status : 'active',
      interestType: formData.interestType,
      interestRate: String(parsedRate),
      interestPaymentDay: paymentTerms.day,
      interestPaymentMonth: formData.interestType === 'annual' ? paymentTerms.month : '1',
    };

    if (!isEditing && initialCapital !== null) {
      payload.initialCapital = String(initialCapital);
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
    <SectionSurface
      as="form"
      onSubmit={handleSubmit}
      noValidate
      data-tour="new-associate-form"
      className={`associate-form ${embedded ? 'border-0 bg-transparent p-0 shadow-none' : ''}`}
    >
      <div className="associate-form__body">
        <div className="associate-form__section">
          <h3 className="text-base font-semibold text-text-primary">{tTerm('newAssociate.section.person')}</h3>
          <div className={`associate-contact-grid ${isEditing ? 'associate-contact-grid--editing' : ''}`}>
            <FormField label={tTerm('newAssociate.field.name')}>
              <AppInput
                id="new-associate-name"
                variant="text"
                trimText
                maxLength={120}
                value={formData.name}
                onValueChange={(value) => setFormData((current) => ({ ...current, name: value }))}
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
                onValueChange={(value) => setFormData((current) => ({ ...current, email: value }))}
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
                onValueChange={(value) => setFormData((current) => ({ ...current, phone: value }))}
                placeholder={tTerm('newAssociate.placeholder.phone')}
                required
              />
            </FormField>

            {isEditing ? (
              <FormField label={tTerm('newAssociate.field.status')}>
                <OperationalSelect
                  id="new-associate-status"
                  value={formData.status}
                  onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="active">{tTerm('common.status.active')}</option>
                  <option value="inactive">{tTerm('common.status.inactive')}</option>
                </OperationalSelect>
              </FormField>
            ) : null}
          </div>
        </div>

        <div className="associate-form__section">
          <h3 className="text-base font-semibold text-text-primary">{tTerm('newAssociate.section.deposit')}</h3>
          <div className="associate-terms-grid">
            {!isEditing ? (
              <FormField
                label={tTerm('newAssociate.field.initialCapital')}
                error={fieldErrors.initialCapital}
                className="associate-terms-grid__capital"
              >
                <CurrencyInput
                  id="new-associate-initial-capital"
                  value={formData.initialCapital}
                  onValueChange={(value) => {
                    setFormData((current) => ({ ...current, initialCapital: value }));
                    clearFieldError('initialCapital');
                  }}
                  placeholder={tTerm('newAssociate.placeholder.initialCapital')}
                  invalid={Boolean(fieldErrors.initialCapital)}
                />
              </FormField>
            ) : null}

            <fieldset className="associate-frequency">
              <legend className="form-field-label">{tTerm('newAssociate.field.interestType')}</legend>
              <div className="associate-frequency__options">
                {(['annual', 'monthly'] as const).map((interestType) => (
                  <label
                    key={interestType}
                    className={`associate-frequency__option ${formData.interestType === interestType ? 'associate-frequency__option--selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="associate-interest-type"
                      value={interestType}
                      checked={formData.interestType === interestType}
                      onChange={() => selectInterestType(interestType)}
                    />
                    <span>{interestType === 'annual' ? tTerm('common.interestType.annual') : tTerm('common.interestType.monthly')}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <FormField
              label={formData.interestType === 'annual'
                ? tTerm('newAssociate.field.interestRate.annual')
                : tTerm('newAssociate.field.interestRate.monthly')}
              error={fieldErrors.interestRate}
            >
              <PercentInput
                id="new-associate-interest-rate"
                maxDecimals={4}
                value={formData.interestRate}
                onValueChange={(value) => {
                  setFormData((current) => ({ ...current, interestRate: value }));
                  clearFieldError('interestRate');
                }}
                placeholder={tTerm('newAssociate.placeholder.interestRate')}
                invalid={Boolean(fieldErrors.interestRate)}
              />
            </FormField>

            <FormField
              label={tTerm('newAssociate.field.firstPaymentDate')}
              error={fieldErrors.firstPaymentDate}
            >
              <AppInput
                id="new-associate-first-payment"
                variant="date"
                value={formData.firstPaymentDate}
                min={firstPaymentBounds.min}
                max={firstPaymentBounds.max}
                onValueChange={(value) => {
                  setFormData((current) => ({ ...current, firstPaymentDate: value }));
                  clearFieldError('firstPaymentDate');
                }}
                invalid={Boolean(fieldErrors.firstPaymentDate)}
              />
            </FormField>
          </div>
        </div>

        <div className="associate-form-actions">
          <div className="associate-return-preview" aria-live="polite" data-tour="new-associate-preview">
            <p className="associate-return-preview__value">
              {hasReturnPreview
                ? tTerm(
                  formData.interestType === 'annual'
                    ? 'newAssociate.preview.returnAnnual'
                    : 'newAssociate.preview.returnMonthly',
                  { amount: formatCurrency(periodicReturn) },
                )
                : tTerm('newAssociate.preview.pending')}
            </p>
            <p className="associate-return-preview__date">
              {tTerm('newAssociate.preview.firstPayment', {
                date: formatDate(formData.firstPaymentDate, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                }),
              })}
            </p>
          </div>

          <div className="associate-form-actions__buttons">
            {embedded ? (
              <ActionButton type="button" onClick={onBack}>
                {tTerm('newAssociate.actions.cancel')}
              </ActionButton>
            ) : null}
            <ActionButton
              type="submit"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              variant="primary"
            >
              {isEditing ? tTerm('newAssociate.actions.save') : tTerm('newAssociate.actions.create')}
            </ActionButton>
          </div>
        </div>
      </div>
    </SectionSurface>
  );

  if (embedded) {
    return form;
  }

  return (
    <PageShell className="associate-module-page associate-new-page mx-auto w-full max-w-5xl" data-tour="new-associate-page">
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
