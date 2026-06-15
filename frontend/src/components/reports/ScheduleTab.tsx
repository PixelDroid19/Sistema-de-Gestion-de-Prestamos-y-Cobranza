import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { AlertCircle, CalendarClock, DollarSign, Eye, Search, TrendingUp, Wallet } from 'lucide-react';
import {
  formatCurrency as formatCurrencyValue,
  formatDate as formatDateValue,
} from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { getChipClassName } from '../../constants/uiChips';
import type { ChipTone } from '../../constants/uiChips';
import type {
  PaymentCalendarOverviewAgendaItem,
  PaymentCalendarOverviewSummary,
} from '../../types/reportSimulation';
import { getLoanStatusLabel } from '../credits/creditsHelpers';
import {
  ActionButton,
  AppInput,
  DataTableSurface,
  EmptyState,
  FormField,
  InsightStrip,
  LoanSearchSelect,
  OperationalSelect,
  SectionSurface,
} from '../shared/Surfaces';
import {
  AppTable,
  RowActionsWithOverflow,
  TableActionsCell,
  TableActionsHeader,
  TableSectionIntro,
  TableStatusPill,
  TABLE_EMBEDDED_SHELL_CLASS,
} from '../shared/tables';
import { ReportDataTableSection } from './ReportDataTableSection';
import { ReportMetricsSection } from './ReportMetricsSection';
import { ReportTabPanel } from './ReportTabPanel';

const formatMoney = (value: unknown) => formatCurrencyValue(value);
const AGENDA_PAGE_SIZE_OPTIONS = [10, 25, 50];

type ScheduleAgendaFilters = {
  search: string;
  status: string;
  startDate: string;
  endDate: string;
};

/**
 * Returns the operator-facing label for an installment status in the reports schedule.
 */
const getScheduleEntryStatusLabel = (status: unknown) => {
  switch (String(status || '').toLowerCase()) {
    case 'paid':
      return tTerm('schedule.status.paid');
    case 'overdue':
      return tTerm('schedule.status.overdue');
    case 'partial':
      return tTerm('credits.calendar.status.partial');
    case 'annulled':
      return tTerm('schedule.status.annulled');
    default:
      return tTerm('schedule.status.pending');
  }
};

/**
 * Maps installment statuses to visual severity without exposing backend enum names.
 */
const getScheduleEntryStatusTone = (status: unknown): ChipTone => {
  switch (String(status || '').toLowerCase()) {
    case 'paid':
      return 'success';
    case 'overdue':
      return 'danger';
    case 'partial':
      return 'info';
    case 'annulled':
      return 'neutral';
    default:
      return 'warning';
  }
};

const getAgendaInstallmentLabel = (entry: PaymentCalendarOverviewAgendaItem) => (
  entry.totalInstallments > 0
    ? tTerm('credits.agenda.installmentOf', {
      number: entry.installmentNumber,
      total: entry.totalInstallments,
    })
    : tTerm('credits.agenda.installment', {
      number: entry.installmentNumber,
    })
);

type ScheduleTabProps = {
  scheduleAgenda: PaymentCalendarOverviewAgendaItem[];
  scheduleAgendaSummary?: PaymentCalendarOverviewSummary | null;
  isScheduleAgendaLoading: boolean;
  isScheduleAgendaError?: boolean;
  onRefetchAgenda: () => void;
  scheduleAgendaFilters: ScheduleAgendaFilters;
  onScheduleAgendaFiltersChange: (patch: Partial<ScheduleAgendaFilters>) => void;
  selectedLoanId: number | null;
  onLoanIdChange: (id: number | null) => void;
  schedule: any[];
  scheduleSummary: any;
  scheduleLoan: any;
  isScheduleLoading: boolean;
  onRefetch: () => void;
};

