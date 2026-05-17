import React from 'react';
import {
  Search,
  Filter,
  Eye,
  Calendar as CalendarIcon,
  X,
  Clock,
  DollarSign,
  Users,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency as formatCurrencyValue, formatDate as formatLocaleDate, formatPercent } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { getChipClassName } from '../../constants/uiChips';
import { getLoanStatusTone } from '../../lib/statusTones';
import { resolveOperationalGuard } from '../../services/operationalGuards';
import {
  ActionButton,
  CheckboxInput,
  DataTableSurface,
  EmptyState,
  FormField,
  IconActionButton,
  InsightStrip,
  SectionSurface,
  SelectInput,
  TextInput,
  ToolbarSurface,
} from '../shared/Surfaces';
import { ExplainedChip, HelpLabel } from '../shared/HelpSupport';
import {
  getCreditLabel,
  getLoanStatusDescription,
  getLoanStatusLabel,
  getRecoveryStatusDescription,
  getRecoveryStatusLabel,
  getStatusColumnHelp,
  getRecoveryColumnHelp,
} from './creditsHelpers';

// ─── Props ────────────────────────────────────────────────────────────────────

type FilterState = {
  status: string;
  minAmount: string;
  maxAmount: string;
  startDate: string;
  endDate: string;
};

type DisplayedStatistics = {
  totalAmount: number;
  totalCollected: number;
  totalOverdue: number;
  activeCredits: number;
  totalCredits: number;
  helper: string;
};

