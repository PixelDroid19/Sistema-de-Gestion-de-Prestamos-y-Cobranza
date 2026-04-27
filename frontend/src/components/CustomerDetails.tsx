import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Upload, Download, Trash2, CheckCircle, Clock, DollarSign, TrendingUp, Calendar, AlertTriangle, CreditCard } from 'lucide-react';
import { useCustomerById, useCustomerDocuments } from '../services/customerService';
import { useCustomerReports } from '../services/reportService';
import { useLoans } from '../services/loanService';
import { toast } from '../lib/toast';
import { tTerm } from '../i18n/terminology';
import { confirmDanger } from '../lib/confirmModal';
import { extractRawErrorMessage } from '../services/safeErrorMessages';

const CUSTOMER_DOCUMENT_OPTIONS = [
  { value: 'identification', label: 'Identificación (INE/Pasaporte)' },
  { value: 'proof_of_address', label: 'Comprobante de Domicilio' },
  { value: 'income_proof', label: 'Comprobante de Ingresos' },
  { value: 'other', label: 'Otro' },
];

const CUSTOMER_DOCUMENT_ACCEPT = '.pdf,image/jpeg,image/png,image/webp';

/**
 * CustomerDetails displays a customer's profile, documents, loan history,
 * and credit history timeline. Provides document management and navigation
 * to individual loan details.
 */
