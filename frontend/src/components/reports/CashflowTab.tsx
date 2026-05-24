import React from 'react';
import { AlertCircle, DollarSign, Download, TrendingUp, Users, Wallet } from 'lucide-react';
import { formatCurrency as formatCurrencyValue, formatNumber as formatNumberValue } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { parseReportYearInput } from '../../lib/reportYearInput';
import {
  ActionButton,
  DataTableSurface,
  FormField,
  InsightStrip,
  TextInput,
  ToolbarSurface,
} from '../shared/Surfaces';

const formatMoney = (value: unknown) => formatCurrencyValue(value);

type CashflowTabProps = {
  cashFlowYear: number;
  onCashFlowYearChange: (year: number) => void;
  cashFlowRange: { fromDate: string; toDate: string };
  onCashFlowRangeChange: (range: { fromDate: string; toDate: string }) => void;
  cashFlowData: any;
  isCashFlowLoading: boolean;
  dailyCashFlowDate: string;
  onDailyCashFlowDateChange: (date: string) => void;
  dailyCashFlowData: any;
  isDailyCashFlowLoading: boolean;
  isCashFlowExporting: 'excel' | 'pdf' | null;
  onExportCashFlow: (format: 'excel' | 'pdf') => void;
  reportExportGuard: { visible: boolean; executable: boolean; reason?: string };
};

