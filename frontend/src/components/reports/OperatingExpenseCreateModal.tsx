import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { parsePositiveMoneyInput } from '../../lib/moneyInput';
import type { OperatingExpensePayload } from '../../services/reportService';
import {
  ActionButton,
  FormField,
  ModalShell,
  AppInput,
  CurrencyInput,
} from '../shared/Surfaces';

const initialForm = {
  amount: '',
  expenseDate: '',
  category: '',
  description: '',
  paymentMethod: '',
  reference: '',
  notes: '',
};

const normalizeOptional = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

type OperatingExpenseCreateModalProps = {
  onClose: () => void;
  isCreating: boolean;
  onCreateExpense: (payload: OperatingExpensePayload) => Promise<void>;
};

export function OperatingExpenseCreateTrigger({ onClick }: { onClick: () => void }) {
  return (
    <ActionButton type="button" variant="primary" onClick={onClick} icon={<Plus size={16} />}>
      {tTerm('reports.expenses.cta.create')}
    </ActionButton>
  );
}

export default function OperatingExpenseCreateModal({
  onClose,
  isCreating,
  onCreateExpense,
}: OperatingExpenseCreateModalProps) {
  const [form, setForm] = useState(initialForm);

  const handleFormChange = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const amount = parsePositiveMoneyInput(form.amount);

    if (amount === null) {
      return;
    }

    await onCreateExpense({
      amount,
      expenseDate: form.expenseDate,
      category: form.category.trim(),
      description: form.description.trim(),
      paymentMethod: normalizeOptional(form.paymentMethod),
      reference: normalizeOptional(form.reference),
      notes: normalizeOptional(form.notes),
    });
    setForm(initialForm);
    onClose();
  };

  return (
    <ModalShell
      title={tTerm('reports.expenses.form.title')}
      subtitle={tTerm('reports.expenses.form.subtitle')}
      maxWidthClassName="max-w-xl"
      onClose={onClose}
      footer={(
        <>
          <ActionButton type="button" variant="ghost" onClick={onClose} disabled={isCreating}>
            {tTerm('common.cta.cancel')}
          </ActionButton>
          <ActionButton
            type="submit"
            form="operating-expense-create-form"
            variant="primary"
            disabled={isCreating}
            icon={<Plus size={16} />}
          >
            {isCreating ? tTerm('reports.expenses.cta.creating') : tTerm('reports.expenses.cta.create')}
          </ActionButton>
        </>
      )}
    >
      <form
        id="operating-expense-create-form"
        className="reports-expense-form"
        onSubmit={(event) => { void handleSubmit(event); }}
      >
        <div className="reports-expense-form__grid">
          <FormField label={tTerm('reports.expenses.form.amount')}>
            <CurrencyInput
              id="operating-expense-amount"
              aria-label={tTerm('reports.expenses.form.amount')}
              allowCents
              value={form.amount}
              onValueChange={(value) => handleFormChange('amount', value)}
              minValue={0.01}
              required
            />
          </FormField>
          <FormField label={tTerm('reports.expenses.form.date')}>
            <AppInput
              variant="date"
              value={form.expenseDate}
              onValueChange={(v) => handleFormChange('expenseDate', v)}
              required
            />
          </FormField>
          <FormField label={tTerm('reports.expenses.form.category')}>
            <AppInput
              variant="text"
              value={form.category}
              onValueChange={(v) => handleFormChange('category', v)}
              required
            />
          </FormField>
          <FormField label={tTerm('reports.expenses.form.paymentMethod')}>
            <AppInput
              variant="text"
              value={form.paymentMethod}
              onValueChange={(v) => handleFormChange('paymentMethod', v)}
            />
          </FormField>
          <FormField label={tTerm('reports.expenses.form.description')} className="sm:col-span-2">
            <AppInput
              variant="text"
              value={form.description}
              onValueChange={(v) => handleFormChange('description', v)}
              required
            />
          </FormField>
          <FormField label={tTerm('reports.expenses.form.reference')}>
            <AppInput
              variant="text"
              value={form.reference}
              onValueChange={(v) => handleFormChange('reference', v)}
            />
          </FormField>
          <FormField label={tTerm('reports.expenses.form.notes')} className="sm:col-span-2">
            <textarea
              value={form.notes}
              onChange={(event) => handleFormChange('notes', event.target.value)}
              className="operational-control-input w-full min-h-[72px] resize-y"
            />
          </FormField>
        </div>
      </form>
    </ModalShell>
  );
}
