import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { formatCurrency as formatCurrencyValue, formatDate as formatDateValue, formatNumber } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { parsePositiveMoneyInput } from '../lib/moneyInput';
import { toast } from '../lib/toast';
import { ActionButton, EmptyState, FormField, ModalShell, SectionSurface, TextInput } from './shared/Surfaces';

interface Contribution {
  id: number;
  amount: number;
  date?: string;
  contributionDate?: string;
  displayAmount?: string;
  interestRateSnapshot?: number | string | null;
  interestTypeSnapshot?: 'monthly' | 'annual' | string | null;
  notes?: string;
}

interface ContributionModalProps {
  contributions: Contribution[] | undefined;
  isLoading: boolean;
  onAddContribution: (data: { amount: number; contributionDate: string }) => Promise<void>;
  onClose: () => void;
  canAddContribution?: boolean;
}

const formatContributionDate = (value: unknown) => formatDateValue(value) || '-';

const formatContributionTerms = (contribution: Contribution) => {
  const rate = Number(contribution.interestRateSnapshot);
  if (!Number.isFinite(rate)) {
    return null;
  }

  const interestTypeKey = contribution.interestTypeSnapshot === 'annual'
    ? 'common.interestType.annual'
    : 'common.interestType.monthly';

  return tTerm('contributionModal.history.rateSnapshot', {
    rate: formatNumber(rate, { maximumFractionDigits: 4 }),
    interestType: tTerm(interestTypeKey).toLowerCase(),
  });
};

export default function ContributionModal({
  contributions,
  isLoading,
  onAddContribution,
  onClose,
  canAddContribution = true,
}: ContributionModalProps) {
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parsePositiveMoneyInput(amount);
    if (parsedAmount === null) return;

    setIsSubmitting(true);
    try {
      await onAddContribution({
        amount: parsedAmount,
        contributionDate: new Date().toISOString(),
      });
      setAmount('');
      setShowAddForm(false);
      toast.success({ title: tTerm('contributionModal.toast.success') });
    } catch (error) {
      toast.error({ title: tTerm('contributionModal.toast.error') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={tTerm('contributionModal.title')}
      subtitle={tTerm('contributionModal.subtitle')}
      maxWidthClassName="max-w-lg"
      footer={(
        <ActionButton onClick={onClose} fullWidth>
          {tTerm('contributionModal.action.close')}
        </ActionButton>
      )}
    >
      {canAddContribution && !showAddForm && (
        <ActionButton
          onClick={() => setShowAddForm(true)}
          variant="primary"
          fullWidth
          icon={<Plus size={16} />}
          className="mb-4"
        >
          {tTerm('contributionModal.action.new')}
        </ActionButton>
      )}

      {canAddContribution && showAddForm && (
        <SectionSurface
          as="form"
          onSubmit={handleSubmit}
          className="mb-4"
          title={tTerm('contributionModal.form.title')}
          bodyClassName="space-y-3"
        >
          <FormField
            label={tTerm('contributionModal.form.amount')}
            htmlFor="new-contribution-amount"
            tooltip={tTerm('contributionModal.form.amountTooltip')}
          >
            <TextInput
              id="new-contribution-amount"
              type="number"
              required
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </FormField>
          <div className="flex gap-2">
            <ActionButton
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAmount('');
              }}
              fullWidth
            >
              {tTerm('contributionModal.form.cancel')}
            </ActionButton>
            <ActionButton
              type="submit"
              disabled={isSubmitting}
              variant="primary"
              fullWidth
            >
              {isSubmitting ? tTerm('contributionModal.form.submitting') : tTerm('contributionModal.form.submit')}
            </ActionButton>
          </div>
        </SectionSurface>
      )}

      {isLoading ? (
        <EmptyState compact title={tTerm('contributionModal.state.loading')} />
      ) : contributions && contributions.length > 0 ? (
        <div className="space-y-2">
          {contributions.map((contribution) => {
            const contributionTerms = formatContributionTerms(contribution);

            return (
              <SectionSurface
                key={contribution.id}
                className="rounded-lg"
                bodyClassName="flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-text-primary">
                    {contribution.displayAmount || formatCurrencyValue(contribution.amount)}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {formatContributionDate(contribution.date ?? contribution.contributionDate)}
                  </p>
                  {contributionTerms && (
                    <p className="mt-1 text-xs font-medium text-text-secondary">
                      {contributionTerms}
                    </p>
                  )}
                  {contribution.notes && (
                    <p className="text-xs text-text-secondary mt-1">{contribution.notes}</p>
                  )}
                </div>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                  {tTerm('contributionModal.state.completed')}
                </span>
              </SectionSurface>
            );
          })}
        </div>
      ) : (
        <EmptyState title={tTerm('contributionModal.state.empty')} />
      )}
    </ModalShell>
  );
}
