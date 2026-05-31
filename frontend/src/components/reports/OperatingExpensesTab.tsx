import { useState } from 'react';
import { Ban } from 'lucide-react';
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
  FormField,
  IconActionButton,
  SelectInput,
  StatusChip,
  TextInput,
} from '../shared/Surfaces';
import OperatingExpenseCreateModal, { OperatingExpenseCreateTrigger } from './OperatingExpenseCreateModal';
import ReportDownloadModal, { ReportDownloadTrigger } from './ReportDownloadModal';
import { ReportDataTableSection } from './ReportDataTableSection';
import { ReportTabPanel } from './ReportTabPanel';

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
  onExportExpenses: (format: OperatingExpenseExportFormat) => boolean | Promise<boolean>;
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
  const [createOpen, setCreateOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

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

  const totalPages = Math.max(Number(pagination?.totalPages || 1), 1);
  const totalItems = Number(pagination?.totalItems || expenses.length || 0);
  const hasNextPage = expensePage < totalPages;
  const hasPreviousPage = expensePage > 1;

  return (
    <div className="report-tab-layout">
      <ReportTabPanel
        title={tTerm('reports.expenses.title')}
        subtitle={tTerm('reports.expenses.subtitle')}
        filterColumns={3}
        filters={(
          <>
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
          </>
        )}
        headerActions={(
          <>
            {canCreate && <OperatingExpenseCreateTrigger onClick={() => setCreateOpen(true)} />}
            <ReportDownloadTrigger
              onClick={() => setDownloadOpen(true)}
              disabled={exportingFormat !== null}
            />
          </>
        )}
      />

      {createOpen && canCreate && (
        <OperatingExpenseCreateModal
          onClose={() => setCreateOpen(false)}
          isCreating={isCreating}
          onCreateExpense={onCreateExpense}
        />
      )}

      {downloadOpen && (
        <ReportDownloadModal
          onClose={() => setDownloadOpen(false)}
          title={tTerm('reports.download.expenses.title')}
          subtitle={tTerm('reports.download.expenses.subtitle')}
          isExporting={exportingFormat !== null}
          formats={['xlsx', 'pdf']}
          onDownload={(format) => onExportExpenses(format === 'pdf' ? 'pdf' : 'xlsx')}
        />
      )}

      <ReportDataTableSection
        title={tTerm('reports.expenses.table.title')}
        subtitle={tTerm('reports.expenses.pagination.summary', { total: totalItems })}
      >
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
                            label={tTerm('reports.expenses.cta.annul')}
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
      </ReportDataTableSection>
    </div>
  );
}
