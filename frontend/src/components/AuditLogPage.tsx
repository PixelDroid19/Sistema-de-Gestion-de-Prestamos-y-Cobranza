import React, { useState } from 'react';
import { useAuditLogs, useAuditStats, AuditLog } from '../services/auditService';
import AuditFilters from './AuditFilters';
import AuditTable from './AuditTable';
import AuditDetailModal from './AuditDetailModal';

interface FilterValues {
  userId?: string;
  action?: string;
  module?: string;
  entityId?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState<FilterValues>({});
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { logs, pagination, isLoading } = useAuditLogs({ ...filters, page, pageSize: 25 });
  const { stats: auditStats, isLoading: statsLoading } = useAuditStats();

  const handleFilter = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  const handleReset = () => {
    setFilters({});
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track all significant business actions in the system
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      {!statsLoading && auditStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {auditStats.slice(0, 4).map((stat) => (
            <div key={stat.module} className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-medium text-gray-500 uppercase">
                {stat.module}
              </div>
              <div className="mt-2 flex items-baseline">
                <span className="text-2xl font-semibold text-gray-900">
                  {stat.totalCount}
                </span>
                <span className="ml-2 text-sm text-gray-500">events</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(stat.actions).slice(0, 3).map(([action, count]) => (
                  <span
                    key={action}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                  >
                    {action}: {count}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <AuditFilters onFilter={handleFilter} onReset={handleReset} />

      {/* Table */}
      <AuditTable
        logs={logs}
        pagination={pagination}
        isLoading={isLoading}
        onViewDetails={setSelectedLog}
        onPageChange={handlePageChange}
      />

      {/* Detail Modal */}
      <AuditDetailModal
        auditLog={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}
