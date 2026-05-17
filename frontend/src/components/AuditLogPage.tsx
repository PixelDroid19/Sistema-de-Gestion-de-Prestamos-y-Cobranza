import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock, Network, Radio, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../i18n';
import { formatNumber } from '../i18n/format';
import { tTerm } from '../i18n/terminology';
import { useAuditLogs, useAuditStats, AuditLog } from '../services/auditService';
import { useAuditStream } from '../services/useAuditStream';
import AuditFilters, { FilterValues } from './AuditFilters';
import AuditTable from './AuditTable';
import AuditDetailModal from './AuditDetailModal';
import { InsightStrip, PageHeader, PageShell } from './shared/Surfaces';
import { getAuditActionLabel, getAuditModuleLabel } from '../lib/auditPresentation';

export default function AuditLogPage() {
  const { locale } = useTranslation();
  const [filters, setFilters] = useState<FilterValues>({});
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [liveEnabled, setLiveEnabled] = useState(false);

  const { logs, pagination, isLoading } = useAuditLogs({ ...filters, page, pageSize: 25 });
  const { stats: auditStats, isLoading: statsLoading } = useAuditStats();
  const { events: liveEvents, connected, clear: clearLive } = useAuditStream({ enabled: liveEnabled });

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
    return first ? `${getAuditModuleLabel(first.module)} (${first.totalCount})` : tTerm('audit.stats.empty');
  }, [auditStats, locale]);

  const topAction = useMemo(() => {
    const actionCounts = auditStats.reduce<Record<string, number>>((acc, stat) => {
      Object.entries(stat.actions || {}).forEach(([action, count]) => {
        acc[action] = (acc[action] || 0) + Number(count || 0);
      });
      return acc;
    }, {});
    const [action, count] = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0] || [];
    return action ? `${getAuditActionLabel(action)} (${count})` : tTerm('audit.stats.empty');
  }, [auditStats, locale]);

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
    <PageShell data-tour="audit-log-page">
      <PageHeader
        eyebrow={tTerm('audit.module.eyebrow')}
        title={tTerm('audit.module.title')}
        subtitle={tTerm('audit.module.subtitle')}
        guideKey="audit-log"
        tourId="audit-log-header"
        actions={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setLiveEnabled((v) => !v); if (liveEnabled) clearLive(); }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                liveEnabled
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-border-subtle bg-bg-surface text-text-secondary hover:bg-bg-surface-hover'
              }`}
              aria-pressed={liveEnabled}
              aria-label={liveEnabled ? 'Desactivar tiempo real' : 'Activar tiempo real'}
            >
              <Radio size={14} className={liveEnabled && connected ? 'animate-pulse' : ''} />
              {liveEnabled ? 'En vivo' : 'Tiempo real'}
            </button>
            <div className="rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-secondary">
              {tTerm('audit.module.diagnostic')}
            </div>
          </div>
        )}
      />

      {!statsLoading && (
        <InsightStrip
          data-tour="audit-log-stats"
          aria-label={tTerm('audit.summary.aria')}
          items={[
            { id: 'audit-total-events', label: tTerm('audit.stats.totalEvents.label'), value: formatNumber(totalEvents), helper: tTerm('audit.stats.totalEvents.helper'), icon: <ShieldCheck size={18} />, accent: 'blue' },
            { id: 'audit-current-ips', label: tTerm('audit.stats.currentIps.label'), value: currentPageIps, helper: tTerm('audit.stats.currentIps.helper'), icon: <Network size={18} />, accent: 'slate' },
            { id: 'audit-top-module', label: tTerm('audit.stats.topModule.label'), value: topModule, helper: tTerm('audit.stats.topModule.helper'), icon: <Activity size={18} />, accent: 'emerald' },
            { id: 'audit-top-action', label: tTerm('audit.stats.topAction.label'), value: topAction, helper: tTerm('audit.stats.topAction.helper'), icon: <Clock size={18} />, accent: 'amber' },
          ]}
        />
      )}

      {filters.ip && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">{tTerm('audit.ipFilter.title', { ip: filters.ip })}</p>
            <p className="mt-1 text-xs opacity-80">{tTerm('audit.ipFilter.description')}</p>
          </div>
        </div>
      )}

      <div data-tour="audit-log-filters">
        <AuditFilters values={filters} onFilter={handleFilter} onReset={handleReset} />
      </div>

      {liveEnabled && liveEvents.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              <Radio size={14} className="animate-pulse" />
              Eventos en tiempo real ({liveEvents.length})
            </h3>
            <button
              type="button"
              onClick={clearLive}
              className="text-xs text-emerald-600 underline hover:text-emerald-800 dark:text-emerald-400"
            >
              Limpiar
            </button>
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {liveEvents.slice(0, 20).map((evt, i) => (
              <div
                key={`${evt.timestamp}-${i}`}
                className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-1.5 text-xs dark:bg-white/5"
              >
                <span className={`inline-block size-2 rounded-full ${
                  evt.severity === 'ERROR' || evt.severity === 'CRITICAL'
                    ? 'bg-red-500'
                    : evt.category === 'SECURITY'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`} />
                <span className="font-mono text-text-secondary">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                <span className="font-medium text-text-primary">{evt.eventType}</span>
                {evt.userId && <span className="text-text-tertiary">user:{evt.userId}</span>}
                <span className="ml-auto rounded bg-bg-surface px-1.5 py-0.5 text-[10px] text-text-tertiary">{evt.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div data-tour="audit-log-table">
        <AuditTable
          logs={logs}
          pagination={pagination}
          isLoading={isLoading}
          onViewDetails={setSelectedLog}
          onPageChange={setPage}
          onFilterIp={handleIpFilter}
        />
      </div>

      <AuditDetailModal
        auditLog={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </PageShell>
  );
}
