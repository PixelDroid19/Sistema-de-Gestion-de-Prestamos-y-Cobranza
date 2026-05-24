import { useState, type FormEvent } from 'react';
import { Ban, FileSpreadsheet, FileText, Plus, ReceiptText } from 'lucide-react';
import { formatCurrency as formatCurrencyValue, formatDate as formatDateValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import type {
  OperatingExpense,
  OperatingExpenseExportFormat,
  OperatingExpenseFilters,
  OperatingExpensePayload,
} from '../../services/reportService';
import {
  ActionButton,
  DataTableSurface,
  FormField,
  IconActionButton,
  SelectInput,
  StatusChip,
  TextAreaInput,
  TextInput,
  ToolbarSurface,
} from '../shared/Surfaces';

type OperatingExpensesTabProps = {
  expenseFilters: OperatingExpenseFilters;
  onExpenseFiltersChange: (filters: OperatingExpenseFilters) => void;
  expensePage: number;
  onExpensePageChange: (page: number) => void;
  expenses: OperatingExpense[];
  pagination: { totalPages?: number; totalItems?: number } | null;
  isLoading: boolean;
  canCreate: boolean;
  canAnnul: boolean;
  isCreating: boolean;
  annullingExpenseId: number | null;
  exportingFormat: OperatingExpenseExportFormat | null;
  onCreateExpense: (payload: OperatingExpensePayload) => Promise<void>;
  onAnnulExpense: (expense: OperatingExpense) => Promise<void>;
  onExportExpenses: (format: OperatingExpenseExportFormat) => Promise<void>;
};

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

const getExpenseStatusLabel = (status: string) => (
  status === 'annulled'
    ? tTerm('reports.expenses.status.annulled')
    : tTerm('reports.expenses.status.completed')
);

const getExpenseStatusTone = (status: string) => (
  status === 'annulled' ? 'danger' : 'success'
) as 'danger' | 'success';

const formatMoney = (value: unknown) => formatCurrencyValue(value);

export default function OperatingExpensesTab({
  expenseFilters,
  onExpenseFiltersChange,
  expensePage,
  onExpensePageChange,
  expenses,
  pagination,
  isLoading,
  canCreate,
  canAnnul,
  isCreating,
  annullingExpenseId,
  exportingFormat,
  onCreateExpense,
  onAnnulExpense,
  onExportExpenses,
}: OperatingExpensesTabProps) {
  const [form, setForm] = useState(initialForm);

  const handleFormChange = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateExpenseDateFilter = (key: 'fromDate' | 'toDate', value: string) => {
    if (key === 'fromDate' && value && expenseFilters.toDate && value > expenseFilters.toDate) {
      return;
    }
    if (key === 'toDate' && value && expenseFilters.fromDate && value < expenseFilters.fromDate) {
      return;
    }

    onExpensePageChange(1);
    onExpenseFiltersChange({ ...expenseFilters, [key]: value || undefined });
  };

  const handleSubmit = async (event: FormEvent<HTMLElement>) => {
    event.preventDefault();

    await onCreateExpense({
      amount: Number(form.amount),
      expenseDate: form.expenseDate,
      category: form.category.trim(),
      description: form.description.trim(),
      paymentMethod: normalizeOptional(form.paymentMethod),
      reference: normalizeOptional(form.reference),
      notes: normalizeOptional(form.notes),
    });
    setForm(initialForm);
  };

  const totalPages = Math.max(Number(pagination?.totalPages || 1), 1);
  const totalItems = Number(pagination?.totalItems || expenses.length || 0);
  const hasNextPage = expensePage < totalPages;
  const hasPreviousPage = expensePage > 1;

  return (
    <div className="flex flex-col gap-6">
      <ToolbarSurface className="items-stretch lg:items-end">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-text-primary">{tTerm('reports.expenses.title')}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {tTerm('reports.expenses.subtitle')}
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label={tTerm('reports.expenses.filter.from')}>
            <TextInput
              type="date"
              value={expenseFilters.fromDate || ''}
              onChange={(event) => updateExpenseDateFilter('fromDate', event.target.value)}
            />
          </FormField>
          <FormField label={tTerm('reports.expenses.filter.to')}>
            <TextInput
              type="date"
              value={expenseFilters.toDate || ''}
              onChange={(event) => updateExpenseDateFilter('toDate', event.target.value)}
            />
          </FormField>
          <FormField label={tTerm('reports.expenses.filter.status')}>
            <SelectInput
              value={expenseFilters.status || ''}
              onChange={(event) => {
                onExpensePageChange(1);
                onExpenseFiltersChange({ ...expenseFilters, status: event.target.value || undefined });
              }}
            >
              <option value="">{tTerm('credits.filter.all')}</option>
              <option value="completed">{tTerm('reports.expenses.status.completed')}</option>
              <option value="annulled">{tTerm('reports.expenses.status.annulled')}</option>
            </SelectInput>
          </FormField>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ActionButton
            type="button"
            icon={<FileSpreadsheet size={16} />}
            disabled={exportingFormat !== null}
            onClick={() => { void onExportExpenses('xlsx'); }}
          >
            {exportingFormat === 'xlsx'
              ? tTerm('reports.expenses.cta.exportingExcel')
              : tTerm('reports.expenses.cta.exportExcel')}
          </ActionButton>
          <ActionButton
            type="button"
            icon={<FileText size={16} />}
            disabled={exportingFormat !== null}
            onClick={() => { void onExportExpenses('pdf'); }}
          >
            {exportingFormat === 'pdf'
              ? tTerm('reports.expenses.cta.exportingPdf')
              : tTerm('reports.expenses.cta.exportPdf')}
          </ActionButton>
        </div>
      </ToolbarSurface>

      {canCreate && (
        <ToolbarSurface as="form" className="settings-config-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-4">
            <FormField label={tTerm('reports.expenses.form.amount')}>
              <TextInput
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => handleFormChange('amount', event.target.value)}
                required
              />
            </FormField>
            <FormField label={tTerm('reports.expenses.form.date')}>
              <TextInput
                type="date"
                value={form.expenseDate}
                onChange={(event) => handleFormChange('expenseDate', event.target.value)}
                required
              />
            </FormField>
            <FormField label={tTerm('reports.expenses.form.category')}>
              <TextInput
                value={form.category}
                onChange={(event) => handleFormChange('category', event.target.value)}
                required
              />
            </FormField>
            <FormField label={tTerm('reports.expenses.form.paymentMethod')}>
              <TextInput
                value={form.paymentMethod}
                onChange={(event) => handleFormChange('paymentMethod', event.target.value)}
              />
            </FormField>
            <FormField label={tTerm('reports.expenses.form.description')} className="lg:col-span-2">
              <TextInput
                value={form.description}
                onChange={(event) => handleFormChange('description', event.target.value)}
                required
              />
            </FormField>
            <FormField label={tTerm('reports.expenses.form.reference')}>
              <TextInput
                value={form.reference}
                onChange={(event) => handleFormChange('reference', event.target.value)}
              />
            </FormField>
            <div className="flex min-w-0 flex-col">
              <span className="form-field-label invisible select-none" aria-hidden="true">
                {tTerm('reports.expenses.cta.create')}
              </span>
              <ActionButton
                variant="primary"
                type="submit"
                disabled={isCreating}
                icon={<Plus size={16} />}
                className="h-10 min-h-10"
              >
                {isCreating ? tTerm('reports.expenses.cta.creating') : tTerm('reports.expenses.cta.create')}
              </ActionButton>
            </div>
            <FormField label={tTerm('reports.expenses.form.notes')} className="lg:col-span-4">
              <TextAreaInput
                value={form.notes}
                onChange={(event) => handleFormChange('notes', event.target.value)}
              />
            </FormField>
          </div>
        </ToolbarSurface>
      )}

      <DataTableSurface>
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h3 className="font-medium">{tTerm('reports.expenses.table.title')}</h3>
            <p className="mt-1 text-sm text-text-secondary">
              {tTerm('reports.expenses.table.subtitle')}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <ReceiptText size={16} aria-hidden="true" />
            {tTerm('reports.expenses.pagination.summary', { total: totalItems })}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>{tTerm('reports.expenses.table.date')}</th>
                <th>{tTerm('reports.expenses.table.category')}</th>
                <th>{tTerm('reports.expenses.table.description')}</th>
                <th>{tTerm('reports.expenses.table.amount')}</th>
                <th>{tTerm('reports.expenses.table.paymentMethod')}</th>
                <th>{tTerm('reports.expenses.table.status')}</th>
                <th>{tTerm('reports.expenses.table.createdBy')}</th>
                <th>{tTerm('reports.expenses.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="table-empty-state">{tTerm('reports.expenses.table.loading')}</td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty-state">{tTerm('reports.expenses.table.empty')}</td>
                </tr>
              ) : (
                expenses.map((expense) => {
                  const isAnnulled = expense.status === 'annulled';
                  return (
                    <tr key={expense.id}>
                      <td>{formatDateValue(expense.expenseDate, { dateStyle: 'medium', timeZone: 'UTC' }) || tTerm('common.notAvailable')}</td>
                      <td className="font-medium">{expense.category}</td>
                      <td>{expense.description}</td>
                      <td className={isAnnulled ? 'text-text-secondary line-through' : 'font-semibold text-rose-600'}>
                        {formatMoney(expense.amount)}
                      </td>
                      <td>{expense.paymentMethod || tTerm('common.notAvailable')}</td>
                      <td>
                        <StatusChip tone={getExpenseStatusTone(expense.status)} size="sm">
                          {getExpenseStatusLabel(expense.status)}
                        </StatusChip>
                      </td>
                      <td>{expense.createdBy?.name || tTerm('common.notAvailable')}</td>
                      <td>
                        {canAnnul && !isAnnulled ? (
                          <IconActionButton
                            label={tTerm('reports.expenses.cta.annulWithId', { id: expense.id })}
                            icon={<Ban size={16} />}
                            variant="danger"
                            disabled={annullingExpenseId === expense.id}
                            onClick={() => { void onAnnulExpense(expense); }}
                          />
                        ) : (
                          <span className="text-text-secondary">{tTerm('common.notAvailable')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm text-text-secondary">
            {tTerm('reports.expenses.pagination.page', { page: expensePage, totalPages })}
          </p>
          <div className="flex gap-2">
            <ActionButton
              onClick={() => onExpensePageChange(Math.max(1, expensePage - 1))}
              disabled={!hasPreviousPage}
            >
              {tTerm('reports.payouts.pagination.previous')}
            </ActionButton>
            <ActionButton
              onClick={() => onExpensePageChange(expensePage + 1)}
              disabled={!hasNextPage}
            >
              {tTerm('reports.payouts.pagination.next')}
            </ActionButton>
          </div>
        </div>
      </DataTableSurface>
    </div>
  );
}
