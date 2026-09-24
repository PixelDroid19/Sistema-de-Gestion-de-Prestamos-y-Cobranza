import { useState } from 'react';
import { tTerm } from '../../i18n/terminology';
import { isValidOperationalDateOnly } from '../../i18n/format';
import { parsePercentageWithPrecisionInput, parsePositiveIntegerInput, parsePositiveMoneyInput } from '../../lib/moneyInput';
import { getStandardFirstDueDate } from '../../lib/creditDueDates';
import { toast } from '../../lib/toast';
import { useCorrectLoanOrigination } from '../../services/loanService';
import { ActionButton, AppInput, FormField, ModalShell } from '../shared/Surfaces';

type LoanTerms = {
  id: number;
  amount: number | string;
  interestRate: number | string;
  termMonths: number;
  startDate: string;
  financialSnapshot?: { firstDueDate?: string | null };
};

export function LoanOriginationCorrectionModal({ loan, onClose }: { loan: LoanTerms; onClose: () => void }) {
  const correction = useCorrectLoanOrigination(loan.id);
  const [amount, setAmount] = useState(String(loan.amount));
  const [interestRate, setInterestRate] = useState(String(loan.interestRate));
  const [termMonths, setTermMonths] = useState(String(loan.termMonths));
  const [startDate, setStartDate] = useState(String(loan.startDate || '').slice(0, 10));
  const [firstDueDate, setFirstDueDate] = useState(String(loan.financialSnapshot?.firstDueDate || '').slice(0, 10));
  const [error, setError] = useState('');

  const save = async () => {
    const parsedAmount = parsePositiveMoneyInput(amount);
    const parsedRate = parsePercentageWithPrecisionInput(interestRate, 4);
    const parsedTerm = parsePositiveIntegerInput(termMonths);
    const standardFirstDueDate = getStandardFirstDueDate(startDate);
    if (parsedAmount === null || parsedRate === null || parsedTerm === null || parsedTerm > 360
      || !isValidOperationalDateOnly(startDate)
      || (firstDueDate !== '' && (!isValidOperationalDateOnly(firstDueDate)
        || (standardFirstDueDate && firstDueDate < standardFirstDueDate)))) {
      setError(tTerm('creditDetails.correction.invalid'));
      return;
    }
    setError('');
    try {
      await correction.mutateAsync({ amount: parsedAmount, interestRate: parsedRate, termMonths: parsedTerm, startDate, firstDueDate: firstDueDate || null });
      toast.success({ title: tTerm('creditDetails.correction.saved') });
      onClose();
    } catch (cause) {
      const apiError = cause as { statusCode?: number; message?: string };
      if (apiError?.statusCode === 400 && typeof apiError.message === 'string') {
        setError(apiError.message);
      } else {
        toast.apiErrorSafe(cause, { domain: 'credits', action: 'generic' });
      }
    }
  };

  return (
    <ModalShell title={tTerm('creditDetails.correction.title')} onClose={onClose}
      footer={<>
        <ActionButton onClick={onClose} disabled={correction.isPending}>{tTerm('common.cta.cancel')}</ActionButton>
        <ActionButton onClick={save} variant="primary" disabled={correction.isPending} isLoading={correction.isPending}>
          {tTerm('creditDetails.correction.save')}
        </ActionButton>
      </>}>
      <p className="mb-4 text-sm text-text-secondary">{tTerm('creditDetails.correction.note')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={tTerm('creditDetails.correction.amount')}>
          <AppInput variant="money" value={amount} onValueChange={setAmount} maxDecimals={2} />
        </FormField>
        <FormField label={tTerm('creditDetails.correction.rate')}>
          <AppInput variant="percent" value={interestRate} onValueChange={setInterestRate} maxDecimals={4} suffix="%" />
        </FormField>
        <FormField label={tTerm('creditDetails.correction.term')}>
          <AppInput variant="integer" value={termMonths} onValueChange={setTermMonths} />
        </FormField>
        <FormField label={tTerm('creditDetails.correction.date')}>
          <AppInput variant="date" aria-label={tTerm('creditDetails.correction.date')} value={startDate} onValueChange={setStartDate} />
        </FormField>
        <FormField label={tTerm('simulator.form.firstDueDate')} tooltip={tTerm('simulator.help.firstDueDate')}>
          <AppInput variant="date" aria-label={tTerm('simulator.form.firstDueDate')} value={firstDueDate} onValueChange={setFirstDueDate} />
        </FormField>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </ModalShell>
  );
}
