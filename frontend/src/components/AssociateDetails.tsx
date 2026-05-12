import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, RefreshCw, Download, Calendar, CheckCircle, Clock, AlertCircle, History } from 'lucide-react';
import { useAssociateDetails } from '../services/associateService';
import { toast } from '../lib/toast';
import ContributionModal from './ContributionModal';
import InstallmentsModal from './InstallmentsModal';
import { useSessionStore } from '../store/sessionStore';
import { ActionButton, DataTableSurface, EmptyState, MetricCard, ModalShell, PageHeader, PageShell, SectionSurface, ToolbarSurface } from './shared/Surfaces';
import TableShell from './shared/TableShell';

type TabType = 'overview' | 'installments' | 'calendar';

const formatCurrency = (value: unknown) => `$${Number(value || 0).toLocaleString()}`;

const dateFormatter = new Intl.DateTimeFormat('es-CO');

const formatDate = (value: unknown) => {
  const timestamp = Date.parse(String(value || ''));
  return Number.isNaN(timestamp) ? '-' : dateFormatter.format(timestamp);
};

const getInstallmentStatusPresentation = (installment: any) => {
  if (installment?.status === 'paid') {
    return {
      label: 'Pagado',
      className: 'bg-emerald-100 text-emerald-700',
    };
  }

  const dueTimestamp = Date.parse(String(installment?.dueDate || ''));
  if (Number.isFinite(dueTimestamp) && dueTimestamp < Date.now()) {
    return {
      label: 'Vencido',
      className: 'bg-red-100 text-red-700',
    };
  }

  return {
    label: 'Pendiente',
    className: 'bg-amber-100 text-amber-700',
  };
};

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
    return (
      <PageShell className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionSurface>
          <EmptyState title="Cargando portal del socio" description="Estamos preparando aportes, cuotas y calendario." compact />
        </SectionSurface>
      </PageShell>
    );
  }

  if (!associate && !portal) {
    return (
      <PageShell className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionSurface>
          <EmptyState
            title="Socio no encontrado"
            description="No pudimos cargar este portal. Revisa el listado de socios o intenta nuevamente."
            action={<ActionButton onClick={() => navigate('/associates')}>Volver a socios</ActionButton>}
          />
        </SectionSurface>
      </PageShell>
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
    <div className="space-y-6">
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

      <DataTableSurface>
        <div className="px-5 pt-5 sm:px-6">
          <h3 className="text-lg font-semibold text-text-primary">Créditos participados</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Créditos donde este socio quedó asociado para trazabilidad de aportes o participación.
          </p>
        </div>
        <TableShell
          isLoading={false}
          isError={false}
          hasData={participatedLoans.length > 0}
          loadingContent={null}
          errorContent={null}
          emptyContent={<div className="py-4 text-center text-text-secondary">No participa en ningún crédito activo.</div>}
          recordsLabel="créditos"
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
      </DataTableSurface>
    </div>
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
      <DataTableSurface>
        <div className="px-5 pt-5 sm:px-6">
          <h3 className="text-lg font-semibold text-text-primary">Cuotas del socio</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Cuotas vinculadas a créditos donde participa este socio.
          </p>
        </div>
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
                <th className="font-medium">Fecha vencimiento</th>
                <th className="font-medium">Estado</th>
                <th className="font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {installmentsData.installments.map((inst: any) => {
                const status = getInstallmentStatusPresentation(inst);

                return (
                <tr key={inst.id} className="hover:bg-hover-bg transition-colors">
                  <td className="font-medium">{inst.installmentNumber}</td>
                  <td className="font-medium">${Number(inst.amount).toLocaleString()}</td>
                  <td>{formatDate(inst.dueDate)}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td>
                    {isAdmin && inst.status === 'pending' && (
                      <ActionButton
                        onClick={() => handlePayInstallment(inst.installmentNumber)}
                        icon={<CheckCircle size={14} />}
                        className="min-h-8 px-2.5 py-1.5 text-xs"
                      >
                        Marcar como pagado
                      </ActionButton>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </TableShell>
      </DataTableSurface>
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
      <DataTableSurface>
        <div className="px-5 pt-5 sm:px-6">
          <h3 className="text-lg font-semibold text-text-primary">Eventos del calendario</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Fechas de aportes, distribuciones y cuotas relacionadas con el socio.
          </p>
        </div>
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
              {calendarData.events.map((event: any) => (
                <tr key={event.id ?? `${event.type}-${event.date}-${event.displayAmount}-${event.notes ?? ''}`} className="hover:bg-hover-bg transition-colors">
                  <td>{formatDate(event.date)}</td>
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
      </DataTableSurface>
    </div>
  );

  return (
    <PageShell className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8" data-tour="associate-details-page">
      <PageHeader
        title="Portal del socio"
        subtitle={`${associateName} · Consulta aportes, cuotas y créditos asociados sin mezclarlo con la originación de créditos.`}
        guideKey="associate-details"
        tourId="associate-details-header"
        actions={(
          <ActionButton
            onClick={() => navigate('/associates')}
            aria-label="Volver a socios"
            title="Volver a socios"
            icon={<ArrowLeft size={16} />}
          >
            Volver
          </ActionButton>
        )}
      />

      <ToolbarSurface className="items-stretch gap-4 lg:items-center" data-tour="associate-details-actions">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">Acciones del socio</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
            Consulta historial y cuotas, o registra movimientos de capital. Estas acciones no cambian tasa, mora ni cronograma de créditos existentes.
          </p>
        </div>
        <div className="grid gap-2 lg:min-w-[23rem]">
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton onClick={() => setShowContributionsModal(true)} icon={<History size={16} />} fullWidth>
              Ver historial
            </ActionButton>
            <ActionButton onClick={() => setShowInstallmentsModal(true)} icon={<Clock size={16} />} fullWidth>
              Ver cuotas
            </ActionButton>
          </div>
          {isAdmin && (
            <div className="grid gap-2 sm:grid-cols-2">
              <ActionButton onClick={() => setShowModal('contribution')} icon={<Wallet size={16} />} variant="primary" fullWidth>
                Registrar aporte
              </ActionButton>
              <ActionButton onClick={() => setShowModal('distribution')} icon={<Download size={16} />} variant="secondary" fullWidth>
                Registrar retiro
              </ActionButton>
              <ActionButton onClick={() => setShowModal('reinvestment')} icon={<RefreshCw size={16} />} fullWidth className="sm:col-span-2">
                Registrar reinversión
              </ActionButton>
            </div>
          )}
        </div>
      </ToolbarSurface>

      {isSocio && (
        <SectionSurface className="py-4">
          <p className="text-sm leading-6 text-text-secondary">
          Este portal te permite revisar tus aportes, distribuciones, cuotas y calendario. Los movimientos financieros se registran desde la mesa operativa.
          </p>
        </SectionSurface>
      )}

      {/* Tabs */}
      <div data-tour="associate-details-tabs">
        <nav className="view-tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`view-tab ${activeTab === 'overview' ? 'view-tab--active' : ''}`}
          >
            Resumen
          </button>
          <button
            onClick={() => setActiveTab('installments')}
            className={`view-tab ${activeTab === 'installments' ? 'view-tab--active' : ''}`}
          >
            <Wallet size={16} /> Cuotas
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`view-tab ${activeTab === 'calendar' ? 'view-tab--active' : ''}`}
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
        <ModalShell
          title={showModal === 'contribution' ? 'Registrar aporte de capital' :
            showModal === 'distribution' ? 'Distribuir ganancias' :
              'Reinvertir ganancias'}
        >
            <form onSubmit={handleAction} className="space-y-4">
              <div>
                <label htmlFor="associate-action-amount" className="block text-sm font-medium text-text-secondary mb-1">Monto</label>
                <input 
                  id="associate-action-amount"
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
                <ActionButton
                  type="button"
                  onClick={() => setShowModal(null)}
                  fullWidth
                >
                  Cancelar
                </ActionButton>
                <ActionButton
                  type="submit"
                  disabled={isSubmitting}
                  variant="primary"
                  fullWidth
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar'}
                </ActionButton>
              </div>
            </form>
        </ModalShell>
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
    </PageShell>
  );
}
