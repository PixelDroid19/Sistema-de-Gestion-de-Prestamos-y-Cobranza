import { useState } from 'react';
import { AlertCircle, DollarSign, TrendingUp, Users, Wallet } from 'lucide-react';
import { formatCurrency as formatCurrencyValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { parseReportYearInput } from '../../lib/reportYearInput';
import {
  AppInput,
  FormField,
} from '../shared/Surfaces';
import ReportDownloadModal, { ReportDownloadTrigger } from './ReportDownloadModal';
import { ReportDataTableSection } from './ReportDataTableSection';
import { ReportMetricsSection } from './ReportMetricsSection';
import { ReportSubsectionHeading } from './ReportSubsectionHeading';
import { ReportTabPanel } from './ReportTabPanel';

const formatMoney = (value: unknown) => formatCurrencyValue(value);

type CashflowTabProps = {
  cashFlowYear: number;
  onCashFlowYearChange: (year: number) => void;
  cashFlowRange: { fromDate: string; toDate: string };
  onCashFlowRangeChange: (range: { fromDate: string; toDate: string }) => void;
  cashFlowData: any;
  isCashFlowLoading: boolean;
  annualCashFlowData: any;
  isAnnualCashFlowLoading: boolean;
  dailyCashFlowDate: string;
  onDailyCashFlowDateChange: (date: string) => void;
  dailyCashFlowData: any;
  isDailyCashFlowLoading: boolean;
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
  annualCashFlowData,
  isAnnualCashFlowLoading,
  dailyCashFlowDate,
  onDailyCashFlowDateChange,
  dailyCashFlowData,
  isDailyCashFlowLoading,
  isCashFlowExporting,
  onExportCashFlow,
  reportExportGuard,
}: CashflowTabProps) {
  const [downloadOpen, setDownloadOpen] = useState(false);

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
        title={tTerm('reports.cashflow.title')}
        subtitle={tTerm('reports.cashflow.subtitle')}
        filterColumns={4}
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
            <FormField label={tTerm('reports.cashflow.daily.date')}>
              <AppInput
                variant="date"
                value={dailyCashFlowDate}
                onValueChange={(v) => onDailyCashFlowDateChange(v)}
              />
            </FormField>
          </>
        )}
        headerActions={reportExportGuard.visible ? (
          <ReportDownloadTrigger
            onClick={() => setDownloadOpen(true)}
            disabled={!reportExportGuard.executable}
          />
        ) : null}
      />

      {downloadOpen && (
        <ReportDownloadModal
          onClose={() => setDownloadOpen(false)}
          title={tTerm('reports.download.cashflow.title')}
          subtitle={tTerm('reports.download.cashflow.subtitle')}
          isExporting={Boolean(isCashFlowExporting)}
          formats={['excel', 'pdf']}
          onDownload={(format) => onExportCashFlow(format === 'pdf' ? 'pdf' : 'excel')}
        />
      )}

      <ReportMetricsSection
        primaryAriaLabel={tTerm('reports.cashflow.summary.aria')}
        secondaryAriaLabel={tTerm('reports.cashflow.detail.aria')}
        detailModalTitle={tTerm('reports.cashflow.detail.modal.title')}
        detailModalSubtitle={tTerm('reports.cashflow.detail.modal.subtitle')}
        primaryItems={[
          {
            id: 'cashflow-inflows',
            label: tTerm('reports.cashflow.summary.inflows.label'),
            value: formatMoney(cashFlowData?.summary?.totalInflows),
            helper: tTerm('reports.cashflow.summary.inflows.helper'),
            icon: <Wallet size={18} />,
            accent: 'emerald',
          },
          {
            id: 'cashflow-outflows',
            label: tTerm('reports.cashflow.summary.outflows.label'),
            value: formatMoney(cashFlowData?.summary?.totalOutflows),
            helper: tTerm('reports.cashflow.summary.outflows.helper'),
            icon: <DollarSign size={18} />,
            accent: 'blue',
          },
          {
            id: 'cashflow-available',
            label: tTerm('reports.cashflow.summary.available.label'),
            value: formatMoney(cashFlowData?.summary?.availableCash),
            helper: tTerm('reports.cashflow.summary.available.helper'),
            icon: <TrendingUp size={18} />,
            accent: Number(cashFlowData?.summary?.availableCash || 0) < 0 ? 'rose' : 'slate',
          },
          {
            id: 'cashflow-net-result',
            label: tTerm('reports.cashflow.summary.netResult.label'),
            value: formatMoney(cashFlowData?.summary?.netProfitIndicator),
            helper: tTerm('reports.cashflow.summary.netResult.helper'),
            icon: <AlertCircle size={18} />,
            accent: Number(cashFlowData?.summary?.netProfitIndicator || 0) < 0 ? 'rose' : 'emerald',
          },
        ]}
        secondaryItems={[
          {
            id: 'cashflow-profit',
            label: tTerm('reports.cashflow.detail.profit.label'),
            value: formatMoney(cashFlowData?.summary?.totalCollectedProfit),
            helper: tTerm('reports.cashflow.detail.profit.helper'),
            icon: <TrendingUp size={18} />,
            accent: 'emerald',
          },
          {
            id: 'cashflow-portfolio-receivable',
            label: tTerm('reports.cashflow.detail.portfolioReceivable.label'),
            value: formatMoney(cashFlowData?.summary?.portfolioReceivable),
            helper: tTerm('reports.cashflow.detail.portfolioReceivable.helper'),
            icon: <Wallet size={18} />,
            accent: 'slate',
          },
          {
            id: 'cashflow-principal-recovered',
            label: tTerm('reports.cashflow.detail.principalRecovered.label'),
            value: formatMoney(cashFlowData?.summary?.totalPrincipalRecovered),
            helper: tTerm('reports.cashflow.detail.principalRecovered.helper'),
            icon: <DollarSign size={18} />,
            accent: 'emerald',
          },
          {
            id: 'cashflow-associate-payments',
            label: tTerm('reports.cashflow.detail.associatePayments.label'),
            value: formatMoney(cashFlowData?.summary?.totalAssociatePayments),
            helper: tTerm('reports.cashflow.detail.associatePayments.helper'),
            icon: <Users size={18} />,
            accent: 'blue',
          },
          {
            id: 'cashflow-operating-expenses',
            label: tTerm('reports.cashflow.detail.operatingExpenses.label'),
            value: formatMoney(cashFlowData?.summary?.totalOperatingExpenses),
            helper: tTerm('reports.cashflow.detail.operatingExpenses.helper'),
            icon: <Wallet size={18} />,
            accent: 'amber',
          },
          {
            id: 'cashflow-loss-risk',
            label: tTerm('reports.cashflow.detail.lossRisk.label'),
            value: formatMoney(cashFlowData?.summary?.lossesAtRisk),
            helper: tTerm('reports.cashflow.detail.lossRisk.helper'),
            icon: <AlertCircle size={18} />,
            accent: 'rose',
          },
        ]}
      />

      <ReportDataTableSection
        title={tTerm('reports.cashflow.table.title')}
        subtitle={tTerm('reports.cashflow.table.subtitle')}
      >
            <thead>
              <tr>
                <th>{tTerm('reports.cashflow.table.month')}</th>
                <th>{tTerm('reports.cashflow.table.inflows')}</th>
                <th>{tTerm('reports.cashflow.table.outflows')}</th>
                <th>{tTerm('reports.cashflow.table.associatePayments')}</th>
                <th>{tTerm('reports.cashflow.table.operatingExpenses')}</th>
                <th>{tTerm('reports.cashflow.table.netFlow')}</th>
                <th>{tTerm('reports.cashflow.table.available')}</th>
                <th>{tTerm('reports.cashflow.table.portfolioReceivable')}</th>
                <th>{tTerm('reports.cashflow.table.principalRecovered')}</th>
                <th>{tTerm('reports.cashflow.table.profit')}</th>
                <th>{tTerm('reports.cashflow.table.lossRisk')}</th>
              </tr>
            </thead>
            <tbody>
              {isCashFlowLoading ? (
                <tr>
                  <td colSpan={11} className="table-empty-state">{tTerm('reports.cashflow.table.loading')}</td>
                </tr>
              ) : (cashFlowData?.months || []).length === 0 ? (
                <tr>
                  <td colSpan={11} className="table-empty-state">{tTerm('reports.cashflow.table.empty')}</td>
                </tr>
              ) : (
                (cashFlowData?.months || []).map((month: any) => (
                  <tr key={month.month}>
                    <td className="font-medium">{month.month}</td>
                    <td className="text-emerald-600">{formatMoney(month.inflows)}</td>
                    <td className="text-blue-600">{formatMoney(month.outflows)}</td>
                    <td className="text-blue-600">{formatMoney(month.associatePayments)}</td>
                    <td className="text-amber-600">{formatMoney(month.operatingExpenses)}</td>
                    <td className={Number(month.netCashFlow || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {formatMoney(month.netCashFlow)}
                    </td>
                    <td className="font-semibold">{formatMoney(month.availableCash)}</td>
                    <td className="font-semibold">{formatMoney(month.portfolioReceivable)}</td>
                    <td className="text-emerald-600">{formatMoney(month.principalRecovered)}</td>
                    <td className="text-emerald-600">{formatMoney(month.collectedProfit)}</td>
                    <td className={Number(month.lossesAtRisk || 0) > 0 ? 'text-rose-600' : 'text-text-secondary'}>
                      {formatMoney(month.lossesAtRisk)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
      </ReportDataTableSection>

      <ReportDataTableSection
        title={tTerm('reports.cashflow.annual.table.title')}
        subtitle={tTerm('reports.cashflow.annual.table.subtitle')}
      >
            <thead>
              <tr>
                <th>{tTerm('reports.cashflow.annual.table.year')}</th>
                <th>{tTerm('reports.cashflow.table.inflows')}</th>
                <th>{tTerm('reports.cashflow.table.outflows')}</th>
                <th>{tTerm('reports.cashflow.table.associatePayments')}</th>
                <th>{tTerm('reports.cashflow.table.operatingExpenses')}</th>
                <th>{tTerm('reports.cashflow.table.netFlow')}</th>
                <th>{tTerm('reports.cashflow.table.portfolioReceivable')}</th>
                <th>{tTerm('reports.cashflow.table.principalRecovered')}</th>
                <th>{tTerm('reports.cashflow.table.profit')}</th>
                <th>{tTerm('reports.cashflow.table.lossRisk')}</th>
              </tr>
            </thead>
            <tbody>
              {isAnnualCashFlowLoading ? (
                <tr>
                  <td colSpan={10} className="table-empty-state">{tTerm('reports.cashflow.annual.table.loading')}</td>
                </tr>
              ) : (annualCashFlowData?.years || []).length === 0 ? (
                <tr>
                  <td colSpan={10} className="table-empty-state">{tTerm('reports.cashflow.annual.table.empty')}</td>
                </tr>
              ) : (
                (annualCashFlowData?.years || []).map((year: any) => (
                  <tr key={year.year}>
                    <td className="font-medium">{year.year}</td>
                    <td className="text-emerald-600">{formatMoney(year.inflows)}</td>
                    <td className="text-blue-600">{formatMoney(year.outflows)}</td>
                    <td className="text-blue-600">{formatMoney(year.associatePayments)}</td>
                    <td className="text-amber-600">{formatMoney(year.operatingExpenses)}</td>
                    <td className={Number(year.netCashFlow || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {formatMoney(year.netCashFlow)}
                    </td>
                    <td className="font-semibold">{formatMoney(year.portfolioReceivable)}</td>
                    <td className="text-emerald-600">{formatMoney(year.principalRecovered)}</td>
                    <td className="text-emerald-600">{formatMoney(year.collectedProfit)}</td>
                    <td className={Number(year.lossesAtRisk || 0) > 0 ? 'text-rose-600' : 'text-text-secondary'}>
                      {formatMoney(year.lossesAtRisk)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
      </ReportDataTableSection>

      <ReportSubsectionHeading
        title={tTerm('reports.cashflow.daily.title')}
        subtitle={tTerm('reports.cashflow.daily.subtitle')}
      />

      <ReportMetricsSection
        primaryAriaLabel={tTerm('reports.cashflow.daily.summary.aria')}
        secondaryAriaLabel={tTerm('reports.cashflow.daily.summary.aria')}
        detailModalTitle={tTerm('reports.cashflow.daily.detail.modal.title')}
        detailModalSubtitle={tTerm('reports.cashflow.daily.detail.modal.subtitle')}
        primaryItems={[
          {
            id: 'daily-cashflow-inflows',
            label: tTerm('reports.cashflow.summary.inflows.label'),
            value: formatMoney(dailyCashFlowData?.summary?.totalInflows),
            helper: tTerm('reports.cashflow.summary.inflows.helper'),
            icon: <Wallet size={18} />,
            accent: 'emerald',
          },
          {
            id: 'daily-cashflow-outflows',
            label: tTerm('reports.cashflow.summary.outflows.label'),
            value: formatMoney(dailyCashFlowData?.summary?.totalOutflows),
            helper: tTerm('reports.cashflow.summary.outflows.helper'),
            icon: <DollarSign size={18} />,
            accent: 'blue',
          },
          {
            id: 'daily-cashflow-associate-payments',
            label: tTerm('reports.cashflow.detail.associatePayments.label'),
            value: formatMoney(dailyCashFlowData?.summary?.totalAssociatePayments),
            helper: tTerm('reports.cashflow.detail.associatePayments.helper'),
            icon: <Users size={18} />,
            accent: 'blue',
          },
          {
            id: 'daily-cashflow-expenses',
            label: tTerm('reports.cashflow.detail.operatingExpenses.label'),
            value: formatMoney(dailyCashFlowData?.summary?.totalOperatingExpenses),
            helper: tTerm('reports.cashflow.detail.operatingExpenses.helper'),
            icon: <Wallet size={18} />,
            accent: 'amber',
          },
          {
            id: 'daily-cashflow-available',
            label: tTerm('reports.cashflow.summary.available.label'),
            value: formatMoney(dailyCashFlowData?.summary?.availableCash),
            helper: tTerm('reports.cashflow.daily.available.helper'),
            icon: <TrendingUp size={18} />,
            accent: 'slate',
          },
        ]}
      />

      <ReportDataTableSection
        title={tTerm('reports.cashflow.daily.table.title')}
        subtitle={tTerm('reports.cashflow.daily.table.subtitle')}
      >
            <thead>
              <tr>
                <th>{tTerm('reports.cashflow.daily.table.date')}</th>
                <th>{tTerm('reports.cashflow.table.inflows')}</th>
                <th>{tTerm('reports.cashflow.table.outflows')}</th>
                <th>{tTerm('reports.cashflow.table.associatePayments')}</th>
                <th>{tTerm('reports.cashflow.table.operatingExpenses')}</th>
                <th>{tTerm('reports.cashflow.table.netFlow')}</th>
                <th>{tTerm('reports.cashflow.table.available')}</th>
              </tr>
            </thead>
            <tbody>
              {isDailyCashFlowLoading ? (
                <tr>
                  <td colSpan={7} className="table-empty-state">{tTerm('reports.cashflow.daily.table.loading')}</td>
                </tr>
              ) : (dailyCashFlowData?.days || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty-state">{tTerm('reports.cashflow.daily.table.empty')}</td>
                </tr>
              ) : (
                (dailyCashFlowData?.days || []).map((day: any) => (
                  <tr key={day.date}>
                    <td className="font-medium">{day.date}</td>
                    <td className="text-emerald-600">{formatMoney(day.inflows)}</td>
                    <td className="text-blue-600">{formatMoney(day.outflows)}</td>
                    <td className="text-blue-600">{formatMoney(day.associatePayments)}</td>
                    <td className="text-amber-600">{formatMoney(day.operatingExpenses)}</td>
                    <td className={Number(day.netCashFlow || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {formatMoney(day.netCashFlow)}
                    </td>
                    <td className="font-semibold">{formatMoney(day.availableCash)}</td>
                  </tr>
                ))
              )}
            </tbody>
      </ReportDataTableSection>
    </div>
  );
}
