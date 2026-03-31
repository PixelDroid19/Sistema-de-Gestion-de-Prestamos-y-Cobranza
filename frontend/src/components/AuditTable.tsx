import React from 'react';
import { AuditLog, PaginationMeta } from '../services/auditService';

interface AuditTableProps {
  logs: AuditLog[];
  pagination?: PaginationMeta;
  isLoading: boolean;
  onViewDetails: (log: AuditLog) => void;
  onPageChange: (page: number) => void;
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};

const getActionColor = (action: string) => {
  switch (action) {
    case 'DELETE':
      return 'bg-red-100 text-red-800';
    case 'CREATE':
      return 'bg-green-100 text-green-800';
    case 'UPDATE':
      return 'bg-blue-100 text-blue-800';
    case 'LOGIN':
      return 'bg-purple-100 text-purple-800';
    case 'LOGOUT':
      return 'bg-gray-100 text-gray-800';
    case 'APPROVE':
      return 'bg-emerald-100 text-emerald-800';
    case 'REJECT':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function AuditTable({
  logs,
  pagination,
  isLoading,
  onViewDetails,
  onPageChange,
}: AuditTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
        <p className="mt-2 text-gray-500">Loading audit logs...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No audit logs found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Module
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IP Address
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                  {formatDate(log.timestamp)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {log.userName || (
                    <span className="text-gray-400 italic">System</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {log.module}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  <div>
                    {log.entityType && <span className="font-medium">{log.entityType}</span>}
                    {log.entityId && (
                      <span className="text-gray-500 ml-1 font-mono text-xs">
                        #{log.entityId}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                  {log.ip || 'N/A'}
                </td>
                <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                  <button
                    onClick={() => onViewDetails(log)}
                    className="text-blue-600 hover:text-blue-900 font-medium text-xs"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-5 00">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of{' '}
            {pagination.totalItems} entries
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