export default function CustomerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = Number(id);

  const {
    data: customerResponse,
    isLoading: isCustomerLoading,
    isError: isCustomerError,
  } = useCustomerById(customerId);
  const customer = customerResponse?.data?.customer || customerResponse?.data || null;

  const { documents, uploadDocument, deleteDocument, downloadDocumentUrl } = useCustomerDocuments(customerId);
  const { history, creditProfile } = useCustomerReports(customerId);
  const { data: loansData } = useLoans({ pageSize: 100 });

  const loans = Array.isArray(loansData?.data?.loans)
    ? loansData.data.loans
    : Array.isArray(loansData?.data)
      ? loansData.data
      : [];
  const customerLoans = loans.filter((l: any) => l.customerId === customerId);

  const customerName = customer?.name || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim() || customer?.email || 'Cliente';
  const customerPhone = customer?.phoneNumber || customer?.phone || 'N/A';
  const customerCreditProfile = creditProfile?.data?.profile || creditProfile?.profile || null;
  const customerCreditSummary = customerCreditProfile?.summary || {};
  const historyEntries = Array.isArray(history?.data?.timeline)
    ? history.data.timeline
    : Array.isArray(history?.timeline)
      ? history.timeline
      : [];
  const normalizedCustomerStatus = String(customer?.status || '').toLowerCase();

  // Calculate loan statistics
  const activeLoans = customerLoans.filter((l: any) => l.status === 'active' || l.status === 'ACTIVE');
  const completedLoans = customerLoans.filter((l: any) => l.status === 'closed' || l.status === 'CLOSED' || l.status === 'completed');
  const overdueLoans = customerLoans.filter((l: any) => l.status === 'overdue' || l.status === 'OVERDUE' || l.daysLate > 0);
  const totalDisbursed = customerLoans.reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0);
  const totalPaid = customerLoans.reduce((sum: number, l: any) => sum + (Number(l.totalPaid) || 0), 0);
  const totalOutstanding = customerLoans.reduce((sum: number, l: any) => sum + (Number(l.principalOutstanding) || Number(l.amount) - Number(l.totalPaid) || 0), 0);

  const [activeTab, setActiveTab] = useState<'profile' | 'documents' | 'loans' | 'history'>('profile');
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('identification');
  const [customerVisible, setCustomerVisible] = useState(true);
  const [fileInputKey, setFileInputKey] = useState(0);

  const formatDisplayDate = (value: unknown, includeTime = false) => {
    if (!value) return 'Fecha no disponible';

    const parsedDate = new Date(value as string | number | Date);
    if (Number.isNaN(parsedDate.getTime())) {
      return 'Fecha no disponible';
    }

    return includeTime ? parsedDate.toLocaleString() : parsedDate.toLocaleDateString();
  };

  const formatLoanId = (value: unknown) => {
    const rawId = value == null ? '' : String(value);
    return rawId ? rawId.slice(0, 8) : 'N/A';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDocumentTypeLabel = (value: unknown) => {
    const normalizedValue = String(value || '').trim().toLowerCase();
    return CUSTOMER_DOCUMENT_OPTIONS.find((option) => option.value === normalizedValue)?.label || 'Documento';
  };

  const getLoanStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'active': { label: 'Activo', className: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
      'ACTIVE': { label: 'Activo', className: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
      'closed': { label: 'Cerrado', className: 'bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400' },
      'CLOSED': { label: 'Cerrado', className: 'bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400' },
      'overdue': { label: 'Vencido', className: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' },
      'OVERDUE': { label: 'Vencido', className: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' },
      'pending': { label: 'Pendiente', className: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' },
      'PENDING': { label: 'Pendiente', className: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' },
    };

    const config = statusMap[status] || {
      label: status,
      className: 'bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400',
    };

    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  if (isCustomerLoading) {
    return (
      <div className="p-8 text-center text-text-secondary">
        <p>Cargando cliente...</p>
      </div>
    );
  }

  if (isCustomerError || !customer) {
    return (
      <div className="p-8 text-center text-text-secondary">
        <p>Cliente no encontrado.</p>
        <button onClick={() => navigate('/customers')} className="mt-4 text-brand-primary">Volver a clientes</button>
      </div>
    );
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try {
      await uploadDocument.mutateAsync({
        file,
        metadata: {
          category: docType,
          customerVisible,
        },
      });
      setFile(null);
      setFileInputKey((current) => current + 1);
      toast.success({ title: tTerm('customerDetails.toast.document.upload.success') });
    } catch (error) {
      const rawMessage = extractRawErrorMessage(error);
      if (/unsupported attachment file type/i.test(rawMessage)) {
        toast.error({
          title: 'Formato de archivo no permitido',
          description: 'Solo se permiten PDF o imágenes JPG, PNG y WEBP.',
        });
        return;
      }

      toast.apiErrorSafe(error, {
        domain: 'customers',
        action: 'customer.update',
        fallbackMessage: tTerm('customerDetails.toast.document.upload.error'),
      });
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    const confirmed = await confirmDanger({
      title: tTerm('confirm.document.delete.title'),
      message: tTerm('confirm.document.delete.message'),
      confirmLabel: tTerm('confirm.document.delete.confirm'),
    });
    if (!confirmed) return;
    try {
      await deleteDocument.mutateAsync(docId);
    } catch (error) {
      toast.apiErrorSafe(error, {
        domain: 'customers',
        action: 'customer.update',
        fallbackMessage: tTerm('customerDetails.toast.document.delete.error'),
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate('/customers')}
          className="p-2 hover:bg-hover-bg rounded-xl text-text-secondary transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{customerName}</h1>
          <p className="text-sm text-text-secondary">ID: {customer.id} | Documento: {customer.documentNumber || 'N/A'}</p>
        </div>
        <div className="ml-auto">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            normalizedCustomerStatus === 'active'
              ? 'bg-status-success-bg text-status-success'
              : normalizedCustomerStatus === 'blacklisted'
                ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                : 'bg-status-warning-bg text-status-warning'
          }`}>
            {normalizedCustomerStatus === 'active' ? 'Activo' : normalizedCustomerStatus === 'blacklisted' ? 'Bloqueado' : 'Inactivo'}
          </span>
        </div>
      </div>

      <div className="flex border-b border-border-subtle overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'profile' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'}`}
        >
          Perfil y Score
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'documents' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'}`}
        >
          Documentos
        </button>
        <button
          onClick={() => setActiveTab('loans')}
          className={`px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'loans' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'}`}
        >
          Préstamos
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'history' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'}`}
        >
          Historial
        </button>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold mb-4">Información Personal</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border-subtle pb-2">
                  <span className="text-text-secondary">Email</span>
                  <span className="font-medium">{customer.email}</span>
                </div>
                <div className="flex justify-between border-b border-border-subtle pb-2">
                  <span className="text-text-secondary">Teléfono</span>
                   <span className="font-medium">{customerPhone}</span>
                </div>
                <div className="flex justify-between border-b border-border-subtle pb-2">
                  <span className="text-text-secondary">Dirección</span>
                  <span className="font-medium">{customer.address || 'N/A'}</span>
                </div>
              </div>
            </div>
            {customerCreditProfile && (
              <div>
                <h3 className="font-bold mb-4">Perfil Crediticio</h3>
                <div className="p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-xl space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Score Interno</span>
                    <span className="font-bold text-brand-primary">{customerCreditSummary?.score ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Créditos Totales</span>
                    <span className="font-medium">{customerCreditSummary?.totalLoans ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Comportamiento de Pago</span>
                    <span className="font-medium">{customerCreditSummary?.paymentBehavior || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold">Gestión Documental</h3>
            </div>
            
            <form onSubmit={handleUpload} className="mb-8 flex flex-col gap-4 rounded-xl border border-dashed border-border-strong bg-bg-base p-4 lg:flex-row lg:items-end">
              <div className="w-full lg:flex-1">
                <label className="block text-xs text-text-secondary mb-1">Tipo de Documento</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm">
                  {CUSTOMER_DOCUMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-full lg:flex-1">
                <label className="block text-xs text-text-secondary mb-1">Archivo</label>
                <input
                  key={fileInputKey}
                  type="file"
                  accept={CUSTOMER_DOCUMENT_ACCEPT}
                  required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
                <p className="mt-1 text-xs text-text-secondary">Formato permitido: PDF, JPG, PNG o WEBP.</p>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={customerVisible}
                  onChange={(e) => setCustomerVisible(e.target.checked)}
                  className="rounded border-border-subtle"
                />
                Visible para el cliente
              </label>
              <button type="submit" disabled={!file || uploadDocument.isPending} className="flex items-center justify-center gap-2 rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-bg-base">
                <Upload size={16} /> Subir
              </button>
            </form>

            <div className="space-y-3">
              {documents?.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border border-border-subtle rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText className="text-text-secondary" size={20} />
                    <div>
                      <p className="font-medium text-sm">{doc.originalName}</p>
                      <p className="text-xs text-text-secondary">
                        {getDocumentTypeLabel(doc.category)}
                        {doc.customerVisible === false ? ' • Uso interno' : ' • Visible para cliente'}
                        {' • '}
                        {formatDisplayDate(doc.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={downloadDocumentUrl(doc.id)} target="_blank" rel="noreferrer" title="Descargar documento" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Download size={16} />
                    </a>
                    <button onClick={() => handleDeleteDoc(doc.id)} title="Eliminar documento" className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {(!documents || documents.length === 0) && (
                <p className="text-center text-text-secondary py-4">No hay documentos subidos.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'loans' && (
          <div>
            {/* Loan Statistics */}
            <div className="mb-6 p-4 bg-bg-base border border-border-subtle rounded-xl">
              <h4 className="text-sm font-medium text-text-secondary mb-4">Resumen de Cartera</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Total Préstamos</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{customerLoans.length}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-3">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Activos</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{activeLoans.length}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-500/10 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Completados</p>
                  <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{completedLoans.length}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-3">
                  <p className="text-xs text-red-600 dark:text-red-400 mb-1">Vencidos</p>
                  <p className="text-lg font-bold text-red-700 dark:text-red-300">{overdueLoans.length}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-500/10 rounded-lg p-3">
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Total Desembolsado</p>
                  <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{formatCurrency(totalDisbursed)}</p>
                </div>
              </div>
            </div>

            <h3 className="font-bold mb-4">Detalle de Préstamos</h3>
            <div className="space-y-3">
              {customerLoans.map((loan: any) => (
                <div
                  key={loan.id}
                  className="p-4 border border-border-subtle rounded-xl hover:bg-hover-bg cursor-pointer transition-colors"
                  onClick={() => navigate(`/credits/${loan.id}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCard size={16} className="text-text-secondary" />
                        <p className="font-medium">Crédito #{formatLoanId(loan.id)}</p>
                        {getLoanStatusBadge(loan.status)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-text-secondary mt-3">
                        <div>
                          <p className="text-text-secondary">Monto</p>
                          <p className="font-medium text-text-primary">{formatCurrency(loan.amount)}</p>
                        </div>
                        <div>
                          <p className="text-text-secondary">Tasa</p>
                          <p className="font-medium text-text-primary">{loan.interestRate}%</p>
                        </div>
                        <div>
                          <p className="text-text-secondary">Plazo</p>
                          <p className="font-medium text-text-primary">{loan.termMonths} meses</p>
                        </div>
                        <div>
                          <p className="text-text-secondary">Fecha Inicio</p>
                          <p className="font-medium text-text-primary">{formatDate(loan.startDate)}</p>
                        </div>
                      </div>
                      {loan.daysLate > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-red-600 dark:text-red-400">
                          <AlertTriangle size={12} />
                          <span>{loan.daysLate} días vencido</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-secondary mb-1">Saldo Pendiente</p>
                      <p className="text-lg font-bold text-text-primary">{formatCurrency(loan.principalOutstanding || loan.amount - loan.totalPaid || 0)}</p>
                      <p className="text-xs text-text-secondary mt-2">Pagado: {formatCurrency(loan.totalPaid || 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {customerLoans.length === 0 && (
                <div className="text-center py-12 text-text-secondary">
                  <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
                  <p>No tiene préstamos registrados.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h3 className="font-bold mb-4">Historial de Actividad</h3>
            <div className="space-y-4">
              {historyEntries.map((event: any, i: number) => (
                <div key={i} className="flex gap-4">
                  <div className="mt-1"><Clock size={16} className="text-text-secondary" /></div>
                  <div>
                    <p className="text-sm font-medium">{event.action || event.eventType || 'Evento registrado'}</p>
                    <p className="text-sm text-text-secondary">{event.description || event.entityType || 'Actividad del cliente'}</p>
                    <p className="text-xs text-text-secondary mt-1">{formatDisplayDate(event.date || event.occurredAt, true)}</p>
                  </div>
                </div>
              ))}
              {historyEntries.length === 0 && (
                <p className="text-center text-text-secondary py-4">No hay historial disponible.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
