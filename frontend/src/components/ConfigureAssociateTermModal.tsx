import React, { useState } from 'react';
import { parseInvestmentTermMonths } from '../lib/associateCreationTerms';
import { tTerm } from '../i18n/terminology';
import {
  ActionButton,
  AppInput,
  FormField,
  ModalShell,
} from './shared/Surfaces';

interface ConfigureAssociateTermModalProps {
  onClose: () => void;
  onSubmit: (investmentTermMonths: number) => Promise<void>;
}

export default function ConfigureAssociateTermModal({
  onClose,
  onSubmit,
}: ConfigureAssociateTermModalProps) {
  const [investmentTermMonths, setInvestmentTermMonths] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedTerm = parseInvestmentTermMonths(investmentTermMonths);
    if (parsedTerm === null) {
      setError(tTerm('associateDetails.configureTerm.validation'));
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit(parsedTerm);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={tTerm('associateDetails.configureTerm.title')}
      subtitle={tTerm('associateDetails.configureTerm.subtitle')}
      maxWidthClassName="max-w-lg"
      onClose={isSubmitting ? undefined : onClose}
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label={tTerm('associateDetails.configureTerm.field')}
          htmlFor="associate-investment-term-months"
          error={error || undefined}
        >
          <AppInput
            id="associate-investment-term-months"
            variant="integer"
            minValue={1}
            maxValue={120}
            maxDigits={3}
            value={investmentTermMonths}
            onValueChange={(value) => {
              setInvestmentTermMonths(value);
              if (error) {
                setError('');
              }
            }}
            placeholder={tTerm('associateDetails.configureTerm.placeholder')}
            invalid={Boolean(error)}
            required
            autoFocus
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <ActionButton type="button" onClick={onClose} disabled={isSubmitting}>
            {tTerm('associateDetails.configureTerm.cancel')}
          </ActionButton>
          <ActionButton type="submit" variant="primary" disabled={isSubmitting} isLoading={isSubmitting}>
            {tTerm('associateDetails.configureTerm.submit')}
          </ActionButton>
        </div>
      </form>
    </ModalShell>
  );
}
