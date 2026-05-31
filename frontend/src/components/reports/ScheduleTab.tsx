import { AlertCircle, CalendarClock, DollarSign, TrendingUp, Wallet } from 'lucide-react';
import {
  formatCurrency as formatCurrencyValue,
  formatDate as formatDateValue,
} from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { getChipClassName } from '../../constants/uiChips';
import type { ChipTone } from '../../constants/uiChips';
import { getLoanStatusLabel } from '../credits/creditsHelpers';
import {
  ActionButton,
  DataTableSurface,
  EmptyState,
  FormField,
  InsightStrip,
  SectionSurface,
  SelectInput,
} from '../shared/Surfaces';
import { ReportTabPanel } from './ReportTabPanel';

const formatMoney = (value: unknown) => formatCurrencyValue(value);

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

type ScheduleTabProps = {
  selectedLoanId: number | null;
  onLoanIdChange: (id: number | null) => void;
  loanOptions: Array<{
    id: number;
    label: string;
    helper?: string;
  }>;
  schedule: any[];
  scheduleSummary: any;
  scheduleLoan: any;
  isScheduleLoading: boolean;
  onRefetch: () => void;
};

export default function ScheduleTab({
  selectedLoanId,
  onLoanIdChange,
  loanOptions,
  schedule,
  scheduleSummary,
  scheduleLoan,
  isScheduleLoading,
  onRefetch,
}: ScheduleTabProps) {
  return (
    <div className="report-tab-layout">
      <ReportTabPanel
        title={tTerm('reports.schedule.selectTitle')}
        subtitle={tTerm('reports.schedule.selectSubtitle')}
        filterColumns={2}
        filters={(
          <FormField
            label={tTerm('reports.schedule.selectLabel')}
            helper={tTerm('reports.schedule.selectHelper')}
          >
            <SelectInput
              value={selectedLoanId ?? ''}
              onChange={(event) => onLoanIdChange(event.target.value ? Number(event.target.value) : null)}
              disabled={loanOptions.length === 0}
              aria-label={tTerm('reports.schedule.selectLabel')}
            >
              <option value="">
                {loanOptions.length > 0
                  ? tTerm('reports.schedule.selectPlaceholder')
                  : tTerm('reports.schedule.selectEmpty')}
              </option>
              {loanOptions.map((loan) => (
                <option key={loan.id} value={loan.id}>
                  {loan.label}
                </option>
              ))}
            </SelectInput>
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
                    style={{ width: `${(Number(scheduleSummary.paidInstallments) / Number(scheduleSummary.totalInstallments)) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-sm text-text-secondary">
                {tTerm('reports.schedule.progress.summary', { paid: scheduleSummary.paidInstallments, total: scheduleSummary.totalInstallments })}
              </span>
            </div>
          </SectionSurface>

          <DataTableSurface>
            <div className="px-4 py-4 sm:px-5">
              <h3 className="font-medium">{tTerm('reports.schedule.table.title')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
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
                        <span className={`px-2 py-1 rounded text-xs ${getChipClassName(getScheduleEntryStatusTone(entry.status))}`}>
                          {getScheduleEntryStatusLabel(entry.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataTableSurface>
        </>
      )}

      {!scheduleLoan && !isScheduleLoading && (
        <DataTableSurface>
          <EmptyState
            icon={<CalendarClock size={22} />}
            title={tTerm('reports.schedule.empty.title')}
            description={tTerm('reports.schedule.empty.description')}
          />
        </DataTableSurface>
      )}
    </div>
  );
}
