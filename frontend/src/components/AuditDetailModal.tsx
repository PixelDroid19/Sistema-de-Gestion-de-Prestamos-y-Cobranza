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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Audit Log Details</h2>
            <p className="text-sm text-gray-500 mt-1">
              {auditLog.module} - {auditLog.action}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Log ID</p>
              <p className="text-sm text-gray-900 font-mono">{auditLog.id}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">User</p>
              <p className="text-sm text-gray-900">{auditLog.userName || 'System'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">User ID</p>
              <p className="text-sm text-gray-900">{auditLog.userId || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Action</p>
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
              <p className="text-xs font-medium text-gray-500 uppercase">Module</p>
              <p className="text-sm text-gray-900">{auditLog.module}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Timestamp</p>
              <p className="text-sm text-gray-900">{formatDate(auditLog.timestamp)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Entity ID</p>
              <p className="text-sm text-gray-900 font-mono">{auditLog.entityId || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Entity Type</p>
              <p className="text-sm text-gray-900">{auditLog.entityType || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">IP Address</p>
              <p className="text-sm text-gray-900 font-mono">{auditLog.ip || 'N/A'}</p>
            </div>
          </div>

          {/* User Agent */}
          <div className="mb-6">
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">User Agent</p>
            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded font-mono text-xs break-all">
              {auditLog.userAgent || 'N/A'}
            </p>
          </div>

          {/* Data Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Previous Data */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Previous Data</p>
              <pre className="bg-red-50 text-red-800 p-3 rounded text-xs overflow-x-auto">
                {formatJson(auditLog.previousData)}
              </pre>
            </div>

            {/* New Data */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">New Data</p>
              <pre className="bg-green-50 text-green-800 p-3 rounded text-xs overflow-x-auto">
                {formatJson(auditLog.newData)}
              </pre>
            </div>
          </div>

          {/* Metadata */}
          {auditLog.metadata && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Metadata</p>
              <pre className="bg-gray-50 text-gray-800 p-3 rounded text-xs overflow-x-auto">
                {formatJson(auditLog.metadata)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
