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
import { tTerm } from '../i18n/terminology';
import { ActionButton, DataTableSurface } from './shared/Surfaces';
import {
  AppTable,
  RowActionsWithOverflow,
  TableActionsCell,
  TableActionsHeader,
  TABLE_EMBEDDED_SHELL_CLASS,
} from './shared/tables';

interface AuditTableProps {
  logs: AuditLog[];
  pagination?: PaginationMeta;
  isLoading: boolean;
  isError?: boolean;
  onViewDetails: (log: AuditLog) => void;
  onPageChange: (page: number) => void;
  onFilterIp: (ip: string) => void;
}

export default function AuditTable({
  logs,
  pagination,
  isLoading,
  isError = false,
  onViewDetails,
  onPageChange,
  onFilterIp,
}: AuditTableProps) {
  return (
    <DataTableSurface>
      <AppTable
        variant="operational"
        className={TABLE_EMBEDDED_SHELL_CLASS}
        surfaceClassName={TABLE_EMBEDDED_SHELL_CLASS}
        minWidthClassName="min-w-[1120px]"
        statePresentation="shell"
        isLoading={isLoading}
        isError={isError}
        hasData={logs.length > 0}
        loadingContent={(
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-xl bg-bg-base" />
            ))}
          </div>
        )}
        emptyContent={(
          <div className="table-empty-state">
            <div>
              <Server className="mx-auto mb-3 size-8 text-text-secondary" />
              <p className="font-semibold text-text-primary">{tTerm('audit.table.empty.title')}</p>
              <p className="mt-1 text-sm text-text-secondary">{tTerm('audit.table.empty.description')}</p>
            </div>
          </div>
        )}
        errorContent={(
          <div className="py-4 text-center text-red-500">{tTerm('audit.table.error')}</div>
        )}
        recordsLabel={tTerm('audit.table.recordsLabel')}
        pagination={
          pagination && pagination.totalPages > 1
            ? {
              page: pagination.page,
              pageSize: pagination.pageSize,
              totalItems: pagination.totalItems,
              totalPages: pagination.totalPages,
              onPrev: () => onPageChange(pagination.page - 1),
              onNext: () => onPageChange(pagination.page + 1),
            }
            : undefined
        }
      >
        <thead>
          <tr>
            <th>{tTerm('audit.table.header.date')}</th>
            <th>{tTerm('audit.table.header.service')}</th>
            <th>{tTerm('audit.table.header.user')}</th>
            <th>{tTerm('audit.table.header.action')}</th>
            <th>{tTerm('audit.table.header.module')}</th>
            <th>{tTerm('audit.table.header.entity')}</th>
            <th>{tTerm('audit.table.header.ip')}</th>
            <TableActionsHeader>{tTerm('audit.table.header.detail')}</TableActionsHeader>
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
                      <p className="text-xs text-text-secondary">{tTerm('audit.table.service.helper')}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <p className="font-medium text-text-primary">{log.userName || tTerm('audit.table.user.system')}</p>
                  <p className="text-xs text-text-secondary">
                    {log.userId ? tTerm('audit.table.user.authenticated') : tTerm('audit.table.user.noAuthenticated')}
                  </p>
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
                      title={tTerm('audit.table.ip.filterTitle')}
                    >
                      {log.ip}
                    </ActionButton>
                  ) : (
                    <span className="text-xs text-text-secondary">{tTerm('audit.table.ip.empty')}</span>
                  )}
                </td>
                <TableActionsCell>
                  <RowActionsWithOverflow
                    variant="icon"
                    align="center"
                    ariaLabel={tTerm('audit.table.header.detail')}
                    items={[
                      {
                        id: 'view',
                        label: tTerm('audit.table.action.view'),
                        icon: <Eye size={16} />,
                        onClick: () => onViewDetails(log),
                      },
                    ]}
                  />
                </TableActionsCell>
              </tr>
            );
          })}
        </tbody>
      </AppTable>
    </DataTableSurface>
  );
}
