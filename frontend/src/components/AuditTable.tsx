import React from 'react';
import { Eye, Network, Server } from 'lucide-react';
import { AuditLog, PaginationMeta } from '../services/auditService';
import {
  formatAuditDate,
  formatAuditEntity,
  getAuditActionLabel,
  getAuditActionTone,
  getAuditModuleLabel,
  getAuditServiceLabel,
} from '../lib/auditPresentation';
import { ActionButton, DataTableSurface } from './shared/Surfaces';

interface AuditTableProps {
  logs: AuditLog[];
  pagination?: PaginationMeta;
  isLoading: boolean;
  onViewDetails: (log: AuditLog) => void;
  onPageChange: (page: number) => void;
  onFilterIp: (ip: string) => void;
}

export default function AuditTable({
  logs,
  pagination,
  isLoading,
  onViewDetails,
  onPageChange,
  onFilterIp,
}: AuditTableProps) {
  if (isLoading) {
    return (
      <DataTableSurface>
        <div className="space-y-3 p-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-14 animate-pulse rounded-xl bg-bg-base" />
          ))}
        </div>
      </DataTableSurface>
    );
  }

  if (logs.length === 0) {
    return (
      <DataTableSurface>
        <div className="table-empty-state">
          <div>
            <Server className="mx-auto mb-3 size-8 text-text-secondary" />
            <p className="font-semibold text-text-primary">Sin eventos para revisar</p>
            <p className="mt-1 text-sm text-text-secondary">Ajusta filtros por IP, servicio o fecha para ampliar la búsqueda.</p>
          </div>
        </div>
      </DataTableSurface>
    );
  }

  return (
    <DataTableSurface>
      <div className="overflow-x-auto">
        <table className="min-w-[1120px]">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Servicio consumido</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Área</th>
              <th>Entidad</th>
              <th>IP origen</th>
              <th className="text-right">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const serviceLabel = getAuditServiceLabel(log);
              return (
                <tr key={log.id}>
                  <td className="whitespace-nowrap font-mono text-xs text-text-secondary">
                    {formatAuditDate(log.timestamp)}
                  </td>
                  <td>
                    <div className="flex min-w-0 items-start gap-2">
                      <Network className="mt-0.5 size-4 shrink-0 text-brand-primary" />
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold text-text-primary" title={serviceLabel}>
                          {serviceLabel}
                        </p>
                        <p className="text-xs text-text-secondary">Endpoint o módulo que recibió la acción</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="font-medium text-text-primary">{log.userName || 'Sistema'}</p>
                    <p className="text-xs text-text-secondary">{log.userId ? `Usuario #${log.userId}` : 'Sin usuario autenticado'}</p>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getAuditActionTone(log.action)}`}>
                      {getAuditActionLabel(log.action)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-sm text-text-primary">
                    {getAuditModuleLabel(log.module)}
                  </td>
                  <td className="max-w-[12rem] truncate text-sm text-text-primary" title={formatAuditEntity(log)}>
                    {formatAuditEntity(log)}
                  </td>
                  <td className="whitespace-nowrap">
                    {log.ip ? (
                      <ActionButton
                        type="button"
                        onClick={() => onFilterIp(log.ip || '')}
                        variant="ghost"
                        className="min-h-7 px-2 py-1 font-mono text-xs"
                        title="Filtrar todo lo registrado por esta IP"
                      >
                        {log.ip}
                      </ActionButton>
                    ) : (
                      <span className="text-xs text-text-secondary">Sin IP</span>
                    )}
                  </td>
                  <td className="text-right">
                    <ActionButton
                      onClick={() => onViewDetails(log)}
                      variant="ghost"
                      className="min-h-8 px-3 py-1.5 text-xs"
                      icon={<Eye size={14} />}
                    >
                      Ver
                    </ActionButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-border-subtle bg-bg-surface px-4 py-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <span>
            Mostrando {((pagination.page - 1) * pagination.pageSize) + 1} a {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} de {pagination.totalItems} eventos
          </span>
          <div className="flex gap-2">
            <ActionButton
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              variant="ghost"
              className="min-h-8 px-3 py-1.5 text-xs"
            >
              Anterior
            </ActionButton>
            <ActionButton
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              variant="ghost"
              className="min-h-8 px-3 py-1.5 text-xs"
            >
              Siguiente
            </ActionButton>
          </div>
        </div>
      )}
    </DataTableSurface>
  );
}
