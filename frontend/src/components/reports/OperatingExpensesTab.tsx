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
  UserSearchSelect,
} from '../shared/Surfaces';
import OperatingExpenseCreateModal, { OperatingExpenseCreateTrigger } from './OperatingExpenseCreateModal';
import { ReportDownloadActions } from './ReportDownloadModal';
import { ReportDataTableSection } from './ReportDataTableSection';
import { RowActionsWithOverflow, TableActionsCell, TableActionsHeader } from '../shared/tables';
import { ReportTabPanel, type ReportActiveFilter } from './ReportTabPanel';

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
  canFilterByEmployee?: boolean;
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
  canFilterByEmployee = false,
}: OperatingExpensesTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');

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
  const activeFilterCount = Object.values(expenseFilters).filter(Boolean).length;
  const removeExpenseFilter = (key: keyof OperatingExpenseFilters) => {
    const nextFilters = { ...expenseFilters };
    delete nextFilters[key];
    onExpensePageChange(1);
    onExpenseFiltersChange(nextFilters);
    if (key === 'employeeId') setEmployeeSearchQuery('');
  };
  const activeFilters: ReportActiveFilter[] = [];
  if (expenseFilters.fromDate) activeFilters.push({ id: 'fromDate', label: tTerm('reports.expenses.filter.from'), value: expenseFilters.fromDate, onRemove: () => removeExpenseFilter('fromDate') });
  if (expenseFilters.toDate) activeFilters.push({ id: 'toDate', label: tTerm('reports.expenses.filter.to'), value: expenseFilters.toDate, onRemove: () => removeExpenseFilter('toDate') });
  if (expenseFilters.status) activeFilters.push({ id: 'status', label: tTerm('reports.expenses.filter.status'), value: getExpenseStatusLabel(expenseFilters.status), onRemove: () => removeExpenseFilter('status') });
  if (expenseFilters.employeeId) activeFilters.push({ id: 'employeeId', label: tTerm('reports.expenses.filter.employee'), value: tTerm('reports.filters.selectedValue'), onRemove: () => removeExpenseFilter('employeeId') });

  return (
    <div className="report-tab-layout">
      <ReportTabPanel
        title={tTerm('reports.expenses.title')}
        subtitle={tTerm('reports.expenses.subtitle')}
        filterColumns={canFilterByEmployee ? 4 : 3}
        activeFilterCount={activeFilterCount}
        activeFilters={activeFilters}
        onClearAllFilters={() => {
          setEmployeeSearchQuery('');
          onExpensePageChange(1);
          onExpenseFiltersChange({});
        }}
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
            {canFilterByEmployee && (
              <FormField label={tTerm('reports.expenses.filter.employee')}>
                <UserSearchSelect
                  id="reports-expenses-employee"
                  selectedUserId={expenseFilters.employeeId || ''}
                  searchValue={employeeSearchQuery}
                  onSearchValueChange={setEmployeeSearchQuery}
                  onSelectedUserIdChange={(value) => {
                    onExpensePageChange(1);
                    onExpenseFiltersChange({ ...expenseFilters, employeeId: value || undefined });
                  }}
                  placeholder={tTerm('userSearch.placeholder')}
                  listboxLabel={tTerm('reports.expenses.filter.employee')}
                  role="administrative"
                />
              </FormField>
            )}
          </>
        )}
        headerActions={(
          <>
            {canCreate && <OperatingExpenseCreateTrigger onClick={() => setCreateOpen(true)} />}
            <ReportDownloadActions
              isExporting={exportingFormat !== null}
              onDownload={(format) => onExportExpenses(format === 'pdf' ? 'pdf' : 'xlsx')}
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
