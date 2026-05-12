import React, { useState } from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../types/audit';
import { getAuditActionLabel, getAuditModuleLabel, normalizeAuditEntityTypeInput } from '../lib/auditPresentation';
import { ActionButton, FormField, SelectInput, TextInput, ToolbarSurface } from './shared/Surfaces';

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
    <ToolbarSurface as="form" onSubmit={handleSubmit} className="audit-filter-surface">
      <div className="grid w-full grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,1.35fr)_minmax(170px,0.65fr)_minmax(190px,0.75fr)]">
        <FormField label="Buscar evento" helper="Útil para seguir el ciclo completo de un crédito, pago o usuario.">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <TextInput
              id="audit-filter-entity-id"
              type="text"
              value={filters.entityId}
              onChange={(e) => handleChange('entityId', e.target.value)}
              placeholder="ID de entidad, crédito, pago o recurso afectado"
              className="pl-9"
            />
          </div>
        </FormField>

        <FormField label="IP origen" helper="Filtra toda actividad registrada por una IP.">
          <TextInput
            id="audit-filter-ip"
            type="text"
            value={filters.ip}
            onChange={(e) => handleChange('ip', e.target.value)}
            placeholder="Ej: 190.12.44"
            className="font-mono"
          />
        </FormField>

        <FormField label="Servicio">
          <SelectInput
            id="audit-filter-module"
            value={filters.module}
            onChange={(e) => handleChange('module', e.target.value)}
          >
            <option value="">Todos</option>
            {AUDIT_MODULES.map((mod) => (
              <option key={mod} value={mod}>
                {getAuditModuleLabel(mod)}
              </option>
            ))}
          </SelectInput>
        </FormField>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(160px,0.7fr)_minmax(140px,0.6fr)_minmax(180px,0.75fr)_minmax(300px,1.25fr)]">
        <FormField label="Acción">
          <SelectInput
            id="audit-filter-action"
            value={filters.action}
            onChange={(e) => handleChange('action', e.target.value)}
          >
            <option value="">Todas las acciones</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {getAuditActionLabel(action)}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label="ID usuario">
          <TextInput
            id="audit-filter-user-id"
            type="text"
            value={filters.userId}
            onChange={(e) => handleChange('userId', e.target.value)}
            placeholder="Usuario"
          />
        </FormField>

        <FormField label="Tipo de entidad">
          <TextInput
            id="audit-filter-entity-type"
            type="text"
            value={filters.entityType}
            onChange={(e) => handleChange('entityType', e.target.value)}
            placeholder="Crédito, usuario o pago"
          />
        </FormField>

        <FormField label="Rango de fechas">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <TextInput
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleChange('dateFrom', e.target.value)}
              aria-label="Fecha desde"
            />
            <TextInput
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleChange('dateTo', e.target.value)}
              aria-label="Fecha hasta"
            />
          </div>
        </FormField>
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
        <ActionButton
          type="button"
          onClick={handleReset}
          variant="ghost"
          icon={<RotateCcw size={16} />}
        >
          Limpiar
        </ActionButton>
        <ActionButton
          type="submit"
          variant="primary"
          icon={<Filter size={16} />}
        >
          Aplicar filtros
        </ActionButton>
      </div>
    </ToolbarSurface>
  );
}