export default function CashflowTab({
  cashFlowYear,
  onCashFlowYearChange,
  cashFlowRange,
  onCashFlowRangeChange,
  cashFlowData,
  isCashFlowLoading,
  dailyCashFlowDate,
  onDailyCashFlowDateChange,
  dailyCashFlowData,
  isDailyCashFlowLoading,
  isCashFlowExporting,
  onExportCashFlow,
  reportExportGuard,
}: CashflowTabProps) {
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
    <div className="flex flex-col gap-6">
      <ToolbarSurface className="items-stretch lg:items-end">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-text-primary">{tTerm('reports.cashflow.title')}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {tTerm('reports.cashflow.subtitle')}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <FormField label={tTerm('reports.cashflow.year')}>
            <TextInput
              type="number"
              value={cashFlowYear}
              min={2000}
              max={2100}
              onChange={(event) => handleYearChange(event.target.value)}
              className="sm:w-32"
            />
          </FormField>
          <FormField label={tTerm('reports.cashflow.fromDate')}>
            <TextInput
              type="date"
              value={cashFlowRange.fromDate}
              onChange={(event) => updateCashFlowRange('fromDate', event.target.value)}
              className="sm:w-40"
            />
          </FormField>
          <FormField label={tTerm('reports.cashflow.toDate')}>
            <TextInput
              type="date"
              value={cashFlowRange.toDate}
              onChange={(event) => updateCashFlowRange('toDate', event.target.value)}
              className="sm:w-40"
            />
          </FormField>
          <ActionButton
            onClick={() => onExportCashFlow('excel')}
            disabled={Boolean(isCashFlowExporting) || !reportExportGuard.executable}
            title={reportExportGuard.executable ? tTerm('reports.cashflow.cta.exportExcel') : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
            icon={<Download size={16} />}
          >
            {isCashFlowExporting === 'excel' ? tTerm('credits.cta.exporting') : tTerm('reports.cashflow.cta.excel')}
          </ActionButton>
          <ActionButton
            onClick={() => onExportCashFlow('pdf')}
            disabled={Boolean(isCashFlowExporting) || !reportExportGuard.executable}
            title={reportExportGuard.executable ? tTerm('reports.cashflow.cta.exportPdf') : (reportExportGuard.reason || tTerm('credits.action.unavailable'))}
            icon={<Download size={16} />}
          >
            {isCashFlowExporting === 'pdf' ? tTerm('credits.cta.exporting') : tTerm('reports.cashflow.cta.pdf')}
          </ActionButton>
        </div>
      </ToolbarSurface>

      <InsightStrip
        aria-label={tTerm('reports.cashflow.summary.aria')}
        items={[
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
            accent: 'slate',
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
      />

      <InsightStrip
        aria-label={tTerm('reports.cashflow.detail.aria')}
        items={[
          {
            id: 'cashflow-profit',
            label: tTerm('reports.cashflow.detail.profit.label'),
            value: formatMoney(cashFlowData?.summary?.totalCollectedProfit),
            helper: tTerm('reports.cashflow.detail.profit.helper'),
            icon: <TrendingUp size={18} />,
            accent: 'emerald',
          },
          {
            id: 'cashflow-associate-interest-paid',
            label: tTerm('reports.cashflow.detail.associateInterestPaid.label'),
            value: formatMoney(cashFlowData?.summary?.totalAssociateInterestPaid),
            helper: tTerm('reports.cashflow.detail.associateInterestPaid.helper'),
            icon: <DollarSign size={18} />,
            accent: 'blue',
          },
          {
            id: 'cashflow-associate-interest-pending',
            label: tTerm('reports.cashflow.detail.associateInterestPending.label'),
            value: formatMoney(cashFlowData?.summary?.totalAssociateInterestPending),
            helper: tTerm('reports.cashflow.detail.associateInterestPending.helper'),
            icon: <Users size={18} />,
            accent: 'amber',
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
          {
            id: 'cashflow-payment-count',
            label: tTerm('reports.cashflow.detail.paymentCount.label'),
            value: formatNumberValue(cashFlowData?.summary?.paymentCount || 0),
            helper: tTerm('reports.cashflow.detail.paymentCount.helper'),
            icon: <Users size={18} />,
            accent: 'amber',
          },
        ]}
      />

      <ToolbarSurface className="items-stretch lg:items-end">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-text-primary">{tTerm('reports.cashflow.daily.title')}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {tTerm('reports.cashflow.daily.subtitle')}
          </p>
        </div>
        <FormField label={tTerm('reports.cashflow.daily.date')}>
          <TextInput
            type="date"
            value={dailyCashFlowDate}
            onChange={(event) => onDailyCashFlowDateChange(event.target.value)}
            className="sm:w-40"
          />
        </FormField>
      </ToolbarSurface>

      <InsightStrip
        aria-label={tTerm('reports.cashflow.daily.summary.aria')}
        items={[
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
            id: 'daily-cashflow-expenses',
            label: tTerm('reports.cashflow.detail.operatingExpenses.label'),
            value: formatMoney(dailyCashFlowData?.summary?.totalOperatingExpenses),
            helper: tTerm('reports.cashflow.detail.operatingExpenses.helper'),
            icon: <Wallet size={18} />,
            accent: 'amber',
          },
          {
            id: 'daily-cashflow-associate-interest-pending',
            label: tTerm('reports.cashflow.detail.associateInterestPending.label'),
            value: formatMoney(dailyCashFlowData?.summary?.totalAssociateInterestPending),
            helper: tTerm('reports.cashflow.detail.associateInterestPending.helper'),
            icon: <Users size={18} />,
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

      <DataTableSurface>
        <div className="px-4 py-4 sm:px-5">
          <h3 className="font-medium">{tTerm('reports.cashflow.daily.table.title')}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {tTerm('reports.cashflow.daily.table.subtitle')}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th>{tTerm('reports.cashflow.daily.table.date')}</th>
                <th>{tTerm('reports.cashflow.table.inflows')}</th>
                <th>{tTerm('reports.cashflow.table.outflows')}</th>
                <th>{tTerm('reports.cashflow.table.associateInterestPaid')}</th>
                <th>{tTerm('reports.cashflow.table.associateInterestPending')}</th>
                <th>{tTerm('reports.cashflow.table.operatingExpenses')}</th>
                <th>{tTerm('reports.cashflow.table.netFlow')}</th>
                <th>{tTerm('reports.cashflow.table.available')}</th>
              </tr>
            </thead>
            <tbody>
              {isDailyCashFlowLoading ? (
                <tr>
                  <td colSpan={8} className="table-empty-state">{tTerm('reports.cashflow.daily.table.loading')}</td>
                </tr>
              ) : (dailyCashFlowData?.days || []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty-state">{tTerm('reports.cashflow.daily.table.empty')}</td>
                </tr>
              ) : (
                (dailyCashFlowData?.days || []).map((day: any) => (
                  <tr key={day.date}>
                    <td className="font-medium">{day.date}</td>
                    <td className="text-emerald-600">{formatMoney(day.inflows)}</td>
                    <td className="text-blue-600">{formatMoney(day.outflows)}</td>
                    <td className="text-blue-600">{formatMoney(day.associateInterestPaid)}</td>
                    <td className="text-amber-600">{formatMoney(day.associateInterestPending)}</td>
                    <td className="text-amber-600">{formatMoney(day.operatingExpenses)}</td>
                    <td className={Number(day.netCashFlow || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {formatMoney(day.netCashFlow)}
                    </td>
                    <td className="font-semibold">{formatMoney(day.availableCash)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataTableSurface>

      <DataTableSurface>
        <div className="px-4 py-4 sm:px-5">
          <h3 className="font-medium">{tTerm('reports.cashflow.table.title')}</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {tTerm('reports.cashflow.table.subtitle')}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th>{tTerm('reports.cashflow.table.month')}</th>
                <th>{tTerm('reports.cashflow.table.inflows')}</th>
                <th>{tTerm('reports.cashflow.table.outflows')}</th>
                <th>{tTerm('reports.cashflow.table.associateInterestPaid')}</th>
                <th>{tTerm('reports.cashflow.table.associateInterestPending')}</th>
                <th>{tTerm('reports.cashflow.table.operatingExpenses')}</th>
                <th>{tTerm('reports.cashflow.table.netFlow')}</th>
                <th>{tTerm('reports.cashflow.table.available')}</th>
                <th>{tTerm('reports.cashflow.table.profit')}</th>
                <th>{tTerm('reports.cashflow.table.lossRisk')}</th>
              </tr>
            </thead>
            <tbody>
              {isCashFlowLoading ? (
                <tr>
                  <td colSpan={10} className="table-empty-state">{tTerm('reports.cashflow.table.loading')}</td>
                </tr>
              ) : (cashFlowData?.months || []).length === 0 ? (
                <tr>
                  <td colSpan={10} className="table-empty-state">{tTerm('reports.cashflow.table.empty')}</td>
                </tr>
              ) : (
                (cashFlowData?.months || []).map((month: any) => (
                  <tr key={month.month}>
                    <td className="font-medium">{month.month}</td>
                    <td className="text-emerald-600">{formatMoney(month.inflows)}</td>
                    <td className="text-blue-600">{formatMoney(month.outflows)}</td>
                    <td className="text-blue-600">{formatMoney(month.associateInterestPaid)}</td>
                    <td className="text-amber-600">{formatMoney(month.associateInterestPending)}</td>
                    <td className="text-amber-600">{formatMoney(month.operatingExpenses)}</td>
                    <td className={Number(month.netCashFlow || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {formatMoney(month.netCashFlow)}
                    </td>
                    <td className="font-semibold">{formatMoney(month.availableCash)}</td>
                    <td className="text-emerald-600">{formatMoney(month.collectedProfit)}</td>
                    <td className={Number(month.lossesAtRisk || 0) > 0 ? 'text-rose-600' : 'text-text-secondary'}>
                      {formatMoney(month.lossesAtRisk)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataTableSurface>
    </div>
  );
}