export default function ScheduleTab({
  scheduleAgenda,
  scheduleAgendaSummary,
  isScheduleAgendaLoading,
  isScheduleAgendaError = false,
  onRefetchAgenda,
  scheduleAgendaFilters,
  onScheduleAgendaFiltersChange,
  selectedLoanId,
  onLoanIdChange,
  schedule,
  scheduleSummary,
  scheduleLoan,
  isScheduleLoading,
  onRefetch,
}: ScheduleTabProps) {
  const [agendaPage, setAgendaPage] = useState(1);
  const [agendaPageSize, setAgendaPageSize] = useState(AGENDA_PAGE_SIZE_OPTIONS[0]);
  const [loanSearchQuery, setLoanSearchQuery] = useState('');

  useEffect(() => {
    setAgendaPage(1);
  }, [
    scheduleAgendaFilters.search,
    scheduleAgendaFilters.status,
    scheduleAgendaFilters.startDate,
    scheduleAgendaFilters.endDate,
  ]);

  const agendaTotalPages = Math.max(1, Math.ceil(scheduleAgenda.length / agendaPageSize));
  const currentAgendaPage = Math.min(agendaPage, agendaTotalPages);

  useEffect(() => {
    if (agendaPage > agendaTotalPages) {
      setAgendaPage(agendaTotalPages);
    }
  }, [agendaPage, agendaTotalPages]);

  const paginatedAgenda = useMemo(() => {
    const startIndex = (currentAgendaPage - 1) * agendaPageSize;
    return scheduleAgenda.slice(startIndex, startIndex + agendaPageSize);
  }, [agendaPageSize, currentAgendaPage, scheduleAgenda]);

  const agendaPagination = scheduleAgenda.length > 0
    ? {
      page: currentAgendaPage,
      pageSize: agendaPageSize,
      totalItems: scheduleAgenda.length,
      totalPages: agendaTotalPages,
      onPrev: () => setAgendaPage((page) => Math.max(1, page - 1)),
      onNext: () => setAgendaPage((page) => Math.min(agendaTotalPages, page + 1)),
      onPageSizeChange: (pageSize: number) => {
        setAgendaPageSize(pageSize);
        setAgendaPage(1);
      },
      pageSizeOptions: AGENDA_PAGE_SIZE_OPTIONS,
    }
    : undefined;

  const agendaSummaryItems = scheduleAgendaSummary
    ? [
      {
        id: 'agenda-actionable',
        label: tTerm('reports.schedule.agenda.summary.actionable.label'),
        value: String(scheduleAgendaSummary.actionableCount || 0),
        helper: tTerm('reports.schedule.agenda.summary.actionable.helper'),
        icon: <CalendarClock size={18} />,
        accent: 'blue' as const,
      },
      {
        id: 'agenda-overdue',
        label: tTerm('reports.schedule.agenda.summary.overdue.label'),
        value: String(scheduleAgendaSummary.overdueCount || 0),
        helper: tTerm('reports.schedule.agenda.summary.overdue.helper'),
        icon: <AlertCircle size={18} />,
        accent: 'rose' as const,
      },
      {
        id: 'agenda-due-today',
        label: tTerm('reports.schedule.agenda.summary.dueToday.label'),
        value: String(scheduleAgendaSummary.dueTodayCount || 0),
        helper: tTerm('reports.schedule.agenda.summary.dueToday.helper'),
        icon: <CalendarClock size={18} />,
        accent: 'amber' as const,
      },
      {
        id: 'agenda-payable',
        label: tTerm('reports.schedule.agenda.summary.amount.label'),
        value: formatMoney(scheduleAgendaSummary.totalPayableAmount),
        helper: scheduleAgendaSummary.totalLateFeeAmount > 0
          ? tTerm('reports.schedule.agenda.summary.amount.helper.withLateFee', {
            amount: formatMoney(scheduleAgendaSummary.totalLateFeeAmount),
          })
          : tTerm('reports.schedule.agenda.summary.amount.helper.withoutLateFee'),
        icon: <DollarSign size={18} />,
        accent: 'emerald' as const,
      },
    ]
    : [];

  return (
    <div className="report-tab-layout">
      <ReportTabPanel
        title={tTerm('reports.schedule.agenda.title')}
        subtitle={tTerm('reports.schedule.agenda.subtitle')}
        filterColumns={4}
        filters={(
          <>
            <FormField label={tTerm('credits.calendar.filter.search')}>
              <AppInput
                value={scheduleAgendaFilters.search}
                onValueChange={(value) => onScheduleAgendaFiltersChange({ search: String(value) })}
                icon={<Search size={16} />}
                placeholder={tTerm('credits.calendar.filter.searchPlaceholder')}
              />
            </FormField>
            <FormField label={tTerm('credits.calendar.filter.status')}>
              <OperationalSelect
                value={scheduleAgendaFilters.status}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => onScheduleAgendaFiltersChange({ status: event.target.value })}
              >
                <option value="">{tTerm('credits.calendar.filter.allStatuses')}</option>
                <option value="pending">{tTerm('schedule.status.pending')}</option>
                <option value="overdue">{tTerm('schedule.status.overdue')}</option>
                <option value="paid">{tTerm('schedule.status.paid')}</option>
                <option value="partial">{tTerm('credits.calendar.status.partial')}</option>
              </OperationalSelect>
            </FormField>
            <FormField label={tTerm('credits.calendar.filter.from')}>
              <AppInput
                value={scheduleAgendaFilters.startDate}
                variant="date"
                onValueChange={(value) => onScheduleAgendaFiltersChange({ startDate: String(value) })}
              />
            </FormField>
            <FormField label={tTerm('credits.calendar.filter.to')}>
              <AppInput
                value={scheduleAgendaFilters.endDate}
                variant="date"
                onValueChange={(value) => onScheduleAgendaFiltersChange({ endDate: String(value) })}
              />
            </FormField>
          </>
        )}
        headerActions={(
          <ActionButton
            variant="secondary"
            onClick={onRefetchAgenda}
            disabled={isScheduleAgendaLoading}
          >
            {isScheduleAgendaLoading
              ? tTerm('reports.schedule.cta.loading')
              : tTerm('reports.schedule.agenda.cta.refresh')}
          </ActionButton>
        )}
      />

      {agendaSummaryItems.length > 0 ? (
        <ReportMetricsSection
          primaryItems={agendaSummaryItems}
          primaryAriaLabel={tTerm('reports.schedule.agenda.summary.aria')}
        />
      ) : null}

      <ReportDataTableSection
        title={tTerm('reports.schedule.agenda.table.title')}
        subtitle={tTerm('reports.schedule.agenda.table.subtitle')}
        isLoading={isScheduleAgendaLoading}
        isError={isScheduleAgendaError}
        hasData={scheduleAgenda.length > 0}
        loadingContent={<div className="table-empty-state">{tTerm('reports.state.loading')}</div>}
        errorContent={<div className="table-empty-state">{tTerm('reports.schedule.agenda.error')}</div>}
        emptyContent={(
          <EmptyState
            compact
            icon={<CalendarClock size={18} />}
            title={tTerm('reports.schedule.agenda.empty.title')}
            description={tTerm('reports.schedule.agenda.empty.description')}
          />
        )}
        pagination={agendaPagination}
        recordsLabel={tTerm('reports.schedule.agenda.table.recordsLabel')}
        minWidthClassName="min-w-[1120px]"
      >
        <thead>
          <tr>
            <th>{tTerm('reports.schedule.agenda.table.customer')}</th>
            <th>{tTerm('reports.schedule.agenda.table.installment')}</th>
            <th>{tTerm('reports.schedule.agenda.table.dueDate')}</th>
            <th>{tTerm('reports.schedule.agenda.table.payableAmount')}</th>
            <th>{tTerm('reports.schedule.agenda.table.lateFee')}</th>
            <th>{tTerm('reports.schedule.agenda.table.daysOverdue')}</th>
            <th>{tTerm('reports.schedule.agenda.table.status')}</th>
            <TableActionsHeader>{tTerm('reports.schedule.agenda.table.actions')}</TableActionsHeader>
          </tr>
        </thead>
        <tbody>
          {paginatedAgenda.map((entry) => (
            <tr key={`${entry.loanId}-${entry.installmentNumber}-${entry.dueDate}`}>
              <td>
                <p className="font-semibold text-text-primary">{entry.customerName}</p>
                <p className="mt-1 text-sm text-text-secondary">
                  {tTerm('reports.schedule.agenda.table.loanReference', { id: entry.loanId })}
                </p>
              </td>
              <td>
                <p className="font-medium text-text-primary">{getAgendaInstallmentLabel(entry)}</p>
                {entry.isNextPayable ? (
                  <p className="mt-1 text-sm text-text-secondary">
                    {tTerm('reports.schedule.agenda.table.nextPayable')}
                  </p>
                ) : null}
              </td>
              <td>{formatDateValue(entry.dueDate) || tTerm('common.notAvailable')}</td>
              <td>
                <p className="font-semibold text-text-primary">{formatMoney(entry.payableAmount)}</p>
                <p className="mt-1 text-sm text-text-secondary">
                  {tTerm('reports.schedule.agenda.table.scheduledPayment', {
                    amount: formatMoney(entry.scheduledPayment),
                  })}
                </p>
              </td>
              <td>
                {entry.lateFeeDue > 0
                  ? formatMoney(entry.lateFeeDue)
                  : tTerm('reports.schedule.agenda.table.noLateFee')}
              </td>
              <td>
                {entry.daysOverdue > 0
                  ? tTerm('credits.agenda.daysOverdue', { count: entry.daysOverdue })
                  : tTerm('reports.schedule.agenda.table.current')}
              </td>
              <td>
                <TableStatusPill className={getChipClassName(getScheduleEntryStatusTone(entry.status))}>
                  {getScheduleEntryStatusLabel(entry.status)}
                </TableStatusPill>
              </td>
              <TableActionsCell>
                <RowActionsWithOverflow
                  variant="icon"
                  maxInline={1}
                  ariaLabel={tTerm('reports.schedule.agenda.table.actions')}
                  items={[
                    {
                      id: 'open-schedule',
                      label: tTerm('reports.schedule.agenda.action.openSchedule'),
                      icon: <Eye size={16} />,
                      onClick: () => onLoanIdChange(entry.loanId),
                    },
                  ]}
                />
              </TableActionsCell>
            </tr>
          ))}
        </tbody>
      </ReportDataTableSection>

      <ReportTabPanel
        title={tTerm('reports.schedule.selectTitle')}
        subtitle={tTerm('reports.schedule.selectSubtitle')}
        filterColumns={2}
        filters={(
          <FormField
            label={tTerm('reports.schedule.selectLabel')}
            helper={tTerm('reports.schedule.selectHelper')}
          >
            <LoanSearchSelect
              id="reports-schedule-loan"
              selectedLoanId={selectedLoanId ? String(selectedLoanId) : ''}
              searchValue={loanSearchQuery}
              onSearchValueChange={setLoanSearchQuery}
              onSelectedLoanIdChange={(value) => onLoanIdChange(value ? Number(value) : null)}
              placeholder={tTerm('reports.schedule.selectPlaceholder')}
              listboxLabel={tTerm('reports.schedule.selectLabel')}
              pageSize={50}
              enabled
            />
          </FormField>
        )}
        headerActions={(
          <ActionButton
            variant="primary"
            onClick={onRefetch}
            disabled={!selectedLoanId || isScheduleLoading}
          >
            {isScheduleLoading ? tTerm('reports.schedule.cta.loading') : tTerm('reports.schedule.cta.refresh')}
          </ActionButton>
        )}
      />

      {scheduleLoan && scheduleSummary && (
        <>
          <InsightStrip
            aria-label={tTerm('reports.schedule.summary.aria')}
            items={[
              {
                id: 'schedule-loan-amount',
                label: tTerm('schedule.summary.loanAmount'),
                value: formatMoney(scheduleLoan.amount),
                helper: tTerm('schedule.summary.loanAmountHelper'),
                icon: <DollarSign size={18} />,
                accent: 'blue',
              },
              {
                id: 'schedule-loan-term',
                label: tTerm('schedule.summary.term'),
                value: tTerm('schedule.summary.termValue', { months: scheduleLoan.termMonths }),
                helper: tTerm('schedule.summary.termHelper'),
                icon: <CalendarClock size={18} />,
                accent: 'emerald',
              },
              {
                id: 'schedule-loan-rate',
                label: tTerm('schedule.summary.interestRate'),
                value: `${scheduleLoan.interestRate}%`,
                helper: tTerm('schedule.summary.interestRateHelper'),
                icon: <TrendingUp size={18} />,
                accent: 'amber',
              },
              {
                id: 'schedule-loan-status',
                label: tTerm('schedule.summary.status'),
                value: getLoanStatusLabel(scheduleLoan.status),
                helper: tTerm('schedule.summary.statusHelper'),
                icon: <AlertCircle size={18} />,
                accent: 'slate',
              },
            ]}
          />

          <InsightStrip
            aria-label={tTerm('reports.schedule.totals.aria')}
            items={[
              {
                id: 'schedule-total-principal',
                label: tTerm('schedule.stats.totalPrincipal'),
                value: formatMoney(scheduleSummary.totalPrincipal),
                helper: tTerm('schedule.stats.totalPrincipalHelper'),
                icon: <DollarSign size={18} />,
                accent: 'slate',
              },
              {
                id: 'schedule-total-interest',
                label: tTerm('schedule.stats.totalInterest'),
                value: formatMoney(scheduleSummary.totalInterest),
                helper: tTerm('schedule.stats.totalInterestHelper'),
                icon: <TrendingUp size={18} />,
                accent: 'emerald',
              },
              {
                id: 'schedule-total-payment',
                label: tTerm('schedule.stats.totalPayment'),
                value: formatMoney(scheduleSummary.totalPayment),
                helper: tTerm('schedule.stats.totalPaymentHelper'),
                icon: <Wallet size={18} />,
                accent: 'blue',
              },
            ]}
          />

          <SectionSurface title={tTerm('reports.schedule.progress.title')}>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-4 bg-bg-base rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${(Number(scheduleSummary.paidInstallments) / Math.max(Number(scheduleSummary.totalInstallments), 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <span className="text-sm text-text-secondary">
                {tTerm('reports.schedule.progress.summary', {
                  paid: scheduleSummary.paidInstallments,
                  total: scheduleSummary.totalInstallments,
                })}
              </span>
            </div>
          </SectionSurface>

          <DataTableSurface>
            <TableSectionIntro embedded title={tTerm('reports.schedule.table.title')} />
            <AppTable
              variant="financial"
              visibleFrom="always"
              className={TABLE_EMBEDDED_SHELL_CLASS}
              surfaceClassName={TABLE_EMBEDDED_SHELL_CLASS}
              horizontalScroll
              minWidthClassName="min-w-[960px]"
            >
              <thead>
                <tr>
                  <th>{tTerm('schedule.table.header.period')}</th>
                  <th>{tTerm('schedule.table.header.dueDate')}</th>
                  <th>{tTerm('schedule.table.header.openingBalance')}</th>
                  <th>{tTerm('schedule.table.header.scheduledPayment')}</th>
                  <th>{tTerm('schedule.table.header.principal')}</th>
                  <th>{tTerm('schedule.table.header.interest')}</th>
                  <th>{tTerm('schedule.table.header.remaining')}</th>
                  <th>{tTerm('schedule.table.header.status')}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((entry: any, i: number) => (
                  <tr key={i}>
                    <td className="font-medium">{entry.installmentNumber || i + 1}</td>
                    <td>{formatDateValue(entry.dueDate) || tTerm('common.notAvailable')}</td>
                    <td>{formatMoney(entry.openingBalance)}</td>
                    <td className="font-medium">{formatMoney(entry.scheduledPayment)}</td>
                    <td className="text-text-secondary">{formatMoney(entry.principalComponent)}</td>
                    <td className="text-emerald-600">{formatMoney(entry.interestComponent)}</td>
                    <td>{formatMoney(entry.remainingBalance)}</td>
                    <td>
                      <TableStatusPill className={getChipClassName(getScheduleEntryStatusTone(entry.status))}>
                        {getScheduleEntryStatusLabel(entry.status)}
                      </TableStatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AppTable>
          </DataTableSurface>
        </>
      )}

      {!scheduleLoan && !isScheduleLoading ? (
        <DataTableSurface>
          <EmptyState
            icon={<CalendarClock size={22} />}
            title={tTerm('reports.schedule.empty.title')}
            description={tTerm('reports.schedule.empty.description')}
          />
        </DataTableSurface>
      ) : null}
    </div>
  );
}
