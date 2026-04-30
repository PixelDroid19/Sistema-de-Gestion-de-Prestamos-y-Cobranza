import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, RefreshCw, Download, Calendar, CheckCircle, Clock, AlertCircle, History } from 'lucide-react';
import { useAssociateDetails } from '../services/associateService';
import { toast } from '../lib/toast';
import ContributionModal from './ContributionModal';
import InstallmentsModal from './InstallmentsModal';
import { useSessionStore } from '../store/sessionStore';
import { MetricCard } from './shared/Surfaces';
import { QuickGuideButton } from './shared/HelpSupport';
import TableShell from './shared/TableShell';

type TabType = 'overview' | 'installments' | 'calendar';

const formatCurrency = (value: unknown) => `$${Number(value || 0).toLocaleString()}`;

const getLoanStatusPresentation = (status: unknown) => {
  const normalizedStatus = String(status || '').toLowerCase();

  switch (normalizedStatus) {
    case 'active':
    case 'approved':
      return {
        label: 'Activo',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      };
    case 'pending':
      return {
        label: 'Pendiente',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      };
    case 'completed':
    case 'closed':
      return {
        label: 'Completado',
        className: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200',
      };
    default:
      return {
        label: normalizedStatus ? normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1) : 'Sin estado',
        className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200',
      };
  }
};

const actionButtonClassName = 'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors';

