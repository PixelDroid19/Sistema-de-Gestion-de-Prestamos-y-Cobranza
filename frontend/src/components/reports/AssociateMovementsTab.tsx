import { useMemo, useState } from 'react';
import { exportAssociatesExcel, useAssociateTracking } from '../../services/associateService';
import { formatCurrency, formatDate } from '../../i18n/format';
import { tTerm } from '../../i18n/terminology';
import { ActionButton, AppInput, DataTableSurface, EmptyState, FormField, OperationalSelect, SectionSurface } from '../shared/Surfaces';
import { AppTable, TABLE_EMBEDDED_SHELL_CLASS, TableSectionIntro } from '../shared/tables';

export default function AssociateMovementsTab() {
  const [filters, setFilters] = useState({ search: '', status: 'all', fromDate: '', toDate: '' });
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const queryFilters = useMemo(() => ({
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.status !== 'all' ? { status: filters.status } : {}),
  }), [filters.search, filters.status]);
  const { data, isLoading } = useAssociateTracking(queryFilters);
  const tracking = data?.data?.tracking || {};
  const rows = Array.isArray(tracking.associates) ? tracking.associates : [];

  const runExport = async (format: 'xlsx' | 'pdf') => {
    setExporting(format);
    try {
      await exportAssociatesExcel({ ...queryFilters, fromDate: filters.fromDate || undefined, toDate: filters.toDate || undefined, format });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <SectionSurface bodyClassName="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <FormField label={tTerm('reports.associates.filter.search')}><AppInput value={filters.search} onValueChange={(search) => setFilters((current) => ({ ...current, search }))} placeholder={tTerm('reports.associates.filter.searchPlaceholder')} /></FormField>
        <FormField label={tTerm('reports.associates.filter.status')}><OperationalSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">{tTerm('reports.associates.filter.allStatuses')}</option><option value="active">{tTerm('common.status.active')}</option><option value="inactive">{tTerm('common.status.inactive')}</option></OperationalSelect></FormField>
        <FormField label={tTerm('reports.associates.filter.from')}><AppInput variant="date" value={filters.fromDate} onValueChange={(fromDate) => setFilters((current) => ({ ...current, fromDate }))} /></FormField>
        <FormField label={tTerm('reports.associates.filter.to')}><AppInput variant="date" value={filters.toDate} onValueChange={(toDate) => setFilters((current) => ({ ...current, toDate }))} /></FormField>
      </SectionSurface>

      <DataTableSurface>
        <TableSectionIntro embedded title={tTerm('reports.associates.title')} description={tTerm('reports.associates.description')} aside={<div className="flex gap-2"><ActionButton onClick={() => void runExport('xlsx')} disabled={exporting !== null}>{tTerm('reports.cashflow.cta.excel')}</ActionButton><ActionButton variant="ghost" onClick={() => void runExport('pdf')} disabled={exporting !== null}>{tTerm('reports.cashflow.cta.pdf')}</ActionButton></div>} />
        <AppTable variant="operational" hasData={rows.length > 0} emptyContent={<EmptyState title={isLoading ? tTerm('reports.state.loading') : tTerm('reports.associates.empty')} compact />} recordsLabel={tTerm('reports.associates.recordsLabel')} className={TABLE_EMBEDDED_SHELL_CLASS} surfaceClassName={TABLE_EMBEDDED_SHELL_CLASS}>
          <thead><tr><th>{tTerm('reports.associates.header.associate')}</th><th>{tTerm('reports.associates.header.capital')}</th><th>{tTerm('reports.associates.header.paid')}</th><th>{tTerm('reports.associates.header.pending')}</th><th>{tTerm('reports.associates.header.returned')}</th><th>{tTerm('reports.associates.header.nextPayment')}</th></tr></thead>
          <tbody>{rows.map((row: any) => <tr key={row.associate?.id}><td><p className="font-semibold text-text-primary">{row.associate?.name}</p><p className="text-xs text-text-secondary">{row.associate?.email}</p></td><td className="font-mono tabular-nums">{formatCurrency(row.currentCapital)}</td><td className="font-mono tabular-nums">{formatCurrency(row.interestPaid)}</td><td className="font-mono tabular-nums">{formatCurrency(Number(row.interestPending || 0) + Number(row.interestOverdue || 0))}</td><td className="font-mono tabular-nums">{formatCurrency(row.totalCapitalReturned)}</td><td>{row.nextPaymentDate ? formatDate(row.nextPaymentDate) : tTerm('common.notAvailable')}</td></tr>)}</tbody>
        </AppTable>
      </DataTableSurface>
    </div>
  );
}
