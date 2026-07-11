import { useEffect, useMemo, useState } from 'react';
import { exportAssociatesExcel, useAssociateMovements } from '../../services/associateService';
import { formatCurrency, formatDate, formatNumber } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { ActionButton, AppInput, DataTableSurface, EmptyState, FormField, InsightStrip, OperationalSelect, SectionSurface } from '../shared/Surfaces';
import { AppTable, TABLE_EMBEDDED_SHELL_CLASS, TableSectionIntro } from '../shared/tables';

const PAGE_SIZE = 20;

const movementLabel = (type: string) => {
  const labels: Record<string, Parameters<typeof tTerm>[0]> = {
    contribution: 'reports.associates.movement.contribution',
    reinvestment: 'reports.associates.movement.reinvestment',
    capital_return: 'reports.associates.movement.capitalReturn',
    manual_profitability: 'reports.associates.movement.manualProfitability',
    scheduled_profitability_paid: 'reports.associates.movement.scheduledPaid',
    scheduled_profitability_pending: 'reports.associates.movement.scheduledPending',
  };
  return tTerm(labels[type] || 'reports.associates.movement.contribution');
};

export default function AssociateMovementsTab() {
  const [filters, setFilters] = useState({ search: '', status: 'all', fromDate: '', toDate: '' });
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const invalidRange = Boolean(filters.fromDate && filters.toDate && filters.fromDate > filters.toDate);
  const queryFilters = useMemo(() => ({
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.status !== 'all' ? { status: filters.status } : {}),
    ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
    ...(filters.toDate ? { toDate: filters.toDate } : {}),
  }), [filters]);
  const { data, isLoading, isError } = useAssociateMovements(queryFilters, { enabled: !invalidRange });
  const report = data?.data?.report || {};
  const rows = Array.isArray(report.rows) ? report.rows : [];
  const summary = report.summary || {};
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visibleRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [queryFilters]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const runExport = async (format: 'xlsx' | 'pdf') => {
    if (invalidRange) return;
    setExporting(format);
    try {
      await exportAssociatesExcel({ ...queryFilters, format });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <SectionSurface bodyClassName="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <FormField label={tTerm('reports.associates.filter.search')}><AppInput value={filters.search} onValueChange={(search) => setFilters((current) => ({ ...current, search }))} placeholder={tTerm('reports.associates.filter.searchPlaceholder')} /></FormField>
        <FormField label={tTerm('reports.associates.filter.status')}><OperationalSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">{tTerm('reports.associates.filter.allStatuses')}</option><option value="active">{tTerm('common.status.active')}</option><option value="inactive">{tTerm('common.status.inactive')}</option></OperationalSelect></FormField>
        <FormField label={tTerm('reports.associates.filter.from')} error={invalidRange ? tTerm('reports.export.invalidRange') : undefined}><AppInput variant="date" value={filters.fromDate} onValueChange={(fromDate) => setFilters((current) => ({ ...current, fromDate }))} /></FormField>
        <FormField label={tTerm('reports.associates.filter.to')}><AppInput variant="date" value={filters.toDate} onValueChange={(toDate) => setFilters((current) => ({ ...current, toDate }))} /></FormField>
      </SectionSurface>

      <InsightStrip density="compact" items={[
        { id: 'movements', label: tTerm('reports.associates.summary.movements'), value: formatNumber(summary.totalMovements || 0), accent: 'slate' },
        { id: 'capital-in', label: tTerm('reports.associates.summary.capitalIn'), value: formatCurrency(Number(summary.contributions || 0) + Number(summary.reinvestments || 0)), accent: 'slate' },
        { id: 'paid', label: tTerm('reports.associates.summary.profitabilityPaid'), value: formatCurrency(summary.profitabilityPaid), accent: 'slate' },
        { id: 'pending', label: tTerm('reports.associates.summary.profitabilityPending'), value: formatCurrency(summary.profitabilityPending), accent: 'slate' },
      ]} />

      <DataTableSurface>
        <TableSectionIntro embedded title={tTerm('reports.associates.title')} description={tTerm('reports.associates.description')} aside={<div className="flex gap-2"><ActionButton onClick={() => void runExport('xlsx')} disabled={invalidRange || exporting !== null}>{tTerm('reports.cashflow.cta.excel')}</ActionButton><ActionButton variant="ghost" onClick={() => void runExport('pdf')} disabled={invalidRange || exporting !== null}>{tTerm('reports.cashflow.cta.pdf')}</ActionButton></div>} />
        <AppTable
          variant="operational"
          isLoading={isLoading}
          isError={isError}
          hasData={visibleRows.length > 0}
          emptyContent={<EmptyState title={invalidRange ? tTerm('reports.export.invalidRange') : tTerm('reports.associates.empty')} compact />}
          recordsLabel={tTerm('reports.associates.recordsLabel')}
          pagination={rows.length > PAGE_SIZE ? { page, pageSize: PAGE_SIZE, totalItems: rows.length, totalPages, onPrev: () => setPage((current) => current - 1), onNext: () => setPage((current) => current + 1) } : undefined}
          className={TABLE_EMBEDDED_SHELL_CLASS}
          surfaceClassName={TABLE_EMBEDDED_SHELL_CLASS}
        >
          <thead><tr><th>{tTerm('reports.associates.header.date')}</th><th>{tTerm('reports.associates.header.associate')}</th><th>{tTerm('reports.associates.header.movement')}</th><th>{tTerm('reports.associates.header.amount')}</th><th>{tTerm('reports.associates.header.reference')}</th></tr></thead>
          <tbody>{visibleRows.map((row: any) => <tr key={`${row.movementType}-${row.id}-${row.associateId}`}><td>{formatDate(row.date)}</td><td className="font-semibold text-text-primary">{row.associateName}</td><td>{movementLabel(row.movementType)}</td><td className="font-mono font-semibold tabular-nums text-text-primary">{formatCurrency(row.amount)}</td><td className="text-text-secondary">{row.reference || tTerm('common.notAvailable')}</td></tr>)}</tbody>
        </AppTable>
      </DataTableSurface>
    </div>
  );
}