export default function AssociateDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const associateId = Number(id);
  const { user } = useSessionStore();
  const isAdmin = user?.role === 'admin';
  const isSocio = user?.role === 'socio';

  const { portal, installments, contributions, calendar, isLoading, createContribution, createDistribution, createReinvestment, payInstallment } = useAssociateDetails(associateId);
  const associate = portal?.associate ?? null;

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showModal, setShowModal] = useState<'contribution' | 'distribution' | 'reinvestment' | null>(null);
  const [showContributionsModal, setShowContributionsModal] = useState(false);
  const [showInstallmentsModal, setShowInstallmentsModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-center text-text-secondary">Cargando portal del socio...</div>;
  }

  if (!associate && !portal) {
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
        await createContribution.mutateAsync({
          amount: payload.amount,
          contributionDate: new Date().toISOString(),
        });
      } else if (showModal === 'distribution') {
        await createDistribution.mutateAsync({
          amount: payload.amount,
          distributionDate: new Date().toISOString(),
        });
      } else if (showModal === 'reinvestment') {
        await createReinvestment.mutateAsync({
          amount: payload.amount,
          reinvestmentDate: new Date().toISOString(),
        });
      }
      
      setShowModal(null);
      setAmount('');
      toast.success({ title: 'Operación registrada exitosamente' });
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'associates' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayInstallment = async (installmentNumber: number) => {
    try {
      await payInstallment.mutateAsync(installmentNumber);
      toast.success({ title: 'Cuota marcada como pagada' });
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'associates' });
    }
  };

  const renderOverviewTab = () => (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Capital aportado"
          value={formatCurrency(totalContributions)}
          icon={<Wallet size={18} />}
          accent="blue"
        />
        <MetricCard
          label="Ganancias distribuidas"
          value={formatCurrency(totalDistributions)}
          icon={<Download size={18} />}
          accent="emerald"
        />
        <MetricCard
          label="Créditos activos"
          value={activeLoansCount}
          icon={<CheckCircle size={18} />}
          accent="slate"
        />
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        <h3 className="text-lg font-bold text-text-primary mb-4">Créditos participados</h3>
        <TableShell
          isLoading={false}
          isError={false}
          hasData={participatedLoans.length > 0}
          loadingContent={null}
          errorContent={null}
          emptyContent={<div className="py-4 text-center text-text-secondary">No participa en ningún préstamo activo.</div>}
          recordsLabel="préstamos"
        >
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="font-medium">ID crédito</th>
                <th className="font-medium">Monto original</th>
                <th className="font-medium">Interés total</th>
                <th className="font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {participatedLoans.map((loan: any) => (
                <tr key={loan.id} className="hover:bg-hover-bg transition-colors">
                  <td className="font-mono">{loan.id}</td>
                  <td className="font-medium">{formatCurrency(loan?.amount)}</td>
                  <td className="text-emerald-600">{formatCurrency(loan?.totalInterest)}</td>
                  <td>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${getLoanStatusPresentation(loan?.status).className}`}>
                      {getLoanStatusPresentation(loan?.status).label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </div>
    </>
  );

  const renderInstallmentsTab = () => (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Pendiente"
          value={formatCurrency(installmentsData.totals.totalPending)}
          icon={<Clock size={18} />}
          accent="amber"
        />
        <MetricCard
          label="Pagado"
          value={formatCurrency(installmentsData.totals.totalPaid)}
          icon={<CheckCircle size={18} />}
          accent="emerald"
        />
        <MetricCard
          label="Vencido"
          value={formatCurrency(installmentsData.totals.totalOverdue)}
          icon={<AlertCircle size={18} />}
          accent="rose"
        />
      </div>

      {/* Installments Table */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        <h3 className="text-lg font-bold text-text-primary mb-4">Cuotas del Socio</h3>
        <TableShell
          isLoading={false}
          isError={false}
          hasData={installmentsData.installments.length > 0}
          loadingContent={null}
          errorContent={null}
          emptyContent={<div className="py-4 text-center text-text-secondary">No hay cuotas registradas.</div>}
          recordsLabel="cuotas"
        >
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="font-medium">#</th>
                <th className="font-medium">Monto</th>
                <th className="font-medium">Fecha Vencimiento</th>
                <th className="font-medium">Estado</th>
                <th className="font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {installmentsData.installments.map((inst: any) => (
                <tr key={inst.id} className="hover:bg-hover-bg transition-colors">
                  <td className="font-medium">{inst.installmentNumber}</td>
                  <td className="font-medium">${Number(inst.amount).toLocaleString()}</td>
                  <td>{new Date(inst.dueDate).toLocaleDateString()}</td>
                  <td>
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
                  <td>
                    {isAdmin && inst.status === 'pending' && (
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
            </tbody>
          </table>
        </TableShell>
      </div>
    </div>
  );

  const renderCalendarTab = () => (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Aportes"
          value={calendarData.summary.contributionCount}
          icon={<Wallet size={18} />}
          accent="blue"
        />
        <MetricCard
          label="Distribuciones"
          value={calendarData.summary.distributionCount}
          icon={<Download size={18} />}
          accent="emerald"
        />
        <MetricCard
          label="Cuotas"
          value={calendarData.summary.installmentCount}
          icon={<Calendar size={18} />}
          accent="slate"
        />
        <MetricCard
          label="Cuotas pendientes"
          value={calendarData.summary.pendingInstallments}
          icon={<Clock size={18} />}
          accent="amber"
        />
      </div>

      {/* Calendar Events */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        <h3 className="text-lg font-bold text-text-primary mb-4">Eventos del Calendario</h3>
        <TableShell
          isLoading={false}
          isError={false}
          hasData={calendarData.events.length > 0}
          loadingContent={null}
          errorContent={null}
          emptyContent={<div className="py-4 text-center text-text-secondary">No hay eventos en el calendario.</div>}
          recordsLabel="eventos"
        >
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="font-medium">Fecha</th>
                <th className="font-medium">Tipo</th>
                <th className="font-medium">Monto</th>
                <th className="font-medium">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {calendarData.events.map((event: any, idx: number) => (
                <tr key={idx} className="hover:bg-hover-bg transition-colors">
                  <td>{new Date(event.date).toLocaleDateString()}</td>
                  <td>
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
                  <td className="font-medium">{event.displayAmount}</td>
                  <td className="text-text-secondary">{event.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-0" data-tour="associate-details-page">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between" data-tour="associate-details-header">
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
        <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
          <QuickGuideButton guideKey="associate-details" className="min-h-11 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold" />
          <button onClick={() => setShowContributionsModal(true)} className={`${actionButtonClassName} bg-emerald-600 text-white hover:bg-emerald-700`}>
            <History size={16} /> Historial de aportes
          </button>
          <button onClick={() => setShowInstallmentsModal(true)} className={`${actionButtonClassName} bg-amber-600 text-white hover:bg-amber-700`}>
            <Clock size={16} /> Cobros rápidos
          </button>
          {isAdmin && (
            <>
              <button onClick={() => setShowModal('contribution')} className={`${actionButtonClassName} bg-emerald-600 text-white hover:bg-emerald-700`}>
                <Wallet size={16} /> Registrar aporte
              </button>
              <button onClick={() => setShowModal('distribution')} className={`${actionButtonClassName} bg-brand-primary text-white hover:bg-brand-primary/90`}>
                <Download size={16} /> Registrar retiro
              </button>
              <button onClick={() => setShowModal('reinvestment')} className={`${actionButtonClassName} bg-blue-600 text-white hover:bg-blue-700`}>
                <RefreshCw size={16} /> Registrar reinversión
              </button>
            </>
          )}
        </div>
      </div>

      {isSocio && (
        <div className="rounded-2xl border border-border-subtle bg-bg-surface px-5 py-4 text-sm text-text-secondary">
          Este portal te permite revisar tus aportes, distribuciones, cuotas y calendario. Los movimientos financieros se registran desde la mesa operativa.
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border-subtle" data-tour="associate-details-tabs">
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
      <div data-tour="associate-details-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'installments' && renderInstallmentsTab()}
        {activeTab === 'calendar' && renderCalendarTab()}
      </div>

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
          onAddContribution={async (data) => {
            await createContribution.mutateAsync(data);
          }}
          onClose={() => setShowContributionsModal(false)}
          canAddContribution={isAdmin}
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
