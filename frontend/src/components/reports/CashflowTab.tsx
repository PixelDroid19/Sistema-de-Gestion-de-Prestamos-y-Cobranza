import { formatCurrency as formatCurrencyValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { parseReportYearInput } from '../../lib/reportYearInput';
import {
  ActionButton,
  AppInput,
  FormField,
} from '../shared/Surfaces';
import { ReportDataTableSection } from './ReportDataTableSection';
import { ReportTabPanel } from './ReportTabPanel';
import ReportValueStack from './ReportValueStack';

const formatMoney = (value: unknown) => formatCurrencyValue(value);

type CashflowRowLike = Record<string, unknown> & {
  month?: string;
  year?: string;
  inflows: unknown;
  outflows: unknown;
  associatePayments: unknown;
  operatingExpenses: unknown;
  collectedProfit: unknown;
  principalRecovered: unknown;
  availableCash: unknown;
  portfolioReceivable: unknown;
  lossesAtRisk: unknown;
  netCashFlow: unknown;
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
  const associatePayments = resolveCashflowField(entry, ['associatePayments', 'totalAssociatePayments', 'financialOutflows']);
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
    outflows,
    associatePayments,
    operatingExpenses,
    collectedProfit,
    principalRecovered,
    availableCash,
    portfolioReceivable,
    lossesAtRisk,
    netCashFlow: netCashFlow || (
      Number(inflows || 0)
      - Number(outflows || 0)
      - Number(associatePayments || 0)
      - Number(operatingExpenses || 0)
    ),
  };
};

const hasOperationalCashflowMovement = (row: CashflowRowLike) => [
  row.inflows,
  row.outflows,
  row.associatePayments,
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
  const summary = cashFlowData?.summary || {};
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
        filterColumns={3}
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
          <>
            <ActionButton
              variant="secondary"
              onClick={() => onExportCashFlow('excel')}
              disabled={!reportExportGuard.executable || isCashFlowExporting === 'excel'}
              title={reportExportGuard.executable ? undefined : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
            >
              {tTerm('reports.cashflow.cta.excel')}
            </ActionButton>
            <ActionButton
              variant="ghost"
              onClick={() => onExportCashFlow('pdf')}
              disabled={!reportExportGuard.executable || isCashFlowExporting === 'pdf'}
              title={reportExportGuard.executable ? undefined : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
            >
              {tTerm('reports.cashflow.cta.pdf')}
            </ActionButton>
          </>
        ) : null}
      />

      <ReportDataTableSection
        title={tTerm('reports.cashflow.table.title')}
        subtitle={tTerm('reports.cashflow.table.subtitle')}
        minWidthClassName="min-w-[840px]"
      >
            <thead>
              <tr>
                <th>{tTerm('reports.cashflow.table.month')}</th>
                <th>{tTerm('reports.cashflow.table.inflows')}</th>
                <th>{tTerm('reports.cashflow.table.outflows')}</th>
                <th>{tTerm('reports.cashflow.table.result')}</th>
                <th>{tTerm('reports.cashflow.table.available')}</th>
                <th>{tTerm('reports.cashflow.table.portfolioReceivable')}</th>
              </tr>
            </thead>
            <tbody>
              {isCashFlowLoading ? (
                <tr>
                  <td colSpan={6} className="table-empty-state table-empty-state--compact">{tTerm('reports.cashflow.table.loading')}</td>
                </tr>
              ) : displayedMonthlyRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty-state table-empty-state--compact">{tTerm('reports.cashflow.table.empty')}</td>
                </tr>
              ) : (
                displayedMonthlyRows.map((month: CashflowRowLike) => (
                  <tr key={month.month}>
                    <td className="font-medium">{month.month}</td>
                    <td>
                      <ReportValueStack
                        value={formatMoney(month.inflows)}
                        strong
                      />
                    </td>
                    <td>
                      <ReportValueStack
                        value={formatMoney(month.outflows)}
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
                    <td>
                      <ReportValueStack value={formatMoney(month.portfolioReceivable)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!isCashFlowLoading && displayedMonthlyRows.length > 0 ? (
              <tfoot>
                <tr>
                  <th>{tTerm('reports.cashflow.table.total')}</th>
                  <td><ReportValueStack value={formatMoney(summary.totalInflows)} strong /></td>
                  <td><ReportValueStack value={formatMoney(summary.totalOutflows)} /></td>
                  <td>
                    <ReportValueStack
                      value={formatMoney(summary.netProfitIndicator)}
                      tone={Number(summary.netProfitIndicator || 0) < 0 ? 'negative' : 'positive'}
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
                  <td><ReportValueStack value={formatMoney(summary.portfolioReceivable)} /></td>
                </tr>
              </tfoot>
            ) : null}
      </ReportDataTableSection>
    </div>
  );
}
