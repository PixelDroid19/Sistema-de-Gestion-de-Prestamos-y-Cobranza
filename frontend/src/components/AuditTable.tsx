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

const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    CREATE: 'Creación',
    UPDATE: 'Actualización',
    DELETE: 'Eliminación',
    LOGIN: 'Inicio de sesión',
    LOGOUT: 'Cierre de sesión',
    APPROVE: 'Aprobación',
    REJECT: 'Rechazo',
    EXPORT: 'Exportación',
    IMPORT: 'Importación',
  };

  return labels[action] || action;
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
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
        <p className="mt-2 text-text-secondary">Cargando auditoría...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 text-center">
        <p className="text-text-secondary">No se encontraron eventos con los filtros aplicados.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-bg-base border-b border-border-subtle">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Acción
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Módulo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Entidad
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                IP
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-hover-bg transition-colors">
                <td className="px-4 py-3 text-sm text-text-primary whitespace-nowrap">
                  {formatDate(log.timestamp)}
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">
                  {log.userName || (
                    <span className="text-text-secondary italic">Sistema</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                    {getActionLabel(log.action)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">
                  {log.module}
                </td>
                <td className="px-4 py-3 text-sm text-text-primary">
                  <div>
                    {log.entityType && <span className="font-medium">{log.entityType}</span>}
                    {log.entityId && (
                      <span className="text-text-secondary ml-1 font-mono text-xs">
                        #{log.entityId}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary font-mono">
                  {log.ip || 'N/A'}
                </td>
                <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                  <button
                    onClick={() => onViewDetails(log)}
                    className="text-brand-primary hover:text-brand-primary/80 font-medium text-xs"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="px-4 py-3 bg-bg-base border-t border-border-subtle flex items-center justify-between">
          <div className="text-sm text-text-secondary">
            Mostrando {((pagination.page - 1) * pagination.pageSize) + 1} a{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} de{' '}
            {pagination.totalItems} eventos
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm font-medium text-text-secondary bg-bg-surface border border-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-hover-bg"
            >
              Anterior
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 text-sm font-medium text-text-secondary bg-bg-surface border border-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-hover-bg"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
