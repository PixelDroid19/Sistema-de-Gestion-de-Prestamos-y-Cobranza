import React, { useState } from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../types/audit';
import { getAuditActionLabel, getAuditModuleLabel, normalizeAuditEntityTypeInput } from '../lib/auditPresentation';
import { tTerm } from '../i18n/terminology';
import { ActionButton, AppInput, FormField, OperationalSelect, ToolbarSurface } from './shared/Surfaces';

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
        <FormField label={tTerm('audit.filters.search.label')} helper={tTerm('audit.filters.search.helper')}>
          <AppInput
            id="audit-filter-entity-id"
            aria-label={tTerm('audit.filters.search.label')}
            variant="text"
            value={filters.entityId ?? ''}
            onValueChange={(v, _detail, e) => handleChange('entityId', v)}
            placeholder={tTerm('audit.filters.search.placeholder')}
            icon={<Search className="size-4" />}
          />
        </FormField>

        <FormField label={tTerm('audit.filters.ip.label')} helper={tTerm('audit.filters.ip.helper')}>
          <AppInput
            id="audit-filter-ip"
            variant="text"
            value={filters.ip ?? ''}
            onValueChange={(v, _detail, e) => handleChange('ip', v)}
            placeholder={tTerm('audit.filters.ip.placeholder')}
            className="font-mono"
          />
        </FormField>

        <FormField label={tTerm('audit.filters.service.label')}>
          <OperationalSelect
            id="audit-filter-module"
            value={filters.module}
            onChange={(e) => handleChange('module', e.target.value)}
          >
            <option value="">{tTerm('audit.filters.service.all')}</option>
            {AUDIT_MODULES.map((mod) => (
              <option key={mod} value={mod}>
                {getAuditModuleLabel(mod)}
              </option>
            ))}
          </OperationalSelect>
        </FormField>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(160px,0.7fr)_minmax(140px,0.6fr)_minmax(180px,0.75fr)_minmax(300px,1.25fr)]">
        <FormField label={tTerm('audit.filters.action.label')}>
          <OperationalSelect
            id="audit-filter-action"
            value={filters.action}
            onChange={(e) => handleChange('action', e.target.value)}
          >
            <option value="">{tTerm('audit.filters.action.all')}</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {getAuditActionLabel(action)}
              </option>
            ))}
          </OperationalSelect>
        </FormField>

        <FormField label={tTerm('audit.filters.user.label')}>
          <AppInput
            id="audit-filter-user-id"
            variant="text"
            value={filters.userId ?? ''}
            onValueChange={(v, _detail, e) => handleChange('userId', v)}
            placeholder={tTerm('audit.filters.user.placeholder')}
          />
        </FormField>

        <FormField label={tTerm('audit.filters.entityType.label')}>
          <AppInput
            id="audit-filter-entity-type"
            variant="text"
            value={filters.entityType ?? ''}
            onValueChange={(v, _detail, e) => handleChange('entityType', v)}
            placeholder={tTerm('audit.filters.entityType.placeholder')}
          />
        </FormField>

        <FormField label={tTerm('audit.filters.dateRange.label')}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <AppInput
              variant="date"
              value={filters.dateFrom ?? ''}
              onValueChange={(v, _detail, e) => handleChange('dateFrom', v)}
              aria-label={tTerm('audit.filters.dateRange.from')}
            />
            <AppInput
              variant="date"
              value={filters.dateTo ?? ''}
              onValueChange={(v, _detail, e) => handleChange('dateTo', v)}
              aria-label={tTerm('audit.filters.dateRange.to')}
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
          {tTerm('audit.filters.action.reset')}
        </ActionButton>
        <ActionButton
          type="submit"
          variant="primary"
          icon={<Filter size={16} />}
        >
          {tTerm('audit.filters.action.apply')}
        </ActionButton>
      </div>
    </ToolbarSurface>
  );
}
