import React, { useState } from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../types/audit';
import { getAuditActionLabel, getAuditModuleLabel, normalizeAuditEntityTypeInput } from '../lib/auditPresentation';

export interface FilterValues {
  userId?: string;
  action?: string;
  module?: string;
  entityId?: string;
  entityType?: string;
  ip?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface AuditFiltersProps {
  values?: FilterValues;
  onFilter: (filters: FilterValues) => void;
  onReset: () => void;
}

const emptyFilters: FilterValues = {
  userId: '',
  action: '',
  module: '',
  entityId: '',
  entityType: '',
  ip: '',
  dateFrom: '',
  dateTo: '',
};

export default function AuditFilters({ values, onFilter, onReset }: AuditFiltersProps) {
  const [filters, setFilters] = useState<FilterValues>({
    ...emptyFilters,
    ...values,
  });

  React.useEffect(() => {
    setFilters({ ...emptyFilters, ...values });
  }, [values]);

  const handleChange = (field: keyof FilterValues, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedFilters: FilterValues = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim() !== '') {
        cleanedFilters[key as keyof FilterValues] = key === 'entityType'
          ? normalizeAuditEntityTypeInput(value)
          : value;
      }
    });
    onFilter(cleanedFilters);
  };

  const handleReset = () => {
    setFilters(emptyFilters);
    onReset();
  };

  return (
    <form onSubmit={handleSubmit} className="toolbar-surface audit-filter-surface">
      <div className="grid w-full grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,1.35fr)_minmax(170px,0.65fr)_minmax(190px,0.75fr)]">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Buscar evento
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={filters.entityId}
              onChange={(e) => handleChange('entityId', e.target.value)}
              placeholder="ID de entidad, crédito, pago o recurso afectado"
              className="w-full rounded-xl border border-border-subtle bg-bg-base py-2.5 pl-9 pr-3 text-sm text-text-primary outline-none transition focus:border-brand-primary"
            />
          </div>
          <p className="mt-1 text-xs text-text-secondary">Útil para seguir el ciclo completo de un crédito, pago o usuario.</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            IP origen
          </label>
          <input
            type="text"
            value={filters.ip}
            onChange={(e) => handleChange('ip', e.target.value)}
            placeholder="Ej: 190.12.44"
            className="w-full rounded-xl border border-border-subtle bg-bg-base px-3 py-2.5 font-mono text-sm text-text-primary outline-none transition focus:border-brand-primary"
          />
          <p className="mt-1 text-xs text-text-secondary">Filtra toda actividad registrada por una IP.</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Servicio
          </label>
          <select
            value={filters.module}
            onChange={(e) => handleChange('module', e.target.value)}
            className="w-full rounded-xl border border-border-subtle bg-bg-base px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-brand-primary"
          >
            <option value="">Todos</option>
            {AUDIT_MODULES.map((mod) => (
              <option key={mod} value={mod}>
                {getAuditModuleLabel(mod)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(160px,0.7fr)_minmax(140px,0.6fr)_minmax(180px,0.75fr)_minmax(300px,1.25fr)]">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Acción
          </label>
          <select
            value={filters.action}
            onChange={(e) => handleChange('action', e.target.value)}
            className="w-full rounded-xl border border-border-subtle bg-bg-base px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-brand-primary"
          >
            <option value="">Todas las acciones</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {getAuditActionLabel(action)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            ID usuario
          </label>
          <input
            type="text"
            value={filters.userId}
            onChange={(e) => handleChange('userId', e.target.value)}
            placeholder="Usuario"
            className="w-full rounded-xl border border-border-subtle bg-bg-base px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-brand-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Tipo de entidad
          </label>
          <input
            type="text"
            value={filters.entityType}
            onChange={(e) => handleChange('entityType', e.target.value)}
            placeholder="Crédito, usuario o pago"
            className="w-full rounded-xl border border-border-subtle bg-bg-base px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-brand-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Rango de fechas
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleChange('dateFrom', e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-bg-base px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-brand-primary"
              aria-label="Fecha desde"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleChange('dateTo', e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-bg-base px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-brand-primary"
              aria-label="Fecha hasta"
            />
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-bg-base px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:bg-hover-bg"
        >
          <RotateCcw size={16} />
          Limpiar
        </button>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
        >
          <Filter size={16} />
          Aplicar filtros
        </button>
      </div>
    </form>
  );
}
