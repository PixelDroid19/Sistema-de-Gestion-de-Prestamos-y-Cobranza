import React from 'react';
import { Database, Network, Server, UserRound, X } from 'lucide-react';
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

type DetailItemProps = {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
};

function DetailItem({ label, value, mono = false }: DetailItemProps) {
  return (
    <div className="min-w-0 border-t border-border-subtle pt-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-secondary">{label}</p>
      <div className={`mt-1 break-words text-sm font-semibold text-text-primary ${mono ? 'font-mono' : ''}`}>
        {value || 'No registrado'}
      </div>
    </div>
  );
}

function JsonBlock({ title, data, tone = 'neutral' }: { title: string; data: unknown; tone?: 'neutral' | 'before' | 'after' }) {
  const formatted = data ? JSON.stringify(data, null, 2) : 'Sin datos registrados';
  const toneClass = {
    neutral: 'border-border-subtle bg-bg-base text-text-primary',
    before: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100',
    after: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
  }[tone];

  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{title}</h3>
      <pre className={`max-h-72 overflow-auto rounded-2xl border p-4 text-xs leading-5 ${toneClass}`}>
        {formatted}
      </pre>
    </section>
  );
}

export default function AuditDetailModal({ auditLog, onClose }: AuditDetailModalProps) {
  if (!auditLog) return null;

  const method = getAuditMethod(auditLog);
  const path = getAuditPath(auditLog);
  const service = getAuditServiceLabel(auditLog);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border-subtle bg-bg-surface shadow-[0_24px_70px_-35px_rgba(15,23,42,0.55)]">
        <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-primary">Evento auditable</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">Detalle técnico de la operación</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
              Identifica el servicio consumido, el origen de red y los datos modificados por esta acción.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-subtle bg-bg-base text-text-secondary transition hover:bg-hover-bg hover:text-text-primary"
            aria-label="Cerrar detalle de auditoría"
          >
            <X size={18} />
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-5">
          <section className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-2xl border border-border-subtle bg-bg-base p-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-2xl bg-brand-primary/10 p-2 text-brand-primary">
                  <Server size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Servicio consumido</p>
                  <p className="mt-1 truncate font-mono text-base font-bold text-text-primary" title={service}>
                    {service}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {method ? `Método ${method}` : 'Método no registrado'}
                    {path ? ` sobre ${path}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-base p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-slate-100 p-2 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200">
                  <Network size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">IP origen</p>
                  <p className="mt-1 font-mono text-base font-bold text-text-primary">{auditLog.ip || 'No registrada'}</p>
                  <p className="mt-1 text-sm text-text-secondary">Úsala en filtros para ver toda la actividad asociada.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-4">
                <div className="mb-4 flex items-center gap-3">
                  <UserRound className="h-5 w-5 text-brand-primary" />
                  <div>
                    <h3 className="font-bold text-text-primary">Actor y contexto</h3>
                    <p className="text-sm text-text-secondary">Quién ejecutó la acción y contra qué recurso.</p>
                  </div>
                </div>
                <div className="grid gap-3">
                  <DetailItem label="Evento" value={`#${auditLog.id}`} mono />
                  <DetailItem label="Fecha" value={formatAuditDate(auditLog.timestamp)} />
                  <DetailItem label="Usuario" value={auditLog.userName || 'Sistema'} />
                  <DetailItem label="ID usuario" value={auditLog.userId || 'Sin sesión'} mono />
                  <DetailItem
                    label="Acción"
                    value={(
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getAuditActionTone(auditLog.action)}`}>
                        {getAuditActionLabel(auditLog.action)}
                      </span>
                    )}
                  />
                  <DetailItem label="Área" value={getAuditModuleLabel(auditLog.module)} />
                  <DetailItem label="Entidad" value={auditLog.entityType || 'Sin tipo'} />
                  <DetailItem label="ID entidad" value={auditLog.entityId || 'Sin ID'} mono />
                </div>
              </div>

              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Database className="h-5 w-5 text-text-secondary" />
                  <h3 className="font-bold text-text-primary">Cliente HTTP</h3>
                </div>
                <p className="rounded-2xl border border-border-subtle bg-bg-base p-3 font-mono text-xs leading-5 text-text-secondary">
                  {auditLog.userAgent || 'User agent no registrado'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <JsonBlock title="Datos previos" data={auditLog.previousData} tone="before" />
                <JsonBlock title="Datos nuevos" data={auditLog.newData} tone="after" />
              </div>
              <JsonBlock title="Metadatos técnicos" data={auditLog.metadata} />
            </div>
          </section>
        </div>

        <footer className="flex justify-end border-t border-border-subtle bg-bg-base px-6 py-4">
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
