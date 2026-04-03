import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Upload, Download, Trash2, CheckCircle, Clock } from 'lucide-react';
import { useCustomers, useCustomerDocuments } from '../services/customerService';
import { useCustomerReports } from '../services/reportService';
import { useLoans } from '../services/loanService';
import { toast } from '../lib/toast';
import { tTerm } from '../i18n/terminology';
import { confirmDanger } from '../lib/confirmModal';

export default function CustomerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = Number(id);

  const { data: customersData } = useCustomers({ pageSize: 100 });
  const customers = Array.isArray(customersData?.data?.customers)
    ? customersData.data.customers
    : Array.isArray(customersData?.data)
      ? customersData.data
      : [];
  const customer = customers.find((c: any) => c.id === customerId);

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

  const [activeTab, setActiveTab] = useState<'profile' | 'documents' | 'loans' | 'history'>('profile');
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('identification');

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

  if (!customer) {
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
      await uploadDocument.mutateAsync({ file, metadata: { documentType: docType } });
      setFile(null);
      toast.success({ title: tTerm('customerDetails.toast.document.upload.success') });
    } catch (error) {
      toast.error({ title: tTerm('customerDetails.toast.document.upload.error') });
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
      toast.error({ title: tTerm('customerDetails.toast.document.delete.error') });
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
            customer.status === 'active' ? 'bg-status-success-bg text-status-success' : 'bg-status-warning-bg text-status-warning'
          }`}>
            {customer.status}
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
            
            <form onSubmit={handleUpload} className="mb-8 p-4 border border-dashed border-border-strong rounded-xl bg-bg-base flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-xs text-text-secondary mb-1">Tipo de Documento</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm">
                  <option value="identification">Identificación (INE/Pasaporte)</option>
                  <option value="proof_of_address">Comprobante de Domicilio</option>
                  <option value="income_proof">Comprobante de Ingresos</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-secondary mb-1">Archivo</label>
                <input type="file" required onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
              </div>
              <button type="submit" disabled={!file || uploadDocument.isPending} className="bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
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
                       <p className="text-xs text-text-secondary">{doc.documentType} • {formatDisplayDate(doc.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={downloadDocumentUrl(doc.id)} target="_blank" rel="noreferrer" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Download size={16} />
                    </a>
                    <button onClick={() => handleDeleteDoc(doc.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
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
            <h3 className="font-bold mb-4">Préstamos Activos e Históricos</h3>
            <div className="space-y-3">
              {customerLoans.map((loan: any) => (
                <div key={loan.id} className="flex justify-between items-center p-4 border border-border-subtle rounded-xl cursor-pointer hover:bg-hover-bg" onClick={() => navigate(`/credits/${loan.id}`)}>
                  <div>
                    <p className="font-medium">Crédito #{formatLoanId(loan.id)}</p>
                    <p className="text-sm text-text-secondary">${loan.amount} • {loan.termMonths} meses</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${loan.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'}`}>
                    {loan.status}
                  </span>
                </div>
              ))}
              {customerLoans.length === 0 && <p className="text-center text-text-secondary py-4">No tiene préstamos registrados.</p>}
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
