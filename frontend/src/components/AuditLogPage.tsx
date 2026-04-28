import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock, Network, ShieldCheck } from 'lucide-react';
import { useAuditLogs, useAuditStats, AuditLog } from '../services/auditService';
import AuditFilters, { FilterValues } from './AuditFilters';
import AuditTable from './AuditTable';
import AuditDetailModal from './AuditDetailModal';
import { MetricCard, PageHeader, PageShell } from './shared/Surfaces';
import { getAuditActionLabel, getAuditModuleLabel } from '../lib/auditPresentation';

export default function AuditLogPage() {
  const [filters, setFilters] = useState<FilterValues>({});
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { logs, pagination, isLoading } = useAuditLogs({ ...filters, page, pageSize: 25 });
  const { stats: auditStats, isLoading: statsLoading } = useAuditStats();

  const totalEvents = useMemo(
    () => auditStats.reduce((acc, stat) => acc + Number(stat.totalCount || 0), 0),
    [auditStats]
  );

  const currentPageIps = useMemo(() => {
    const uniqueIps = new Set(logs.map((log) => log.ip).filter(Boolean));
    return uniqueIps.size;
  }, [logs]);

  const topModule = useMemo(() => {
    const first = [...auditStats].sort((a, b) => Number(b.totalCount || 0) - Number(a.totalCount || 0))[0];
    return first ? `${getAuditModuleLabel(first.module)} (${first.totalCount})` : 'Sin actividad';
  }, [auditStats]);

  const topAction = useMemo(() => {
    const actionCounts = auditStats.reduce<Record<string, number>>((acc, stat) => {
      Object.entries(stat.actions || {}).forEach(([action, count]) => {
        acc[action] = (acc[action] || 0) + Number(count || 0);
      });
      return acc;
    }, {});
    const [action, count] = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0] || [];
    return action ? `${getAuditActionLabel(action)} (${count})` : 'Sin actividad';
  }, [auditStats]);

  const handleFilter = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleReset = () => {
    setFilters({});
    setPage(1);
  };

  const handleIpFilter = (ip: string) => {
    setFilters((current) => ({ ...current, ip }));
    setPage(1);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Observabilidad"
        title="Auditoría operativa"
        subtitle="Revisa quién hizo cada acción, desde qué IP y qué servicio del sistema recibió la operación."
        actions={(
          <div className="rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-secondary">
            Vista para diagnóstico técnico y revisión de incidentes
          </div>
        )}
      />

      {!statsLoading && (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Eventos registrados"
            value={totalEvents.toLocaleString()}
            helper="Histórico auditable"
            icon={<ShieldCheck size={18} />}
            accent="blue"
          />
          <MetricCard
            label="IPs en esta página"
            value={currentPageIps}
            helper="Origen de eventos visibles"
            icon={<Network size={18} />}
            accent="slate"
          />
          <MetricCard
            label="Servicio más activo"
            value={topModule}
            helper="Área con más eventos"
            icon={<Activity size={18} />}
            accent="emerald"
          />
          <MetricCard
            label="Acción frecuente"
            value={topAction}
            helper="Patrón de actividad"
            icon={<Clock size={18} />}
            accent="amber"
          />
        </section>
      )}

      {filters.ip && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Investigando actividad por IP: <span className="font-mono">{filters.ip}</span></p>
            <p className="mt-1 text-xs opacity-80">La tabla muestra acciones que coinciden parcial o totalmente con esa dirección.</p>
          </div>
        </div>
      )}

      <AuditFilters values={filters} onFilter={handleFilter} onReset={handleReset} />

      <AuditTable
        logs={logs}
        pagination={pagination}
        isLoading={isLoading}
        onViewDetails={setSelectedLog}
        onPageChange={setPage}
        onFilterIp={handleIpFilter}
      />

      <AuditDetailModal
        auditLog={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </PageShell>
  );
}
