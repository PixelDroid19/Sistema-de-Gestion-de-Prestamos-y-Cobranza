import React from 'react';
import { AuditLog } from '../services/auditService';

interface AuditDetailModalProps {
  auditLog: AuditLog | null;
  onClose: () => void;
}

export default function AuditDetailModal({ auditLog, onClose }: AuditDetailModalProps) {
  if (!auditLog) return null;

  const formatJson = (data: object | null) => {
    if (!data) return 'N/A';
    return JSON.stringify(data, null, 2);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Detalle de auditoría</h2>
            <p className="text-sm text-text-secondary mt-1">
              {auditLog.module} - {auditLog.action}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase">ID de evento</p>
              <p className="text-sm text-text-primary font-mono">{auditLog.id}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase">Usuario</p>
              <p className="text-sm text-text-primary">{auditLog.userName || 'Sistema'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase">ID de usuario</p>
              <p className="text-sm text-text-primary">{auditLog.userId || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase">Acción</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                auditLog.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                auditLog.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                auditLog.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                auditLog.action === 'LOGIN' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {auditLog.action}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase">Módulo</p>
              <p className="text-sm text-text-primary">{auditLog.module}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase">Fecha</p>
              <p className="text-sm text-text-primary">{formatDate(auditLog.timestamp)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase">ID de entidad</p>
              <p className="text-sm text-text-primary font-mono">{auditLog.entityId || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase">Tipo de entidad</p>
              <p className="text-sm text-text-primary">{auditLog.entityType || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase">Dirección IP</p>
              <p className="text-sm text-text-primary font-mono">{auditLog.ip || 'N/A'}</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs font-medium text-text-secondary uppercase mb-1">User agent</p>
            <p className="text-sm text-text-primary bg-bg-base p-2 rounded font-mono text-xs break-all">
              {auditLog.userAgent || 'N/A'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-text-secondary uppercase mb-2">Datos previos</p>
              <pre className="bg-red-50 text-red-800 p-3 rounded text-xs overflow-x-auto">
                {formatJson(auditLog.previousData)}
              </pre>
            </div>

            <div>
              <p className="text-xs font-medium text-text-secondary uppercase mb-2">Datos nuevos</p>
              <pre className="bg-green-50 text-green-800 p-3 rounded text-xs overflow-x-auto">
                {formatJson(auditLog.newData)}
              </pre>
            </div>
          </div>

          {auditLog.metadata && (
            <div className="mt-4">
              <p className="text-xs font-medium text-text-secondary uppercase mb-2">Metadatos</p>
              <pre className="bg-bg-base text-text-primary p-3 rounded text-xs overflow-x-auto">
                {formatJson(auditLog.metadata)}
              </pre>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-border-subtle bg-bg-base flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-surface border border-border-subtle rounded-lg hover:bg-hover-bg"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
