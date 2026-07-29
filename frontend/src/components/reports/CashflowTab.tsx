import { formatCurrency as formatCurrencyValue, formatDate as formatDateValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { parseReportYearInput } from '../../lib/reportYearInput';
import {
  AppInput,
  FormField,
} from '../shared/Surfaces';
import { ReportDownloadActions } from './ReportDownloadModal';
import { ReportDataTableSection } from './ReportDataTableSection';
import { ReportTabPanel, type ReportActiveFilter } from './ReportTabPanel';
import ReportSummaryGrid from './ReportSummaryGrid';
import ReportValueStack, { ReportMetaPairs } from './ReportValueStack';

const formatMoney = (value: unknown) => formatCurrencyValue(value);
const sumCashflowAmounts = (...values: unknown[]) => values.reduce<number>(
  (total, value) => total + (Number(value) || 0),
  0,
);

type CashflowRowLike = Record<string, unknown> & {
  month?: string;
  year?: string;
  inflows: unknown;
  associateContributions: unknown;
  outflows: unknown;
  associatePayments: unknown;
  capitalReturns: unknown;
  operatingExpenses: unknown;
  collectedProfit: unknown;
  principalRecovered: unknown;
  availableCash: unknown;
  portfolioReceivable: unknown;
  lossesAtRisk: unknown;
  netCashFlow: unknown;
};

type AccountingMovement = {
  id: string;
  date: string;
  movementType: string;
  movementLabel?: string;
  paymentType?: string | null;
  counterpartyName: string;
  reference: string;
  inflow: unknown;
  outflow: unknown;
};

const accountingMovementLabels: Record<string, string> = {
  customer_payment: tTerm('reports.cashflow.movements.type.customerPayment'),
  loan_disbursement: tTerm('reports.cashflow.movements.type.loanDisbursement'),
  associate_contribution: tTerm('reports.cashflow.movements.type.associateContribution'),
  associate_payment: tTerm('reports.cashflow.movements.type.associatePayment'),
  associate_capital_return: tTerm('reports.cashflow.movements.type.associateCapitalReturn'),
  associate_reinvestment: tTerm('reports.cashflow.movements.type.associateReinvestment'),
  operating_expense: tTerm('reports.cashflow.movements.type.operatingExpense'),
};

const resolveCashflowField = (entry: Record<string, unknown>, candidates: string[]) => {
  for (const candidate of candidates) {
    const value = entry[candidate];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return 0;
};

const normalizeCashflowRow = (entry: Record<string, unknown>): CashflowRowLike => {
  const inflows = resolveCashflowField(entry, ['inflows', 'totalInflows', 'collections', 'totalCollections']);
  const outflows = resolveCashflowField(entry, ['outflows', 'totalOutflows', 'totalDisbursements', 'disbursements']);
  const associateContributions = resolveCashflowField(entry, ['associateContributions', 'totalAssociateContributions']);
  const associatePayments = resolveCashflowField(entry, ['associatePayments', 'totalAssociatePayments', 'financialOutflows']);
  const capitalReturns = resolveCashflowField(entry, ['capitalReturns', 'totalCapitalReturns']);
  const operatingExpenses = resolveCashflowField(entry, ['operatingExpenses', 'totalOperatingExpenses']);
  const collectedProfit = resolveCashflowField(entry, ['collectedProfit', 'totalCollectedProfit', 'profit']);
  const principalRecovered = resolveCashflowField(entry, ['principalRecovered', 'totalPrincipalRecovered']);
  const availableCash = resolveCashflowField(entry, ['availableCash', 'cashAvailable']);
  const portfolioReceivable = resolveCashflowField(entry, ['portfolioReceivable', 'receivablePortfolio']);
  const lossesAtRisk = resolveCashflowField(entry, ['lossesAtRisk', 'totalLossesAtRisk']);
  const netCashFlow = resolveCashflowField(entry, ['netCashFlow', 'netFlow']);

  return {
    ...entry,
    inflows,
    associateContributions,
    outflows,
    associatePayments,
    capitalReturns,
    operatingExpenses,
    collectedProfit,
    principalRecovered,
    availableCash,
    portfolioReceivable,
    lossesAtRisk,
    netCashFlow: netCashFlow || (
      Number(inflows || 0)
      + Number(associateContributions || 0)
      - Number(outflows || 0)
      - Number(associatePayments || 0)
      - Number(capitalReturns || 0)
      - Number(operatingExpenses || 0)
    ),
  };
};

const hasOperationalCashflowMovement = (row: CashflowRowLike) => [
  row.inflows,
  row.associateContributions,
  row.outflows,
  row.associatePayments,
  row.capitalReturns,
  row.operatingExpenses,
  row.collectedProfit,
  row.principalRecovered,
  row.lossesAtRisk,
].some((value) => Math.abs(Number(value || 0)) > 0);

type CashflowTabProps = {
  cashFlowYear: number;
  onCashFlowYearChange: (year: number) => void;
  cashFlowRange: { fromDate: string; toDate: string };
  onCashFlowRangeChange: (range: { fromDate: string; toDate: string }) => void;
  cashFlowData: any;
  isCashFlowLoading: boolean;
  isCashFlowExporting: 'excel' | 'pdf' | null;
  onExportCashFlow: (format: 'excel' | 'pdf') => boolean | Promise<boolean>;
  reportExportGuard: { visible: boolean; executable: boolean; reason?: string };
};

export default function CashflowTab({
  cashFlowYear,
  onCashFlowYearChange,
  cashFlowRange,
  onCashFlowRangeChange,
  cashFlowData,
  isCashFlowLoading,
  isCashFlowExporting,
  onExportCashFlow,
  reportExportGuard,
}: CashflowTabProps) {
  const monthlyRows = (cashFlowData?.months || []).map((row: any) => normalizeCashflowRow(row));
  const activeMonthlyRows = monthlyRows.filter(hasOperationalCashflowMovement);
  const displayedMonthlyRows = activeMonthlyRows;
  const movements = (Array.isArray(cashFlowData?.movements) ? cashFlowData.movements : []) as AccountingMovement[];
  const summary = cashFlowData?.summary || {};
  const activeFilterCount = Number(Boolean(cashFlowRange.fromDate)) + Number(Boolean(cashFlowRange.toDate));
  const activeFilters: ReportActiveFilter[] = [];
  if (cashFlowRange.fromDate) {
    activeFilters.push({
      id: 'fromDate',
      label: tTerm('reports.cashflow.fromDate'),
      value: cashFlowRange.fromDate,
      onRemove: () => onCashFlowRangeChange({ ...cashFlowRange, fromDate: '' }),
    });
  }
  if (cashFlowRange.toDate) {
    activeFilters.push({
      id: 'toDate',
      label: tTerm('reports.cashflow.toDate'),
      value: cashFlowRange.toDate,
      onRemove: () => onCashFlowRangeChange({ ...cashFlowRange, toDate: '' }),
    });
  }
  const handleYearChange = (value: string) => {
    const parsedYear = parseReportYearInput(value);
    if (parsedYear !== null) {
      onCashFlowYearChange(parsedYear);
    }
  };
  const updateCashFlowRange = (key: 'fromDate' | 'toDate', value: string) => {
    if (key === 'fromDate' && value && cashFlowRange.toDate && value > cashFlowRange.toDate) {
      return;
    }
    if (key === 'toDate' && value && cashFlowRange.fromDate && value < cashFlowRange.fromDate) {
      return;
    }

    onCashFlowRangeChange({
      ...cashFlowRange,
      [key]: value,
    });
  };

  return (
    <div className="report-tab-layout">
      <ReportTabPanel
        title={tTerm('reports.tab.cashflow')}
        subtitle={tTerm('reports.tab.cashflow.title')}
        filterColumns={3}
        activeFilterCount={activeFilterCount}
        activeFilters={activeFilters}
        onClearAllFilters={() => onCashFlowRangeChange({ fromDate: '', toDate: '' })}
        filters={(
          <>
            <FormField label={tTerm('reports.cashflow.year')}>
              <AppInput
                variant="integer"
                value={String(cashFlowYear)}
                onValueChange={(v) => handleYearChange(v)}
              />
            </FormField>
            <FormField label={tTerm('reports.cashflow.fromDate')}>
              <AppInput
                variant="date"
                value={cashFlowRange.fromDate}
                onValueChange={(v) => updateCashFlowRange('fromDate', v)}
              />
            </FormField>
            <FormField label={tTerm('reports.cashflow.toDate')}>
              <AppInput
                variant="date"
                value={cashFlowRange.toDate}
                onValueChange={(v) => updateCashFlowRange('toDate', v)}
              />
            </FormField>
          </>
        )}
        headerActions={reportExportGuard.visible ? (
          <ReportDownloadActions
            isExporting={isCashFlowExporting !== null}
            disabled={!reportExportGuard.executable}
            disabledReason={reportExportGuard.reason || tTerm('credits.action.unavailable')}
            formats={['excel', 'pdf']}
            onDownload={(format) => onExportCashFlow(format === 'pdf' ? 'pdf' : 'excel')}
          />
        ) : null}
      />

      {!isCashFlowLoading && displayedMonthlyRows.length > 0 ? (
        <ReportSummaryGrid columns={2} items={[
          { label: tTerm('reports.cashflow.table.principalRecovered'), value: formatMoney(summary.totalPrincipalRecovered) },
          { label: tTerm('reports.cashflow.table.portfolioReceivable'), value: formatMoney(summary.portfolioReceivable) },
        ]} />
      ) : null}

      <ReportDataTableSection
        isLoading={isCashFlowLoading}
        hasData={displayedMonthlyRows.length > 0}
        loadingContent={<div className="table-empty-state table-empty-state--compact">{tTerm('reports.cashflow.table.loading')}</div>}
        emptyContent={<div className="table-empty-state table-empty-state--compact">{tTerm('reports.cashflow.table.empty')}</div>}
      >
            <thead>
              <tr>
                <th>{tTerm('reports.cashflow.table.month')}</th>
                <th>{tTerm('reports.cashflow.table.inflows')}</th>
                <th>{tTerm('reports.cashflow.table.registeredOutflows')}</th>
                <th>{tTerm('reports.cashflow.table.result')}</th>
                <th>{tTerm('reports.cashflow.table.available')}</th>
              </tr>
            </thead>
            <tbody>
              {displayedMonthlyRows.map((month: CashflowRowLike) => (
                  <tr key={month.month}>
                    <td className="report-cashflow-period font-medium">{month.month}</td>
                    <td>
                      <ReportValueStack
                        value={formatMoney(sumCashflowAmounts(month.inflows, month.associateContributions))}
                        meta={<ReportMetaPairs pairs={[{ label: tTerm('reports.cashflow.table.installmentsShort'), value: formatMoney(month.inflows) }, { label: tTerm('reports.cashflow.table.contributionsShort'), value: formatMoney(month.associateContributions) }]} />}
                        strong
                      />
                    </td>
                    <td>
                      <ReportValueStack
                        value={formatMoney(sumCashflowAmounts(month.outflows, month.associatePayments, month.capitalReturns, month.operatingExpenses))}
                        meta={(
                          <ReportMetaPairs
                            pairs={[
                              { label: tTerm('reports.cashflow.table.outflowsShort'), value: formatMoney(month.outflows) },
                              { label: tTerm('reports.cashflow.table.associatePaymentsShort'), value: formatMoney(month.associatePayments) },
                              { label: tTerm('reports.cashflow.table.capitalReturnsShort'), value: formatMoney(month.capitalReturns) },
                              { label: tTerm('reports.cashflow.table.operatingExpensesShort'), value: formatMoney(month.operatingExpenses) },
                            ]}
                          />
                        )}
                      />
                    </td>
                    <td>
                      <ReportValueStack
                        value={formatMoney(month.netCashFlow)}
                        tone={Number(month.netCashFlow || 0) < 0 ? 'negative' : 'positive'}
                        strong
                      />
                    </td>
                    <td>
                      <ReportValueStack
                        value={formatMoney(month.availableCash)}
                        tone={Number(month.availableCash || 0) < 0 ? 'negative' : 'default'}
                        strong
                      />
                    </td>
                  </tr>
              ))}
            </tbody>
            {!isCashFlowLoading && displayedMonthlyRows.length > 0 ? (
              <tfoot>
                <tr>
                  <th>{tTerm('reports.cashflow.table.total')}</th>
                  <td><ReportValueStack value={formatMoney(sumCashflowAmounts(summary.totalInflows, summary.totalAssociateContributions))} strong /></td>
                  <td>
                    <ReportValueStack
                      value={formatMoney(sumCashflowAmounts(summary.totalOutflows, summary.totalAssociatePayments, summary.totalCapitalReturns, summary.totalOperatingExpenses))}
                      strong
                    />
                  </td>
                  <td>
                    <ReportValueStack
                      value={formatMoney(summary.netCashFlow ?? summary.availableCash)}
                      tone={Number(summary.netCashFlow ?? summary.availableCash ?? 0) < 0 ? 'negative' : 'positive'}
                      strong
                    />
                  </td>
                  <td>
                    <ReportValueStack
                      value={formatMoney(summary.availableCash)}
                      tone={Number(summary.availableCash || 0) < 0 ? 'negative' : 'default'}
                      strong
                    />
                  </td>
                </tr>
              </tfoot>
            ) : null}
      </ReportDataTableSection>

      {!isCashFlowLoading && movements.length > 0 ? (
        <ReportDataTableSection
          title={tTerm('reports.cashflow.movements.title')}
          subtitle={tTerm('reports.cashflow.movements.subtitle')}
          isLoading={false}
          hasData
          minWidthClassName="min-w-[860px]"
        >
          <thead>
            <tr>
              <th>{tTerm('reports.cashflow.movements.date')}</th>
              <th>{tTerm('reports.cashflow.movements.type')}</th>
              <th>{tTerm('reports.cashflow.movements.counterparty')}</th>
              <th>{tTerm('reports.cashflow.movements.reference')}</th>
              <th className="text-right">{tTerm('reports.cashflow.movements.inflow')}</th>
              <th className="text-right">{tTerm('reports.cashflow.movements.outflow')}</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id}>
                <td>{formatDateValue(movement.date, { dateStyle: 'medium', timeZone: 'UTC' })}</td>
                <td>{movement.movementLabel || accountingMovementLabels[movement.movementType] || movement.movementType}</td>
                <td className="font-medium">{movement.counterpartyName}</td>
                <td>{movement.reference}</td>
                <td className="text-right">{Number(movement.inflow || 0) > 0 ? formatMoney(movement.inflow) : '—'}</td>
                <td className="text-right">{Number(movement.outflow || 0) > 0 ? formatMoney(movement.outflow) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </ReportDataTableSection>
      ) : null}
    </div>
  );
}
