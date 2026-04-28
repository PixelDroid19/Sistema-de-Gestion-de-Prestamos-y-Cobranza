import React, { useMemo, useState } from 'react';
import { Activity, Code2, Globe2, Server, UserRound, X } from 'lucide-react';
import { AuditLog } from '../services/auditService';
import {
  formatAuditDate,
  getAuditActionLabel,
  getAuditActionTone,
  getAuditMethod,
  getAuditModuleLabel,
  getAuditPath,
  getAuditServiceLabel,
} from '../lib/auditPresentation';

interface AuditDetailModalProps {
  auditLog: AuditLog | null;
  onClose: () => void;
}

type DetailTab = 'resumen' | 'cambios' | 'metadatos';

type FactProps = {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
};

const tabLabels: Record<DetailTab, string> = {
  resumen: 'Resumen',
  cambios: 'Cambios',
  metadatos: 'Metadatos',
};

const hasData = (data: unknown) => {
  if (!data) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === 'object') return Object.keys(data as Record<string, unknown>).length > 0;
  return true;
};

function Fact({ label, value, mono = false }: FactProps) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">{label}</p>
      <div className={`mt-1 truncate text-sm font-semibold text-text-primary ${mono ? 'font-mono' : ''}`} title={typeof value === 'string' ? value : undefined}>
        {value || 'No registrado'}
      </div>
    </div>
  );
}

function JsonPanel({ title, data }: { title: string; data: unknown }) {
  const formatted = hasData(data) ? JSON.stringify(data, null, 2) : 'Sin datos registrados';

  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{title}</h3>
      <pre className="max-h-64 overflow-auto rounded-xl border border-border-subtle bg-bg-base p-3 text-xs leading-5 text-text-primary">
        {formatted}
      </pre>
    </section>
  );
}

export default function AuditDetailModal({ auditLog, onClose }: AuditDetailModalProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('resumen');

  const tabItems = useMemo(() => Object.keys(tabLabels) as DetailTab[], []);

  if (!auditLog) return null;

  const method = getAuditMethod(auditLog);
  const path = getAuditPath(auditLog);
  const service = getAuditServiceLabel(auditLog);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-[0_24px_70px_-35px_rgba(15,23,42,0.65)]">
        <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">Evento auditable</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-text-primary">Detalle de operación</h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-text-secondary">
              Revisa servicio, origen de red, actor y cambios registrados.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-bg-base text-text-secondary transition hover:bg-hover-bg hover:text-text-primary"
            aria-label="Cerrar detalle de auditoría"
          >
            <X size={18} />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4">
          <section className="grid gap-3 border-b border-border-subtle pb-4 md:grid-cols-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <Server size={18} />
              </span>
              <Fact label="Servicio" value={service} mono />
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200">
                <Globe2 size={18} />
              </span>
              <Fact label="IP origen" value={auditLog.ip || 'No registrada'} mono />
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Activity size={18} />
              </span>
              <Fact
                label="Acción"
                value={(
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getAuditActionTone(auditLog.action)}`}>
                    {getAuditActionLabel(auditLog.action)}
                  </span>
                )}
              />
            </div>
          </section>

          <div className="mt-4 flex flex-wrap gap-2 border-b border-border-subtle">
            {tabItems.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-3 py-2 text-sm font-semibold transition ${
                  activeTab === tab
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>

          {activeTab === 'resumen' && (
            <section className="grid gap-x-6 gap-y-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Evento" value={`#${auditLog.id}`} mono />
              <Fact label="Fecha" value={formatAuditDate(auditLog.timestamp)} />
              <Fact label="Usuario" value={auditLog.userName || 'Sistema'} />
              <Fact label="ID usuario" value={auditLog.userId || 'Sin sesión'} mono />
              <Fact label="Área" value={getAuditModuleLabel(auditLog.module)} />
              <Fact label="Entidad" value={auditLog.entityType || 'Sin tipo'} />
              <Fact label="ID entidad" value={auditLog.entityId || 'Sin ID'} mono />
              <Fact label="Método HTTP" value={method || 'No registrado'} mono />
              <Fact label="Ruta" value={path || 'No registrada'} mono />
            </section>
          )}

          {activeTab === 'cambios' && (
            <section className="grid gap-4 py-4 lg:grid-cols-2">
              <JsonPanel title="Datos previos" data={auditLog.previousData} />
              <JsonPanel title="Datos nuevos" data={auditLog.newData} />
            </section>
          )}

          {activeTab === 'metadatos' && (
            <section className="grid gap-4 py-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-bg-base p-3">
                  <UserRound className="mt-0.5 h-5 w-5 text-brand-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">Cliente HTTP</p>
                    <p className="mt-1 break-words font-mono text-xs leading-5 text-text-secondary">
                      {auditLog.userAgent || 'User agent no registrado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-bg-base p-3">
                  <Code2 className="mt-0.5 h-5 w-5 text-text-secondary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">Contexto de servicio</p>
                    <p className="mt-1 break-words font-mono text-xs leading-5 text-text-secondary">
                      {[method, path].filter(Boolean).join(' ') || 'Sin contexto HTTP registrado'}
                    </p>
                  </div>
                </div>
              </div>
              <JsonPanel title="Metadatos técnicos" data={auditLog.metadata} />
            </section>
          )}
        </div>

        <footer className="flex justify-end border-t border-border-subtle bg-bg-base px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border-subtle bg-bg-surface px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-hover-bg hover:text-text-primary"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
