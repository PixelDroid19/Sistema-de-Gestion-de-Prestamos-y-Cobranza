import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Bell, Clock, CreditCard, CheckCircle, Edit2, UserPlus } from 'lucide-react';
import { useLoanById, useLoanDetails, useLoans } from '../services/loanService';
import { useCreditReports } from '../services/reportService';
import { useUsers } from '../services/userService';
import { useSessionStore } from '../store/sessionStore';
import { toast } from '../lib/toast';

export default function CreditDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loanId = Number(id);
  const [activeTab, setActiveTab] = useState<'calendar' | 'alerts' | 'promises' | 'payoff' | 'history'>('calendar');
  const { user } = useSessionStore();

  const { data: loansData, isLoading: isLoadingLoans, updateLoanStatus, assignRecovery } = useLoans();
  const { data: loanData, isLoading: isLoadingLoanRecord } = useLoanById(loanId);
  const loans = Array.isArray(loansData?.data?.loans)
    ? loansData.data.loans
    : Array.isArray(loansData?.data)
      ? loansData.data
      : [];
  const loan = loanData?.data?.loan ?? loans.find((l: any) => Number(l?.id) === loanId);

  const { calendar, calendarSnapshot, alerts, promises, payoffQuote, isLoading: isLoadingDetails, executePayoff } = useLoanDetails(loanId);
  const { history, isLoading: isLoadingHistory } = useCreditReports(loanId);
  const { data: usersData } = useUsers({ limit: 100 });
  const users = Array.isArray(usersData?.data?.users)
    ? usersData.data.users
    : Array.isArray(usersData?.data)
      ? usersData.data
      : [];
  const agents = users.filter((u: any) => u.role === 'agent');

  const formatDate = (value: unknown, withTime = false) => {
    if (!value) return 'Sin fecha';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return 'Sin fecha';
    return withTime ? date.toLocaleString() : date.toLocaleDateString();
  };

  const formatCurrency = (value: unknown) => {
    const numericValue = Number(value ?? 0);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 2,
    }).format(Number.isFinite(numericValue) ? numericValue : 0);
  };

  const statusLabel = useMemo(() => {
    switch (loan?.status) {
      case 'active':
        return 'Activo';
      case 'approved':
        return 'Aprobado';
      case 'completed':
      case 'closed':
        return 'Completado';
      case 'defaulted':
        return 'En mora';
      case 'pending':
        return 'Pendiente';
      case 'rejected':
        return 'Rechazado';
      default:
        return loan?.status || 'Sin estado';
    }
  }, [loan?.status]);

  const promiseDate = (promise: any) => promise?.promisedDate || promise?.promiseDate || promise?.createdAt;

  const historyEntries = useMemo(() => {
    const source = history?.data?.history ?? history;
    const payments = Array.isArray(source?.payments) ? source.payments : [];
    const payoffHistory = Array.isArray(source?.payoffHistory) ? source.payoffHistory : [];

    return [
      ...payments.map((payment: any) => ({
        id: `payment-${payment.id ?? payment.createdAt ?? Math.random()}`,
        action: `Pago ${payment.paymentType || 'registrado'}`,
        description: `Monto: ${formatCurrency(payment.amount)}`,
        date: payment.paymentDate || payment.createdAt,
      })),
      ...payoffHistory.map((event: any) => ({
        id: `payoff-${event.id ?? event.createdAt ?? Math.random()}`,
        action: 'Liquidacion ejecutada',
        description: `Monto: ${formatCurrency(event.amount ?? event.quotedTotal)}`,
        date: event.paymentDate || event.createdAt,
      })),
    ].filter((entry) => entry.date);
  }, [history]);

  const customerLabel = loan?.Customer?.name || loan?.customerName || loan?.customerId || 'Sin cliente';
  const agentLabel = loan?.Agent?.name || loan?.agentName || loan?.agentId || 'Sin asignar';
  const calendarEntries = Array.isArray(calendar) ? calendar : [];
  const alertEntries = Array.isArray(alerts) ? alerts : [];
  const promiseEntries = Array.isArray(promises) ? promises : [];

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [newAgent, setNewAgent] = useState('');

  if (!Number.isFinite(loanId) || loanId <= 0) {
    return (
      <div className="p-8 text-center text-text-secondary">
        <p>ID de credito invalido.</p>
        <button onClick={() => navigate('/credits')} className="mt-4 text-brand-primary">Volver a creditos</button>
      </div>
    );
  }

  if (isLoadingLoans || isLoadingLoanRecord || isLoadingDetails) {
    return <div className="p-8 text-center text-text-secondary">Cargando detalles del crédito...</div>;
  }

  if (!loan) {
    return (
      <div className="p-8 text-center text-text-secondary">
        <p>Crédito no encontrado.</p>
        <button onClick={() => navigate('/credits')} className="mt-4 text-brand-primary">Volver a créditos</button>
      </div>
    );
  }

  const handlePayoff = async () => {
    if (!payoffQuote) return;
    const quotedTotal = payoffQuote.total ?? payoffQuote.totalPayoffAmount;
    if (window.confirm(`¿Confirmar liquidacion por ${formatCurrency(quotedTotal)}?`)) {
      try {
        await executePayoff.mutateAsync({
          asOfDate: payoffQuote.asOfDate,
          quotedTotal,
        });
        toast.success({ title: 'Crédito liquidado exitosamente' });
      } catch (error) {
        toast.error({ title: 'Error al liquidar crédito' });
      }
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    try {
      await updateLoanStatus.mutateAsync({ id: loanId, status: newStatus });
      setShowStatusModal(false);
    } catch (error) {
      toast.error({ title: 'Error al actualizar estado' });
    }
  };

  const handleAssignAgent = async () => {
    if (!newAgent) return;
    try {
      await assignRecovery.mutateAsync({ id: loanId, recoveryAssigneeId: parseInt(newAgent) });
      setShowAgentModal(false);
    } catch (error) {
      toast.error({ title: 'Error al asignar agente' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button 
          onClick={() => navigate('/credits')}
          className="p-2 hover:bg-hover-bg rounded-xl text-text-secondary transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Crédito #{loan.id}</h1>
              <p className="text-sm text-text-secondary">Cliente: {customerLabel} | Agente: {agentLabel}</p>
            </div>
          </div>
          
          {/* Financial Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 p-4 bg-bg-base border border-border-subtle rounded-xl">
            <div>
              <p className="text-xs text-text-secondary">N° Total de Cuotas</p>
              <p className="text-lg font-semibold text-text-primary">{loan.termMonths ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Cuotas a Pagar</p>
              <p className="text-lg font-semibold text-text-primary">{loan.paymentContext?.snapshot?.outstandingInstallments ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Interés Total</p>
              <p className="text-lg font-semibold text-text-primary">{formatCurrency(loan.paymentContext?.snapshot?.totalInterest)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Capital Amortizado</p>
              <p className="text-lg font-semibold text-text-primary">{formatCurrency(loan.paymentContext?.snapshot?.totalPaidPrincipal)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Capital Vivo</p>
              <p className="text-lg font-semibold text-brand-primary">{formatCurrency(loan.paymentContext?.snapshot?.outstandingPrincipal)}</p>
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button 
            onClick={() => setShowAgentModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-bg-surface border border-border-subtle rounded-lg text-sm hover:bg-hover-bg transition-colors"
          >
            <UserPlus size={16} />
            Asignar Agente
          </button>
          <button 
            onClick={() => setShowStatusModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-bg-surface border border-border-subtle rounded-lg text-sm hover:bg-hover-bg transition-colors"
          >
            <Edit2 size={16} />
            Cambiar Estado
          </button>
          <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            loan.status === 'active' ? 'bg-status-success-bg text-status-success' :
            loan.status === 'completed' || loan.status === 'closed' ? 'bg-status-info-bg text-status-info' :
            'bg-status-warning-bg text-status-warning'
          }`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle overflow-x-auto">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
            activeTab === 'calendar' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Calendar size={16} /> Calendario
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
            activeTab === 'alerts' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Bell size={16} /> Alertas
        </button>
        <button
          onClick={() => setActiveTab('promises')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
            activeTab === 'promises' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Clock size={16} /> Promesas de Pago
        </button>
        <button
          onClick={() => setActiveTab('payoff')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
            activeTab === 'payoff' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <CreditCard size={16} /> Liquidación
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
            activeTab === 'history' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <CheckCircle size={16} /> Historial
        </button>
      </div>

      {/* Content */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        {activeTab === 'calendar' && (
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-4">Calendario de Pagos</h2>
            {calendarEntries.length > 0 ? (
              <>
                {/* Full Amortization Table */}
                <div className="bg-bg-base rounded-xl border border-border-subtle overflow-hidden mb-4">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-text-secondary bg-bg-surface sticky top-0 shadow-sm">
                        <tr>
                          <th className="py-3 px-4 text-center font-medium">N° Cuota</th>
                          <th className="py-3 px-4 text-right font-medium">Cuota a Pagar</th>
                          <th className="py-3 px-4 text-right font-medium">Interés</th>
                          <th className="py-3 px-4 text-right font-medium">Capital Amort.</th>
                          <th className="py-3 px-4 text-right font-medium">Capital Vivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {/* Initial balance row */}
                        <tr className="bg-hover-bg/50">
                          <td className="py-2 px-4 text-center text-text-secondary">0</td>
                          <td className="py-2 px-4 text-right text-text-secondary">-</td>
                          <td className="py-2 px-4 text-right text-text-secondary">-</td>
                          <td className="py-2 px-4 text-right text-text-secondary">-</td>
                          <td className="py-2 px-4 text-right font-semibold text-text-primary">
                            {formatCurrency(loan.amount)}
                          </td>
                        </tr>
                        {calendarEntries.reduce((rows: any[], installment: any, index: number) => {
                          // Derive the components from the calendar entry data
                          // Note: remainingPrincipal/remainingInterest in calendar entries are the payment components, not cumulative
                          const scheduledPayment = installment.scheduledPayment ?? 0;
                          const interestComponent = installment.remainingInterest ?? 0;
                          const principalComponent = scheduledPayment - interestComponent;
                          
                          // Calculate running balance (Capital Vivo)
                          const openingBalance = index === 0 
                            ? Number(loan.amount) 
                            : rows[index - 1].closingBalance;
                          const closingBalance = Math.max(0, openingBalance - principalComponent);
                          
                          rows.push({
                            installmentNumber: installment.installmentNumber,
                            scheduledPayment,
                            interestComponent,
                            principalComponent,
                            openingBalance,
                            closingBalance,
                            status: installment.status,
                          });
                          return rows;
                        }, []).map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-hover-bg transition-colors">
                            <td className="py-2 px-4 text-center">{row.installmentNumber}</td>
                            <td className="py-2 px-4 text-right font-medium text-blue-600 dark:text-blue-400">
                              {formatCurrency(row.scheduledPayment)}
                            </td>
                            <td className="py-2 px-4 text-right text-amber-600 dark:text-amber-400">
                              {formatCurrency(row.interestComponent)}
                            </td>
                            <td className="py-2 px-4 text-right text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(row.principalComponent)}
                            </td>
                            <td className="py-2 px-4 text-right font-medium">
                              {formatCurrency(row.closingBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {calendarSnapshot && (
                        <tfoot className="bg-bg-base border-t border-border-subtle">
                          <tr>
                            <td colSpan={4} className="py-2 px-4 text-right font-medium text-text-secondary">Balance pendiente:</td>
                            <td className="py-2 px-4 text-right font-bold text-brand-primary">
                              {formatCurrency(calendarSnapshot.outstandingBalance)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-text-secondary">No hay cuotas programadas.</p>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-4">Alertas del Crédito</h2>
            {alertEntries.length > 0 ? (
              <div className="space-y-3">
                {alertEntries.map((alert: any, index: number) => (
                  <div key={index} className="p-4 border border-border-subtle rounded-xl bg-status-warning-bg">
                    <p className="font-medium text-status-warning">{alert.type || alert.alertType}</p>
                    <p className="text-sm mt-1 text-text-secondary">{alert.message || `Cuota ${alert.installmentNumber} con saldo ${formatCurrency(alert.outstandingAmount)}`}</p>
                    <p className="text-xs mt-2 text-text-secondary">{formatDate(alert.createdAt, true)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary">No hay alertas activas.</p>
            )}
          </div>
        )}

        {activeTab === 'promises' && (
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-4">Promesas de Pago</h2>
            {promiseEntries.length > 0 ? (
              <div className="space-y-3">
                {promiseEntries.map((promise: any, index: number) => (
                  <div key={index} className="p-4 border border-border-subtle rounded-xl flex justify-between items-center">
                    <div>
                      <p className="font-medium text-text-primary">Monto: {formatCurrency(promise.amount)}</p>
                      <p className="text-sm text-text-secondary">Para: {formatDate(promiseDate(promise))}</p>
                    </div>
                    <span className="px-2 py-1 bg-bg-base rounded-md text-xs font-medium text-text-secondary">
                      {promise.status || 'Sin estado'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary">No hay promesas de pago registradas.</p>
            )}
          </div>
        )}

        {activeTab === 'payoff' && (
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-4">Liquidación Total</h2>
            {payoffQuote ? (
               <div className="p-6 border border-brand-primary/20 bg-brand-primary/5 rounded-xl max-w-md">
                 <div className="flex justify-between mb-2">
                   <span className="text-text-secondary">Fecha de cálculo:</span>
                    <span className="font-medium text-text-primary">{formatDate(payoffQuote.asOfDate)}</span>
                  </div>
                  <div className="flex justify-between mb-4 border-b border-border-subtle pb-4">
                    <span className="text-text-secondary">Principal restante:</span>
                    <span className="font-medium text-text-primary">{formatCurrency(payoffQuote.outstandingPrincipal ?? payoffQuote.principalBalance)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-lg font-medium text-text-primary">Total a pagar:</span>
                    <span className="text-2xl font-bold text-brand-primary">{formatCurrency(payoffQuote.total ?? payoffQuote.totalPayoffAmount)}</span>
                  </div>
                 <button 
                   onClick={handlePayoff}
                   disabled={user?.role !== 'customer'}
                   className="w-full py-3 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary/90 transition-colors"
                 >
                   {user?.role === 'customer' ? 'Ejecutar Liquidacion' : 'Disponible solo para clientes'}
                 </button>
               </div>
            ) : (
              <p className="text-text-secondary">No se pudo generar la cotización de liquidación.</p>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-4">Historial de Transacciones</h2>
            {isLoadingHistory ? (
              <p className="text-text-secondary">Cargando historial...</p>
            ) : historyEntries.length > 0 ? (
              <div className="space-y-3">
                {historyEntries.map((event: any, index: number) => (
                  <div key={event.id || index} className="flex gap-4 p-4 border border-border-subtle rounded-xl">
                    <div className="w-2 h-full bg-border-strong rounded-full"></div>
                    <div>
                      <p className="font-medium text-text-primary">{event.action}</p>
                      <p className="text-sm text-text-secondary">{event.description}</p>
                      <p className="text-xs text-text-secondary mt-1">{formatDate(event.date, true)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary">No hay historial disponible.</p>
            )}
          </div>
        )}
      </div>

      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-2xl w-full max-w-sm p-6 border border-border-subtle">
            <h3 className="text-lg font-bold mb-4">Cambiar Estado</h3>
            <select 
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2 mb-4"
            >
              <option value="">Seleccione un estado...</option>
              <option value="active">Activo</option>
              <option value="approved">Aprobado</option>
              <option value="completed">Completado</option>
              <option value="defaulted">En Mora (Defaulted)</option>
              <option value="rejected">Rechazado</option>
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowStatusModal(false)} className="flex-1 py-2 border border-border-subtle rounded-lg hover:bg-hover-bg">Cancelar</button>
              <button onClick={handleUpdateStatus} className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {showAgentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-2xl w-full max-w-sm p-6 border border-border-subtle">
            <h3 className="text-lg font-bold mb-4">Asignar Agente</h3>
            <select 
              value={newAgent}
              onChange={(e) => setNewAgent(e.target.value)}
              className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2 mb-4"
            >
              <option value="">Seleccione un agente...</option>
              {agents.map((agent: any) => (
                <option key={agent.id} value={agent.id}>{agent.name || [agent.firstName, agent.lastName].filter(Boolean).join(' ') || agent.email || `#${agent.id}`}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowAgentModal(false)} className="flex-1 py-2 border border-border-subtle rounded-lg hover:bg-hover-bg">Cancelar</button>
              <button onClick={handleAssignAgent} className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90">Asignar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
