import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, TrendingUp, RefreshCw, Download, Calendar, CheckCircle, Clock, AlertCircle, History } from 'lucide-react';
import { useAssociateDetails, useAssociates } from '../services/associateService';
import { toast } from '../lib/toast';
import ContributionModal from './ContributionModal';
import InstallmentsModal from './InstallmentsModal';

type TabType = 'overview' | 'installments' | 'calendar';

export default function AssociateDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const associateId = Number(id);

  const { data: associatesData } = useAssociates({ pageSize: 100 });
  const associates = Array.isArray(associatesData?.data?.associates)
    ? associatesData.data.associates
    : Array.isArray(associatesData?.data)
      ? associatesData.data
      : [];
  const associate = associates.find((a: any) => Number(a.id) === associateId);

  const { portal, installments, contributions, calendar, isLoading, createContribution, createDistribution, createReinvestment, payInstallment } = useAssociateDetails(associateId);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showModal, setShowModal] = useState<'contribution' | 'distribution' | 'reinvestment' | null>(null);
  const [showContributionsModal, setShowContributionsModal] = useState(false);
  const [showInstallmentsModal, setShowInstallmentsModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-center text-text-secondary">Cargando portal del socio...</div>;
  }

  if (!associate) {
    return (
      <div className="p-8 text-center text-text-secondary">
        <p>Socio no encontrado.</p>
        <button onClick={() => navigate('/associates')} className="mt-4 text-brand-primary">Volver a socios</button>
      </div>
    );
  }

  const associateName = (typeof associate?.name === 'string' && associate.name.trim())
    ? associate.name.trim()
    : [associate?.firstName, associate?.lastName].filter(Boolean).join(' ').trim() || 'Socio sin nombre';

  const portalSummary = portal?.summary;
  const totalContributions = portalSummary?.totalContributed ?? portal?.totalContributions ?? 0;
  const totalDistributions = portalSummary?.totalDistributed ?? portal?.totalDistributions ?? 0;
  const activeLoansCount = portalSummary?.activeLoanCount ?? portal?.activeLoansCount ?? 0;
  const participatedLoans = Array.isArray(portal?.loans) ? portal.loans : [];

  const installmentsData = installments || { installments: [], totals: { totalPending: 0, totalPaid: 0, totalOverdue: 0 } };
  const calendarData = calendar || { events: [], summary: { contributionCount: 0, distributionCount: 0, installmentCount: 0, pendingInstallments: 0 } };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setIsSubmitting(true);
    try {
      const payload = { amount: parseFloat(amount), date: new Date().toISOString() };
      
      if (showModal === 'contribution') {
        await createContribution.mutateAsync(payload);
      } else if (showModal === 'distribution') {
        await createDistribution.mutateAsync(payload);
      } else if (showModal === 'reinvestment') {
        await createReinvestment.mutateAsync(payload);
      }
      
      setShowModal(null);
      setAmount('');
      toast.success({ title: 'Operación registrada exitosamente' });
    } catch (error) {
      toast.error({ title: 'Error al registrar la operación' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayInstallment = async (installmentNumber: number) => {
    try {
      await payInstallment.mutateAsync(installmentNumber);
      toast.success({ title: 'Cuota marcada como pagada' });
    } catch (error) {
      toast.error({ title: 'Error al marcar la cuota como pagada' });
    }
  };

  const renderOverviewTab = () => (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium">Capital Total Aportado</h3>
          <p className="text-2xl font-semibold mt-1">${totalContributions.toLocaleString()}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium">Ganancias Distribuidas</h3>
          <p className="text-2xl font-semibold mt-1 text-emerald-600">${totalDistributions.toLocaleString()}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium">Préstamos Activos</h3>
          <p className="text-2xl font-semibold mt-1">{activeLoansCount}</p>
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        <h3 className="text-lg font-bold text-text-primary mb-4">Préstamos Participados</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="pb-3 font-medium">ID Préstamo</th>
                <th className="pb-3 font-medium">Monto Original</th>
                <th className="pb-3 font-medium">Interés Total</th>
                <th className="pb-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {participatedLoans.map((loan: any) => (
                <tr key={loan.id} className="hover:bg-hover-bg transition-colors">
                  <td className="py-4 font-mono">{String(loan.id).substring(0, 8)}</td>
                  <td className="py-4 font-medium">${loan.amount.toLocaleString()}</td>
                  <td className="py-4 text-emerald-600">${loan.totalInterest?.toLocaleString() || '0'}</td>
                  <td className="py-4">
                    <span className="px-2 py-1 bg-status-info-bg text-status-info rounded-full text-xs">
                      {loan.status}
                    </span>
                  </td>
                </tr>
              ))}
              {participatedLoans.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-text-secondary">No participa en ningún préstamo activo.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderInstallmentsTab = () => (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium flex items-center gap-2">
            <Clock size={16} className="text-amber-500" /> Pendiente
          </h3>
          <p className="text-2xl font-semibold mt-1 text-amber-600">${installmentsData.totals.totalPending.toLocaleString()}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-500" /> Pagado
          </h3>
          <p className="text-2xl font-semibold mt-1 text-emerald-600">${installmentsData.totals.totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" /> Vencido
          </h3>
          <p className="text-2xl font-semibold mt-1 text-red-600">${installmentsData.totals.totalOverdue.toLocaleString()}</p>
        </div>
      </div>

      {/* Installments Table */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        <h3 className="text-lg font-bold text-text-primary mb-4">Cuotas del Socio</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">Monto</th>
                <th className="pb-3 font-medium">Fecha Vencimiento</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {installmentsData.installments.map((inst: any) => (
                <tr key={inst.id} className="hover:bg-hover-bg transition-colors">
                  <td className="py-4 font-medium">{inst.installmentNumber}</td>
                  <td className="py-4 font-medium">${Number(inst.amount).toLocaleString()}</td>
                  <td className="py-4">{new Date(inst.dueDate).toLocaleDateString()}</td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      inst.status === 'paid' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : new Date(inst.dueDate) < new Date()
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}>
                      {inst.status === 'paid' ? 'Pagado' : new Date(inst.dueDate) < new Date() ? 'Vencido' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="py-4">
                    {inst.status === 'pending' && (
                      <button
                        onClick={() => handlePayInstallment(inst.installmentNumber)}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        <CheckCircle size={14} /> Marcar como pagado
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {installmentsData.installments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-text-secondary">No hay cuotas registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCalendarTab = () => (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium">Aportes</h3>
          <p className="text-2xl font-semibold mt-1">{calendarData.summary.contributionCount}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium">Distribuciones</h3>
          <p className="text-2xl font-semibold mt-1">{calendarData.summary.distributionCount}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium">Cuotas</h3>
          <p className="text-2xl font-semibold mt-1">{calendarData.summary.installmentCount}</p>
        </div>
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
          <h3 className="text-text-secondary text-sm font-medium">Cuotas Pendientes</h3>
          <p className="text-2xl font-semibold mt-1 text-amber-600">{calendarData.summary.pendingInstallments}</p>
        </div>
      </div>

      {/* Calendar Events */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        <h3 className="text-lg font-bold text-text-primary mb-4">Eventos del Calendario</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="pb-3 font-medium">Fecha</th>
                <th className="pb-3 font-medium">Tipo</th>
                <th className="pb-3 font-medium">Monto</th>
                <th className="pb-3 font-medium">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {calendarData.events.map((event: any, idx: number) => (
                <tr key={idx} className="hover:bg-hover-bg transition-colors">
                  <td className="py-4">{new Date(event.date).toLocaleDateString()}</td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      event.type === 'contribution' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : event.type === 'distribution'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}>
                      {event.displayType}
                    </span>
                  </td>
                  <td className="py-4 font-medium">{event.displayAmount}</td>
                  <td className="py-4 text-text-secondary">{event.notes || '-'}</td>
                </tr>
              ))}
              {calendarData.events.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-text-secondary">No hay eventos en el calendario.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/associates')}
            className="p-2 hover:bg-hover-bg rounded-xl text-text-secondary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Portal del Socio</h1>
            <p className="text-sm text-text-secondary">{associateName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowContributionsModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
            <History size={16} /> Aportaciones
          </button>
          <button onClick={() => setShowInstallmentsModal(true)} className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
            <Clock size={16} /> Cuotas
          </button>
          <button onClick={() => setShowModal('contribution')} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
            <Wallet size={16} /> Aportar
          </button>
          <button onClick={() => setShowModal('distribution')} className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors">
            <Download size={16} /> Retirar Ganancias
          </button>
          <button onClick={() => setShowModal('reinvestment')} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <RefreshCw size={16} /> Reinvertir
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border-subtle">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Resumen
          </button>
          <button
            onClick={() => setActiveTab('installments')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'installments'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Wallet size={16} /> Cuotas
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'calendar'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Calendar size={16} /> Calendario
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'installments' && renderInstallmentsTab()}
      {activeTab === 'calendar' && renderCalendarTab()}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-2xl w-full max-w-md p-6 border border-border-subtle">
            <h3 className="text-xl font-bold mb-4">
              {showModal === 'contribution' ? 'Registrar Aporte de Capital' :
               showModal === 'distribution' ? 'Distribuir Ganancias' :
               'Reinvertir Ganancias'}
            </h3>
            <form onSubmit={handleAction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Monto</label>
                <input 
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2"
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowModal(null)}
                  className="flex-1 py-2 border border-border-subtle rounded-lg hover:bg-hover-bg"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showContributionsModal && contributions !== undefined && (
        <ContributionModal
          contributions={contributions}
          isLoading={false}
          associateId={associateId}
          onAddContribution={async (data) => {
            await createContribution.mutateAsync(data);
          }}
          onClose={() => setShowContributionsModal(false)}
        />
      )}

      {showInstallmentsModal && (
        <InstallmentsModal
          installments={installments}
          isLoading={false}
          onClose={() => setShowInstallmentsModal(false)}
        />
      )}
    </div>
  );
}
