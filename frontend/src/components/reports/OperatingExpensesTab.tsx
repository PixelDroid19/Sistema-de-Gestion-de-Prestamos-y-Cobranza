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
  AppInput,
  FormField,
  OperationalSelect,
  StatusChip,
} from '../shared/Surfaces';
import OperatingExpenseCreateModal, { OperatingExpenseCreateTrigger } from './OperatingExpenseCreateModal';
import ReportDownloadModal, { ReportDownloadTrigger } from './ReportDownloadModal';
import { ReportDataTableSection } from './ReportDataTableSection';
import { RowActionsWithOverflow, TableActionsCell, TableActionsHeader } from '../shared/tables';
import { ReportTabPanel } from './ReportTabPanel';

type OperatingExpensesTabProps = {
  expenseFilters: OperatingExpenseFilters;
  onExpenseFiltersChange: (filters: OperatingExpenseFilters) => void;
  expensePage: number;
  expensePageSize: number;
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
  expensePageSize,
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

  return (
    <div className="report-tab-layout">
      <ReportTabPanel
        title={tTerm('reports.expenses.title')}
        subtitle={tTerm('reports.expenses.subtitle')}
        filterColumns={3}
        filters={(
          <>
            <FormField label={tTerm('reports.expenses.filter.from')}>
              <AppInput
                variant="date"
                value={expenseFilters.fromDate || ''}
                onValueChange={(v, _d, e) => updateExpenseDateFilter('fromDate', v)}
              />
            </FormField>
            <FormField label={tTerm('reports.expenses.filter.to')}>
              <AppInput
                variant="date"
                value={expenseFilters.toDate || ''}
                onValueChange={(v, _d, e) => updateExpenseDateFilter('toDate', v)}
              />
            </FormField>
            <FormField label={tTerm('reports.expenses.filter.status')}>
              <OperationalSelect
                value={expenseFilters.status || ''}
                onChange={(event) => {
                  onExpensePageChange(1);
                  onExpenseFiltersChange({ ...expenseFilters, status: event.target.value || undefined });
                }}
              >
                <option value="">{tTerm('credits.filter.all')}</option>
                <option value="completed">{tTerm('reports.expenses.status.completed')}</option>
                <option value="annulled">{tTerm('reports.expenses.status.annulled')}</option>
              </OperationalSelect>
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
        statePresentation="inline"
        recordsLabel={tTerm('reports.expenses.table.recordsLabel')}
        pagination={
          totalPages > 1
            ? {
              page: expensePage,
              pageSize: expensePageSize,
              totalItems,
              totalPages,
              onPrev: () => onExpensePageChange(Math.max(1, expensePage - 1)),
              onNext: () => onExpensePageChange(expensePage + 1),
            }
            : undefined
        }
      >
            <thead>
              <tr>
                <th>{tTerm('reports.expenses.table.date')}</th>
                <th>{tTerm('reports.expenses.table.category')}</th>
                <th>{tTerm('reports.expenses.table.description')}</th>
                <th>{tTerm('reports.expenses.table.amount')}</th>
                <th>{tTerm('reports.expenses.table.paymentMethod')}</th>
                <th>{tTerm('reports.expenses.table.status')}</th>
                <th>{tTerm('reports.expenses.table.createdBy')}</th>
                <TableActionsHeader>{tTerm('reports.expenses.table.actions')}</TableActionsHeader>
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
                      <TableActionsCell>
                        {canAnnul && !isAnnulled ? (
                          <RowActionsWithOverflow
                            variant="icon"
                            align="center"
                            ariaLabel={tTerm('reports.expenses.table.actions')}
                            items={[
                              {
                                id: 'annul',
                                label: tTerm('reports.expenses.cta.annul'),
                                icon: <Ban size={16} />,
                                onClick: () => { void onAnnulExpense(expense); },
                                disabled: annullingExpenseId === expense.id,
                                iconVariant: 'danger',
                                menuTone: 'danger',
                              },
                            ]}
                          />
                        ) : (
                          <span className="text-text-secondary">{tTerm('common.notAvailable')}</span>
                        )}
                      </TableActionsCell>
                    </tr>
                  );
                })
              )}
            </tbody>
      </ReportDataTableSection>
    </div>
  );
}
