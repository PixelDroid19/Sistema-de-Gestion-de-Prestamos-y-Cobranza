import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { formatCurrency as formatCurrencyValue, formatDate as formatDateValue, formatNumber } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { parseFormattedPositiveMoneyInput } from '../lib/moneyInput';
import { toast } from '../lib/toast';
import {
  ActionButton,
  AppInput,
  CurrencyInput,
  EmptyState,
  FormField,
  ModalShell,
  OperationalSelect,
  SectionSurface,
  StatusChip,
} from './shared/Surfaces';

interface Contribution {
  id: number;
  amount: number;
  date?: string;
  contributionDate?: string;
  displayAmount?: string;
  status?: string;
  interestRateSnapshot?: number | string | null;
  interestTypeSnapshot?: 'monthly' | 'annual' | string | null;
  notes?: string;
}

interface ContributionModalProps {
  contributions: Contribution[] | undefined;
  isLoading: boolean;
  onAddContribution: (data: {
    amount: number;
    contributionDate: string;
    status: string;
    notes?: string;
  }) => Promise<void>;
  onClose: () => void;
  canAddContribution?: boolean;
  initialAddFormOpen?: boolean;
}

const formatContributionDate = (value: unknown) => formatDateValue(value) || '-';

const getTodayDateInputValue = () => {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
};

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

const getContributionStatusLabel = (status: unknown) => {
  switch (String(status || 'completed').toLowerCase()) {
    case 'pending':
      return tTerm('common.status.pending');
    case 'annulled':
      return tTerm('common.status.annulled');
    case 'manual_hold':
      return tTerm('common.status.manualHold');
    case 'completed':
      return tTerm('common.status.completed');
    default:
      return tTerm('common.status.unknown');
  }
};

const getContributionStatusTone = (status: unknown) => {
  switch (String(status || 'completed').toLowerCase()) {
    case 'pending':
      return 'warning';
    case 'annulled':
      return 'neutral';
    case 'manual_hold':
      return 'info';
    case 'completed':
      return 'success';
    default:
      return 'neutral';
  }
};

export default function ContributionModal({
  contributions,
  isLoading,
  onAddContribution,
  onClose,
  canAddContribution = true,
  initialAddFormOpen = false,
}: ContributionModalProps) {
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [contributionDate, setContributionDate] = useState(getTodayDateInputValue());
  const [status, setStatus] = useState('completed');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(initialAddFormOpen);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmount = amount.trim();
    if (!rawAmount) {
      setAmountError(tTerm('contributionModal.form.validation.amountRequired'));
      return;
    }

    const parsedAmount = parseFormattedPositiveMoneyInput(amount);
    if (parsedAmount === null) {
      setAmountError(tTerm('contributionModal.form.validation.amountInvalid'));
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddContribution({
        amount: parsedAmount,
        contributionDate,
        status,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setAmount('');
      setAmountError('');
      setContributionDate(getTodayDateInputValue());
      setStatus('completed');
      setNotes('');
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
      title={tTerm(showAddForm ? 'contributionModal.titleCreate' : 'contributionModal.title')}
      subtitle={tTerm(showAddForm ? 'contributionModal.subtitleCreate' : 'contributionModal.subtitle')}
      maxWidthClassName="max-w-lg"
      onClose={onClose}
      footer={(
        <ActionButton onClick={onClose} fullWidth>
          {tTerm('contributionModal.action.close')}
        </ActionButton>
      )}
    >
      {canAddContribution && !showAddForm && (
        <ActionButton
          onClick={() => {
            setAmountError('');
            setShowAddForm(true);
          }}
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
          noValidate
          className="mb-4"
          title={tTerm('contributionModal.form.title')}
          bodyClassName="space-y-3"
        >
          <FormField
            label={tTerm('contributionModal.form.amount')}
            htmlFor="new-contribution-amount"
            tooltip={tTerm('contributionModal.form.amountTooltip')}
            error={amountError || undefined}
          >
            <CurrencyInput
              id="new-contribution-amount"
              required
              value={amount}
              onValueChange={(value) => {
                setAmount(value);
                if (amountError) {
                  setAmountError('');
                }
              }}
              placeholder="0"
            />
          </FormField>
          <FormField
            label={tTerm('contributionModal.form.date')}
            htmlFor="new-contribution-date"
          >
            <AppInput
              id="new-contribution-date"
              variant="date"
              required
              value={contributionDate}
              onValueChange={(value) => setContributionDate(value)}
            />
          </FormField>
          <FormField
            label={tTerm('contributionModal.form.status')}
            htmlFor="new-contribution-status"
          >
            <OperationalSelect
              id="new-contribution-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="completed">{tTerm('common.status.completed')}</option>
              <option value="pending">{tTerm('common.status.pending')}</option>
              <option value="manual_hold">{tTerm('common.status.manualHold')}</option>
              <option value="annulled">{tTerm('common.status.annulled')}</option>
            </OperationalSelect>
          </FormField>
          <FormField
            label={tTerm('contributionModal.form.notes')}
            htmlFor="new-contribution-notes"
          >
            <div className="operational-control operational-control--textarea">
              <textarea
                id="new-contribution-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder={tTerm('contributionModal.form.notesPlaceholder')}
                className="operational-control-textarea"
              />
            </div>
          </FormField>
          <div className="flex gap-2">
            <ActionButton
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAmount('');
                setAmountError('');
                setContributionDate(getTodayDateInputValue());
                setStatus('completed');
                setNotes('');
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
                <StatusChip tone={getContributionStatusTone(contribution.status)} size="sm">
                  {getContributionStatusLabel(contribution.status)}
                </StatusChip>
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
