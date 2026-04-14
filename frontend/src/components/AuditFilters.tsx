import React, { useState } from 'react';

export interface FilterValues {
  userId?: string;
  action?: string;
  module?: string;
  entityId?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface AuditFiltersProps {
  onFilter: (filters: FilterValues) => void;
  onReset: () => void;
}

const AUDIT_MODULES_LIST = ['CREDITOS', 'CLIENTES', 'PAGOS', 'SOCIOS', 'REPORTES', 'USUARIOS', 'PERMISOS', 'AUDITORIA', 'AUTH'];
const AUDIT_ACTIONS_LIST = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'EXPORT', 'IMPORT'];

export default function AuditFilters({ onFilter, onReset }: AuditFiltersProps) {
  const [filters, setFilters] = useState<FilterValues>({
    userId: '',
    action: '',
    module: '',
    entityId: '',
    entityType: '',
    dateFrom: '',
    dateTo: '',
  });

  const handleChange = (field: keyof FilterValues, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedFilters: FilterValues = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim() !== '') {
        cleanedFilters[key as keyof FilterValues] = value;
      }
    });
    onFilter(cleanedFilters);
  };

  const handleReset = () => {
    setFilters({
      userId: '',
      action: '',
      module: '',
      entityId: '',
      entityType: '',
      dateFrom: '',
      dateTo: '',
    });
    onReset();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-bg-surface border border-border-subtle rounded-2xl p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            ID de usuario
          </label>
          <input
            type="text"
            value={filters.userId}
            onChange={(e) => handleChange('userId', e.target.value)}
            placeholder="Filtrar por usuario"
            className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Módulo
          </label>
          <select
            value={filters.module}
            onChange={(e) => handleChange('module', e.target.value)}
            className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos los módulos</option>
            {AUDIT_MODULES_LIST.map((mod) => (
              <option key={mod} value={mod}>
                {mod}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Acción
          </label>
          <select
            value={filters.action}
            onChange={(e) => handleChange('action', e.target.value)}
            className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todas las acciones</option>
            {AUDIT_ACTIONS_LIST.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            ID de entidad
          </label>
          <input
            type="text"
            value={filters.entityId}
            onChange={(e) => handleChange('entityId', e.target.value)}
            placeholder="Filtrar por entidad"
            className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Tipo de entidad
          </label>
          <input
            type="text"
            value={filters.entityType}
            onChange={(e) => handleChange('entityType', e.target.value)}
            placeholder="Ej: Loan, User, Customer"
            className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Fecha desde
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleChange('dateFrom', e.target.value)}
            className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Fecha hasta
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleChange('dateTo', e.target.value)}
            className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-base border border-border-subtle rounded-lg hover:bg-hover-bg"
        >
          Limpiar
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90"
        >
          Aplicar filtros
        </button>
      </div>
    </form>
  );
}
