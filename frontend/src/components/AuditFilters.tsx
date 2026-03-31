import React, { useState } from 'react';
import { AUDIT_MODULES, AUDIT_ACTIONS } from '../types/audit';

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

const AUDIT_MODULES_LIST = ['CREDITOS', 'CLIENTES', 'PAGOS', 'SOCIOS', 'REPORTES', 'USUARIOS', 'PERMISOS', 'AUDITORÍA', 'AUTH'];
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
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* User ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            User ID
          </label>
          <input
            type="text"
            value={filters.userId}
            onChange={(e) => handleChange('userId', e.target.value)}
            placeholder="Filter by user ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Module */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Module
          </label>
          <select
            value={filters.module}
            onChange={(e) => handleChange('module', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Modules</option>
            {AUDIT_MODULES_LIST.map((mod) => (
              <option key={mod} value={mod}>
                {mod}
              </option>
            ))}
          </select>
        </div>

        {/* Action */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Action
          </label>
          <select
            value={filters.action}
            onChange={(e) => handleChange('action', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Actions</option>
            {AUDIT_ACTIONS_LIST.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>

        {/* Entity ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entity ID
          </label>
          <input
            type="text"
            value={filters.entityId}
            onChange={(e) => handleChange('entityId', e.target.value)}
            placeholder="Filter by entity ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Entity Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entity Type
          </label>
          <input
            type="text"
            value={filters.entityType}
            onChange={(e) => handleChange('entityType', e.target.value)}
            placeholder="e.g., Loan, User, Customer"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Date From */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date From
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleChange('dateFrom', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date To
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleChange('dateTo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Reset
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Apply Filters
        </button>
      </div>
    </form>
  );
}
