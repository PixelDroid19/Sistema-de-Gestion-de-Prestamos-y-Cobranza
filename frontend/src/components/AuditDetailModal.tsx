import React, { useMemo, useState } from 'react';
import { Activity, Code2, Globe2, Server, UserRound } from 'lucide-react';
import { AuditLog } from '../services/auditService';
import { ActionButton, ModalShell, ViewTabs } from './shared/Surfaces';
import {
  formatAuditDate,
  getAuditEntityTypeLabel,
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
    <ModalShell
      title="Detalle de operación"
      subtitle="Revisa servicio, origen de red, actor y cambios registrados."
      maxWidthClassName="max-w-4xl"
      footer={<ActionButton onClick={onClose}>Cerrar</ActionButton>}
    >
        <div className="overflow-y-auto">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">Evento auditable</p>
          <section className="grid gap-3 border-b border-border-subtle pb-4 md:grid-cols-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <Server size={18} />
              </span>
              <Fact label="Servicio" value={service} mono />
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200">
                <Globe2 size={18} />
              </span>
              <Fact label="IP origen" value={auditLog.ip || 'No registrada'} mono />
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
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

          <ViewTabs
            className="mt-4"
            ariaLabel="Detalle de auditoría"
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as DetailTab)}
            tabs={tabItems.map((tab) => ({ id: tab, label: tabLabels[tab] }))}
          />

          {activeTab === 'resumen' && (
            <section className="grid gap-x-6 gap-y-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Evento" value={`#${auditLog.id}`} mono />
              <Fact label="Fecha" value={formatAuditDate(auditLog.timestamp)} />
              <Fact label="Usuario" value={auditLog.userName || 'Sistema'} />
              <Fact label="ID usuario" value={auditLog.userId || 'Sin sesión'} mono />
              <Fact label="Área" value={getAuditModuleLabel(auditLog.module)} />
              <Fact label="Entidad" value={getAuditEntityTypeLabel(auditLog.entityType)} />
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
                  <UserRound className="mt-0.5 size-5 text-brand-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">Cliente HTTP</p>
                    <p className="mt-1 break-words font-mono text-xs leading-5 text-text-secondary">
                      {auditLog.userAgent || 'User agent no registrado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-bg-base p-3">
                  <Code2 className="mt-0.5 size-5 text-text-secondary" />
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
    </ModalShell>
  );
}