type CreditsListViewProps = {
  creditsList: any[];
  displayedStatistics: DisplayedStatistics;
  pagination: any;
  isLoading: boolean;
  isError: boolean;
  // Filters
  filters: FilterState;
  showFilters: boolean;
  searchQuery: string;
  searchPlaceholder: string;
  onFiltersChange: (f: FilterState) => void;
  onToggleFilters: () => void;
  onSearchChange: (q: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  // Selection
  selectedCreditIds: number[];
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onDownloadSelected: () => void;
  onClearSelection: () => void;
  // Pagination
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  // Actions
  onViewCredit: (credit: any) => void;
  // Context
  user: any;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreditsListView({
  creditsList,
  displayedStatistics,
  pagination,
  isLoading,
  isError,
  filters,
  showFilters,
  searchQuery,
  searchPlaceholder,
  onFiltersChange,
  onToggleFilters,
  onSearchChange,
  onApplyFilters,
  onClearFilters,
  selectedCreditIds,
  onToggleSelect,
  onToggleSelectAll,
  onDownloadSelected,
  onClearSelection,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onViewCredit,
  user,
}: CreditsListViewProps) {
  const formatCurrency = (value: number) => formatCurrencyValue(value);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      {/* Statistics Widget */}
      {creditsList.length > 0 && (
        <InsightStrip
          aria-label={displayedStatistics.helper}
          items={[
            {
              id: 'capital-total',
              label: tTerm('credits.stats.portfolio.totalCapital.label'),
              value: formatCurrency(displayedStatistics.totalAmount),
              helper: tTerm('credits.stats.portfolio.totalCapital.helper'),
              icon: <DollarSign size={18} />,
              accent: 'blue',
            },
            {
              id: 'total-cobrado',
              label: tTerm('credits.stats.portfolio.totalCollected.label'),
              value: formatCurrency(displayedStatistics.totalCollected),
              helper: tTerm('credits.stats.portfolio.totalCollected.helper'),
              icon: <TrendingUp size={18} />,
              accent: 'emerald',
            },
            {
              id: 'mora-pendiente',
              label: tTerm('credits.stats.portfolio.totalOverdue.label'),
              value: formatCurrency(displayedStatistics.totalOverdue),
              helper: tTerm('credits.stats.portfolio.totalOverdue.helper'),
              icon: <AlertTriangle size={18} />,
              accent: displayedStatistics.totalOverdue > 0 ? 'amber' : 'slate',
            },
            {
              id: 'creditos-activos',
              label: tTerm('credits.stats.portfolio.activeCredits.label'),
              value: `${displayedStatistics.activeCredits} / ${displayedStatistics.totalCredits}`,
              helper: tTerm('credits.stats.portfolio.activeCredits.helper'),
              icon: <Users size={18} />,
              accent: 'slate',
            },
          ]}
        />
      )}

      <ToolbarSurface>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <TextInput
              type="text"
              data-tour="credits-search"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onApplyFilters();
                }
              }}
              className="pl-10"
            />
          </div>
          <ActionButton
            onClick={onToggleFilters}
            data-tour="credits-filters"
            variant={showFilters ? 'primary' : 'secondary'}
            icon={<Filter size={16} />}
          >
            {tTerm('credits.filter.toggle')}
          </ActionButton>
        </div>
        <div className="text-sm font-medium text-text-secondary">
          {tTerm('credits.summary.total', { count: pagination?.totalItems ?? creditsList.length })}
        </div>
      </ToolbarSurface>

      {selectedCreditIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-500/30 dark:bg-blue-500/10 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-text-secondary">
            {selectedCreditIds.length === 1
              ? tTerm('credits.bulk.selected.one', { count: selectedCreditIds.length })
              : tTerm('credits.bulk.selected.other', { count: selectedCreditIds.length })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              onClick={onDownloadSelected}
              className="!min-h-0 !px-3 !py-1.5"
            >
              {tTerm('credits.bulk.downloadReports')}
            </ActionButton>
            <ActionButton
              onClick={onClearSelection}
              className="!min-h-0 !px-3 !py-1.5"
            >
              {tTerm('credits.bulk.clearSelection')}
            </ActionButton>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <SectionSurface bodyClassName="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <FormField label={tTerm('credits.filter.status')}>
              <SelectInput
                id="credits-filter-status"
                value={filters.status}
                onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
              >
                <option value="">{tTerm('credits.filter.all')}</option>
                <option value="active">{tTerm('common.status.active')}</option>
                <option value="pending">{tTerm('schedule.status.pending')}</option>
                <option value="approved">{tTerm('credits.status.approved')}</option>
                <option value="overdue">{tTerm('schedule.status.overdue')}</option>
                <option value="defaulted">{tTerm('credits.status.defaulted')}</option>
                <option value="paid">{tTerm('schedule.status.paid')}</option>
                <option value="closed">{tTerm('common.status.closed')}</option>
                <option value="cancelled">{tTerm('credits.status.cancelled')}</option>
              </SelectInput>
            </FormField>
            <FormField label={tTerm('credits.filter.minAmount')}>
              <TextInput
                id="credits-filter-min-amount"
                type="number"
                value={filters.minAmount}
                onChange={(e) => onFiltersChange({ ...filters, minAmount: e.target.value })}
                placeholder="0"
              />
            </FormField>
            <FormField label={tTerm('credits.filter.maxAmount')}>
              <TextInput
                id="credits-filter-max-amount"
                type="number"
                value={filters.maxAmount}
                onChange={(e) => onFiltersChange({ ...filters, maxAmount: e.target.value })}
                placeholder={tTerm('credits.filter.noLimit')}
              />
            </FormField>
            <FormField label={tTerm('credits.filter.startDate')}>
              <TextInput
                id="credits-filter-start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value })}
              />
            </FormField>
            <FormField label={tTerm('credits.filter.endDate')}>
              <TextInput
                id="credits-filter-end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value })}
              />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <ActionButton
              onClick={onClearFilters}
              variant="ghost"
            >
              {tTerm('credits.filter.clear')}
            </ActionButton>
            <ActionButton
              onClick={onApplyFilters}
              variant="primary"
            >
              {tTerm('credits.filter.apply')}
            </ActionButton>
          </div>
        </SectionSurface>
      )}

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <EmptyState title={tTerm('credits.empty.loading')} compact />
        ) : isError ? (
          <EmptyState title={tTerm('credits.empty.error')} compact />
        ) : creditsList.length === 0 ? (
          <EmptyState title={tTerm('credits.empty.none')} compact />
        ) : (
          creditsList.map((credit: any) => {
            const principalOutstanding = Number(credit.principalOutstanding) || 0;
            const interestOutstanding = Number(credit.interestOutstanding) || 0;
            const outstandingAmount = principalOutstanding + interestOutstanding;
            const viewGuard = resolveOperationalGuard('credit.view', { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status });

            return (
              <article key={`mobile-credit-${credit.id}`} className="rounded-xl border border-border-subtle bg-white px-4 py-4 shadow-sm dark:bg-bg-surface">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary">{getCreditLabel(credit)}</p>
                    <p className="mt-1 text-xs text-text-secondary">{tTerm('credits.card.number', { id: credit.id })}</p>
                  </div>
                  <ExplainedChip
                    label={getLoanStatusLabel(credit.status)}
                    description={getLoanStatusDescription(credit.status)}
                    className={`inline-flex rounded-md px-2 py-1 text-xs ${getChipClassName(getLoanStatusTone(credit.status))}`}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('credits.card.capital')}</p>
                    <p className="mt-1 font-semibold text-text-primary">{formatCurrency(credit.amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('credits.card.installment')}</p>
                    <p className="mt-1 font-semibold text-text-primary">{credit.installmentAmount ? formatCurrency(credit.installmentAmount) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{tTerm('credits.card.balance')}</p>
                    <p className="mt-1 font-semibold text-text-primary">{outstandingAmount > 0 ? formatCurrency(outstandingAmount) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                      <HelpLabel label={tTerm('credits.table.recovery')} text={getRecoveryColumnHelp()} />
                    </p>
                    <div className="mt-1">
                      <ExplainedChip
                        label={getRecoveryStatusLabel(credit)}
                        description={getRecoveryStatusDescription(credit)}
                        className={`inline-flex rounded-md px-2 py-1 text-xs ${getChipClassName(
                          credit.recoveryStatus === 'overdue' || credit.status === 'defaulted' ? 'danger' : 'success',
                        )}`}
                      />
                    </div>
                  </div>
                </div>

                {viewGuard.visible && (
                  <ActionButton
                    type="button"
                    onClick={() => onViewCredit(credit)}
                    disabled={!viewGuard.executable}
                    className="mt-4"
                    fullWidth
                    icon={<Eye size={16} />}
                    title={viewGuard.executable ? tTerm('credits.card.open') : (viewGuard.reason || tTerm('credits.action.unavailable'))}
                  >
                    {tTerm('credits.card.viewDetail')}
                  </ActionButton>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <DataTableSurface className="hidden md:block">
        <table data-tour="credits-list-table" className="min-w-[760px] w-full text-left text-sm 2xl:min-w-[1100px]">
          <thead className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="w-10 px-3 py-3 font-semibold">
                <CheckboxInput
                  type="checkbox"
                  aria-label={tTerm('credits.table.selectAllVisible')}
                  checked={creditsList.length > 0 && creditsList.every((credit: any) => selectedCreditIds.includes(Number(credit?.id)))}
                  onChange={onToggleSelectAll}
                />
              </th>
              <th className="hidden px-3 py-3 font-semibold 2xl:table-cell">{tTerm('credits.table.id')}</th>
              <th className="min-w-[150px] px-3 py-3 font-semibold">{tTerm('credits.table.customer')}</th>
              <th className="px-3 py-3 text-right font-semibold">{tTerm('credits.table.capital')}</th>
              <th className="hidden px-3 py-3 text-right font-semibold 2xl:table-cell">{tTerm('credits.table.rate')}</th>
              <th className="px-3 py-3 text-right font-semibold">{tTerm('credits.table.installment')}</th>
              <th className="px-3 py-3 text-right font-semibold">{tTerm('credits.table.balance')}</th>
              <th className="hidden px-3 py-3 text-right font-semibold 2xl:table-cell">{tTerm('credits.table.delinquency')}</th>
              <th className="px-3 py-3 font-semibold">
                <HelpLabel label={tTerm('credits.filter.status')} text={getStatusColumnHelp()} />
              </th>
              <th className="px-3 py-3 font-semibold">
                <HelpLabel label={tTerm('credits.table.recovery')} text={getRecoveryColumnHelp()} />
              </th>
              <th className="hidden px-3 py-3 font-semibold 2xl:table-cell">{tTerm('credits.table.start')}</th>
              <th className="px-3 py-3 text-right font-semibold">{tTerm('credits.table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {isLoading ? (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-text-secondary">{tTerm('credits.table.loading')}</td></tr>
            ) : isError ? (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-red-600">{tTerm('credits.table.error')}</td></tr>
            ) : creditsList.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-text-secondary">{tTerm('credits.table.none')}</td></tr>
            ) : (
              creditsList.map((credit: any, index: number) => {
                const principalOutstanding = Number(credit.principalOutstanding) || 0;
                const interestOutstanding = Number(credit.interestOutstanding) || 0;
                const outstandingAmount = principalOutstanding + interestOutstanding;

                const isDelinquent = credit.status === 'defaulted' || credit.status === 'overdue' || credit.recoveryStatus === 'overdue';
                const totalAmount = Number(credit.amount) || 0;
                const delinquencyPercentage = totalAmount > 0 && isDelinquent
                  ? (outstandingAmount / totalAmount) * 100
                  : 0;

                const creationDate = credit.createdAt
                  ? formatLocaleDate(credit.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : '-';

                return (
                  <tr key={credit.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-hover-bg/60">
                    <td className="px-3 py-4" {...(index === 0 ? { 'data-tour': 'credits-row-actions' } : {})}>
                      <CheckboxInput
                        type="checkbox"
                        aria-label={tTerm('credits.table.selectOne', { id: credit.id })}
                        checked={selectedCreditIds.includes(Number(credit.id))}
                        onChange={() => onToggleSelect(Number(credit.id))}
                      />
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-4 font-mono text-text-secondary 2xl:table-cell">{String(credit.id).substring(0, 8)}</td>
                    <td className="px-3 py-4 font-medium text-text-primary">
                      <span className="block max-w-[180px] truncate" title={getCreditLabel(credit)}>
                        {getCreditLabel(credit)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right font-medium text-text-primary">{formatCurrency(credit.amount)}</td>
                    <td className="hidden whitespace-nowrap px-3 py-4 text-right text-text-secondary 2xl:table-cell">
                      {credit.interestRate ? formatPercent(credit.interestRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right text-text-secondary">
                      {credit.installmentAmount ? formatCurrency(credit.installmentAmount) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right">
                      {outstandingAmount > 0 ? (
                        <span className={isDelinquent ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                          {formatCurrency(outstandingAmount)}
                        </span>
                      ) : (
                        <span className="text-text-secondary">-</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-4 text-right 2xl:table-cell">
                      {delinquencyPercentage > 0 ? (
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
                          delinquencyPercentage > 50
                            ? 'border border-red-200 bg-red-100 text-red-900 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-200'
                            : delinquencyPercentage > 25
                              ? 'border border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200'
                              : 'border border-yellow-200 bg-yellow-100 text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-500/20 dark:text-yellow-200'
                        }`}>
                          {formatPercent(delinquencyPercentage, { minimumFractionDigits: delinquencyPercentage > 0 ? 1 : 0, maximumFractionDigits: 1 })}
                        </span>
                      ) : (
                        <span className="text-text-secondary">{formatPercent(0)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4">
                      <ExplainedChip
                        label={getLoanStatusLabel(credit.status)}
                        description={getLoanStatusDescription(credit.status)}
                        className={`inline-flex rounded-md px-2 py-1 text-xs ${getChipClassName(getLoanStatusTone(credit.status))}`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4">
                      <ExplainedChip
                        label={getRecoveryStatusLabel(credit)}
                        description={getRecoveryStatusDescription(credit)}
                        className={`inline-flex rounded-md px-2 py-1 text-xs ${getChipClassName(
                          credit.recoveryStatus === 'overdue' || credit.status === 'defaulted' ? 'danger' : 'success',
                        )}`}
                      />
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-4 text-xs text-text-secondary 2xl:table-cell">{creationDate}</td>
                    <td className="px-3 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {(() => {
                          const viewGuard = resolveOperationalGuard('credit.view', { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status });
                          const paymentGuard = resolveOperationalGuard('installment.pay', { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status });
                          const promiseGuard = resolveOperationalGuard('installment.promise', { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status });
                          const followUpGuard = resolveOperationalGuard('installment.followUp', { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status });
                          const annulGuard = resolveOperationalGuard('installment.annul', { role: user?.role, permissions: user?.permissions, loanStatus: credit?.status });

                          const getActionTitle = (guard: { executable: boolean; reason?: string }, actionKey: string) => {
                            if (!guard.executable) return guard.reason || tTerm('credits.action.unavailable' as any);
                            const keyMap: Record<string, any> = {
                              'credit.view': 'credits.action.viewDetails',
                              'installment.pay': 'credits.action.registerPayment',
                              'installment.promise': 'credits.action.createPromise',
                              'installment.followUp': 'credits.action.createFollowUp',
                              'installment.annul': 'credits.action.annulInstallment',
                            };
                            return tTerm(keyMap[actionKey] as any);
                          };

                          return (
                            <>
                              {viewGuard.visible && (
                                <IconActionButton
                                  onClick={() => onViewCredit(credit)}
                                  disabled={!viewGuard.executable}
                                  label={getActionTitle(viewGuard, 'credit.view')}
                                  icon={<Eye size={16} />}
                                />
                              )}
                              {paymentGuard.visible && (
                                <IconActionButton
                                  onClick={() => onViewCredit(credit)}
                                  disabled={!paymentGuard.executable}
                                  label={getActionTitle(paymentGuard, 'installment.pay')}
                                  icon={<DollarSign size={16} />}
                                />
                              )}
                              {promiseGuard.visible && (
                                <IconActionButton
                                  onClick={() => onViewCredit(credit)}
                                  disabled={!promiseGuard.executable}
                                  label={getActionTitle(promiseGuard, 'installment.promise')}
                                  icon={<Clock size={16} />}
                                />
                              )}
                              {followUpGuard.visible && (
                                <IconActionButton
                                  onClick={() => onViewCredit(credit)}
                                  disabled={!followUpGuard.executable}
                                  label={getActionTitle(followUpGuard, 'installment.followUp')}
                                  icon={<CalendarIcon size={16} />}
                                />
                              )}
                              {annulGuard.visible && (
                                <IconActionButton
                                  onClick={() => onViewCredit(credit)}
                                  disabled={!annulGuard.executable}
                                  label={getActionTitle(annulGuard, 'installment.annul')}
                                  icon={<X size={16} />}
                                  variant="danger"
                                />
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </DataTableSurface>

      {/* Pagination Controls */}
      {pagination && (
        <div className="flex flex-col gap-3 rounded-xl bg-white px-4 py-3 text-sm text-text-secondary shadow-sm ring-1 ring-border-subtle dark:bg-bg-surface lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {tTerm('credits.pagination.summary', {
              from: ((page - 1) * pageSize) + 1,
              to: Math.min(page * pageSize, pagination?.totalItems ?? pagination?.total ?? 0),
              total: pagination?.totalItems ?? pagination?.total ?? 0,
            })}
            <label className="flex items-center gap-2">
              <span>{tTerm('credits.pagination.rowsPerPage')}</span>
              <SelectInput
                value={pageSize}
                onChange={(event) => {
                  onPageSizeChange(Number(event.target.value));
                  onPageChange(1);
                }}
                className="!min-h-0 !py-1"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </SelectInput>
            </label>
          </div>
          <div className="flex gap-2">
            <ActionButton
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              className="!min-h-0 !px-3 !py-1"
            >
              {tTerm('credits.pagination.previous')}
            </ActionButton>
            <ActionButton
              disabled={page === (pagination?.totalPages || 1)}
              onClick={() => onPageChange(page + 1)}
              className="!min-h-0 !px-3 !py-1"
            >
              {tTerm('credits.pagination.next')}
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
