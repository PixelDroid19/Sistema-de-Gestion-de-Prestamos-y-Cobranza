import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Calculator, Filter, Eye, Edit, Trash2, Calendar as CalendarIcon, X, AlertCircle, CheckCircle2, Clock, FileText, Check } from 'lucide-react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { useLoans } from '../services/loanService';
import { usePaginationStore } from '../store/paginationStore';
import { apiClient } from '../api/client';
import { SimulationResult } from '../types/simulation';
import DAGWorkbench from './DAGWorkbench';

const locales = {
  'es': es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface InstallmentEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'paid' | 'pending' | 'overdue';
  clientName: string;
  installmentNumber: number;
  totalInstallments: number;
  amountToPay: number;
  interest: number;
  amortizedCapital: number;
  remainingCapital: number;
  arrears: number;
}

// Función para obtener simulación del backend
const fetchSimulation = async (params: {
  amount: number;
  interestRate: number;
  termMonths: number;
}): Promise<SimulationResult> => {
  const { data } = await apiClient.post('/loans/simulations', params);
  return data.data.simulation;
};

// Generamos fechas relativas al mes actual (Marzo 2026 según el contexto)
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();

const myEventsList: InstallmentEvent[] = [
  {
    id: '1',
    title: 'Cuota 1/12 - Juan Pérez',
    start: new Date(currentYear, currentMonth - 2, 15, 10, 0),
    end: new Date(currentYear, currentMonth - 2, 15, 11, 0),
    type: 'paid',
    clientName: 'Juan Pérez',
    installmentNumber: 1,
    totalInstallments: 12,
    amountToPay: 225650.82,
    interest: 100000,
    amortizedCapital: 125650.82,
    remainingCapital: 1874349.18,
    arrears: 0,
  },
  {
    id: '2',
    title: 'Cuota 2/12 - Juan Pérez',
    start: new Date(currentYear, currentMonth - 1, 15, 10, 0),
    end: new Date(currentYear, currentMonth - 1, 15, 11, 0),
    type: 'paid',
    clientName: 'Juan Pérez',
    installmentNumber: 2,
    totalInstallments: 12,
    amountToPay: 225650.82,
    interest: 93717.46,
    amortizedCapital: 131933.36,
    remainingCapital: 1742415.82,
    arrears: 0,
  },
  {
    id: '3',
    title: 'Cuota 3/12 - Juan Pérez',
    start: new Date(currentYear, currentMonth, 15, 10, 0), // Vencida
    end: new Date(currentYear, currentMonth, 15, 11, 0),
    type: 'overdue',
    clientName: 'Juan Pérez',
    installmentNumber: 3,
    totalInstallments: 12,
    amountToPay: 225650.82,
    interest: 87120.79,
    amortizedCapital: 138530.03,
    remainingCapital: 1603885.79,
    arrears: 15420.50, // Mora
  },
  {
    id: '4',
    title: 'Cuota 4/12 - Juan Pérez',
    start: new Date(currentYear, currentMonth + 1, 15, 10, 0),
    end: new Date(currentYear, currentMonth + 1, 15, 11, 0),
    type: 'pending',
    clientName: 'Juan Pérez',
    installmentNumber: 4,
    totalInstallments: 12,
    amountToPay: 225650.82,
    interest: 80194.29,
    amortizedCapital: 145456.53,
    remainingCapital: 1458429.26,
    arrears: 0,
  },
  {
    id: '5',
    title: 'Cuota 5/12 - Juan Pérez',
    start: new Date(currentYear, currentMonth + 2, 15, 10, 0),
    end: new Date(currentYear, currentMonth + 2, 15, 11, 0),
    type: 'pending',
    clientName: 'Juan Pérez',
    installmentNumber: 5,
    totalInstallments: 12,
    amountToPay: 225650.82,
    interest: 72921.46,
    amortizedCapital: 152729.36,
    remainingCapital: 1305699.90,
    arrears: 0,
  },
  {
    id: '6',
    title: 'Cuota 6/12 - Juan Pérez',
    start: new Date(currentYear, currentMonth + 3, 15, 10, 0),
    end: new Date(currentYear, currentMonth + 3, 15, 11, 0),
    type: 'pending',
    clientName: 'Juan Pérez',
    installmentNumber: 6,
    totalInstallments: 12,
    amountToPay: 225650.82,
    interest: 65284.99,
    amortizedCapital: 160365.82,
    remainingCapital: 1145334.08,
    arrears: 0,
  }
];

export default function Credits({ setCurrentView }: { setCurrentView?: (v: string) => void }) {
  const [activeTab, setActiveTab] = useState('list');
  const [selectedEvent, setSelectedEvent] = useState<InstallmentEvent | null>(null);

  // Modal states
  const [actionModal, setActionModal] = useState<{ isOpen: boolean, type: 'view' | 'edit' | 'delete' | 'create', data: any }>({ isOpen: false, type: 'view', data: null });

  // Simulator states
  const [simParams, setSimParams] = useState({
    principal: 2000000,
    tna: 60,
    frequency: 12, // 12 = Mensual
    installments: 12
  });

  // Transformar parámetros al formato que espera el API
  const apiParams = {
    amount: simParams.principal,
    interestRate: simParams.tna,
    termMonths: simParams.installments
  };

  // Simulator: obtener datos del backend
  const { data: simulationData, isLoading: isSimulating } = useQuery({
    queryKey: ['loans.simulation', apiParams],
    queryFn: () => fetchSimulation(apiParams),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Transformar respuesta del API al formato que usa la UI
  const simResults = simulationData ? {
    pmt: simulationData.summary.installmentAmount,
    totalInterest: simulationData.summary.totalInterest,
    totalPayment: simulationData.summary.totalPayable,
    profitPerMonth: simulationData.summary.totalInterest / Math.max(simParams.installments, 1),
    schedule: simulationData.schedule.map((row) => ({
      step: row.installmentNumber,
      pmt: row.scheduledPayment,
      interest: row.interestComponent,
      principalPayment: row.principalComponent,
      balance: row.remainingBalance
    }))
  } : null;

  const { page, setPage, pageSize: limit } = usePaginationStore();
  const { data: loansData, isLoading, isError } = useLoans({ page, limit });

  const mockCreditsList = Array.isArray(loansData?.data?.loans)
    ? loansData.data.loans
    : Array.isArray(loansData?.data)
      ? loansData.data
      : [];
  const pagination = loansData?.data?.pagination || loansData?.meta;

  const getCreditLabel = (credit: any) => {
    if (credit?.Customer?.name) return credit.Customer.name;
    if (credit?.customerName) return credit.customerName;
    return credit?.customerId ?? 'Sin cliente';
  };

  const getAgentLabel = (credit: any) => {
    if (credit?.Agent?.name) return credit.Agent.name;
    if (credit?.agentName) return credit.agentName;
    return credit?.agentId || 'Sin asignar';
  };

  const getLoanStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobado';
      case 'rejected':
        return 'Rechazado';
      case 'defaulted':
        return 'En mora';
      case 'closed':
        return 'Cerrado';
      default:
        return status;
    }
  };

  const getRecoveryStatusLabel = (credit: any) => {
    if (credit?.recoveryStatus === 'overdue' || credit?.status === 'defaulted') return 'En Mora';
    if (credit?.recoveryStatus === 'pending') return 'Pendiente';
    if (credit?.recoveryStatus === 'recovered') return 'Recuperado';
    if (credit?.recoveryStatus) return credit.recoveryStatus;
    return 'Al Día';
  };

  const eventStyleGetter = (event: InstallmentEvent) => {
    let backgroundColor = '#3b82f6'; // pending (blue)
    if (event.type === 'paid') backgroundColor = '#10b981'; // emerald
    if (event.type === 'overdue') backgroundColor = '#ef4444'; // red

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        padding: '2px 4px',
        fontSize: '0.75rem',
        fontWeight: 500
      }
    };
  };

  const CustomEvent = ({ event }: { event: InstallmentEvent }) => (
    <div className="flex flex-col gap-0.5">
      <span className="font-semibold truncate">{event.title}</span>
      <span className="truncate opacity-90">
        ${event.amountToPay.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
      </span>
      {event.arrears > 0 && (
        <span className="truncate font-bold text-red-100">
          + Mora: ${event.arrears.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
        </span>
      )}
    </div>
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Gestión de Créditos</h2>
          <p className="text-sm text-text-secondary mt-1">Módulo central para originación, seguimiento y recuperación de préstamos.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setActiveTab('simulation')} className="flex items-center gap-2 bg-bg-surface border border-border-strong text-text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-hover-bg">
            <Calculator size={16} /> Simular
          </button>
          <button 
            onClick={() => setCurrentView?.('credits-new')}
            className="flex items-center gap-2 bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus size={16} /> Nuevo Crédito
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border-subtle">
        <button 
          onClick={() => setActiveTab('list')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'list' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Préstamos Activos
        </button>
        <button 
          onClick={() => setActiveTab('calendar')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'calendar' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          <CalendarIcon size={16} /> Calendario
        </button>
        <button 
          onClick={() => setActiveTab('simulation')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'simulation' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Simulación
        </button>
        <button 
          onClick={() => setActiveTab('workbench')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'workbench' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          <Calculator size={16} /> Workbench DAG
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="bg-bg-surface rounded-2xl p-5 flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input 
                  type="text" 
                  placeholder="Buscar por cliente o agente..." 
                  className="bg-bg-base text-sm text-text-primary rounded-lg pl-10 pr-4 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-border-strong border border-border-subtle"
                />
              </div>
              <button className="flex items-center gap-2 bg-bg-base border border-border-subtle px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary">
                <Filter size={16} /> Filtrar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-text-secondary border-b border-border-subtle">
                <tr>
                  <th className="pb-3 font-medium">ID Préstamo</th>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Monto</th>
                  <th className="pb-3 font-medium">Tasa (TNA)</th>
                  <th className="pb-3 font-medium">Cuota</th>
                  <th className="pb-3 font-medium">Monto Pendiente</th>
                  <th className="pb-3 font-medium">% Mora</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Estado de Recuperación</th>
                  <th className="pb-3 font-medium">Agente Asignado</th>
                  <th className="pb-3 font-medium">Fecha Creación</th>
                  <th className="pb-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {                isLoading ? (
                  <tr><td colSpan={12} className="py-4 text-center text-text-secondary">Cargando créditos...</td></tr>
                ) : isError ? (
                  <tr><td colSpan={12} className="py-4 text-center text-red-500">Error al cargar créditos.</td></tr>
                ) : mockCreditsList.length === 0 ? (
                  <tr><td colSpan={12} className="py-4 text-center text-text-secondary">No hay créditos registrados.</td></tr>
                ) : (
                  mockCreditsList.map((credit: any) => {
                    // Calculate outstanding amount (principalOutstanding + interestOutstanding)
                    const principalOutstanding = Number(credit.principalOutstanding) || 0;
                    const interestOutstanding = Number(credit.interestOutstanding) || 0;
                    const outstandingAmount = principalOutstanding + interestOutstanding;
                    
                    // Calculate delinquency percentage based on status
                    const isDelinquent = credit.status === 'defaulted' || credit.status === 'overdue' || credit.recoveryStatus === 'overdue';
                    const totalAmount = Number(credit.amount) || 0;
                    const delinquencyPercentage = totalAmount > 0 && isDelinquent 
                      ? (outstandingAmount / totalAmount) * 100 
                      : 0;

                    // Format creation date
                    const creationDate = credit.createdAt 
                      ? format(new Date(credit.createdAt), "dd/MM/yyyy", { locale: es })
                      : '-';

                    return (
                      <tr key={credit.id} className="hover:bg-hover-bg transition-colors">
                        <td className="py-4 text-text-secondary font-mono">{String(credit.id).substring(0, 8)}</td>
                        <td className="py-4 font-medium">{getCreditLabel(credit)}</td>
                        <td className="py-4">{formatCurrency(credit.amount)}</td>
                        <td className="py-4 text-text-secondary">
                          {credit.interestRate ? `${Number(credit.interestRate).toFixed(2)}%` : '-'}
                        </td>
                        <td className="py-4 text-text-secondary">
                          {credit.installmentAmount ? formatCurrency(credit.installmentAmount) : '-'}
                        </td>
                        <td className="py-4">
                          {outstandingAmount > 0 ? (
                            <span className={isDelinquent ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                              {formatCurrency(outstandingAmount)}
                            </span>
                          ) : (
                            <span className="text-text-secondary">-</span>
                          )}
                        </td>
                        <td className="py-4">
                          {delinquencyPercentage > 0 ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              delinquencyPercentage > 50 
                                ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300' 
                                : delinquencyPercentage > 25 
                                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                  : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                            }`}>
                              {delinquencyPercentage.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-text-secondary">0%</span>
                          )}
                        </td>
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded text-xs ${credit.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : credit.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' : 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                            {getLoanStatusLabel(credit.status)}
                          </span>
                        </td>
                        <td className="py-4">
                            <span className={`px-2 py-1 rounded text-xs ${credit.recoveryStatus === 'overdue' || credit.status === 'defaulted' ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                             {getRecoveryStatusLabel(credit)}
                            </span>
                          </td>
                        <td className="py-4 text-text-secondary">{getAgentLabel(credit)}</td>
                        <td className="py-4 text-text-secondary text-xs">{creationDate}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentView?.(`credits/${credit.id}`)} className="p-1.5 text-text-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Ver detalles"><Eye size={16} /></button>
                            <button onClick={() => setActionModal({ isOpen: true, type: 'edit', data: credit })} className="p-1.5 text-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors" title="Editar"><Edit size={16} /></button>
                            <button onClick={() => setActionModal({ isOpen: true, type: 'delete', data: credit })} className="p-1.5 text-text-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {loansData && (
            <div className="mt-4 flex justify-between items-center text-sm text-text-secondary">
              <div>
                Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, pagination?.totalItems ?? pagination?.total ?? 0)} de {pagination?.totalItems ?? pagination?.total ?? 0} créditos
              </div>
              <div className="flex gap-2">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 border border-border-subtle rounded hover:bg-hover-bg disabled:opacity-50"
                >
                  Anterior
                </button>
                <button 
                  disabled={page === (pagination?.totalPages || 1)}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 border border-border-subtle rounded hover:bg-hover-bg disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="bg-bg-surface rounded-2xl p-5 flex-1 flex flex-col min-h-[600px] relative">
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Pagadas
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div> Pendientes
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <div className="w-3 h-3 rounded-full bg-red-500"></div> En Mora
            </div>
          </div>
          <div className="flex-1">
            <Calendar
              localizer={localizer}
              events={myEventsList}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              messages={{
                next: "Sig",
                previous: "Ant",
                today: "Hoy",
                month: "Mes",
                week: "Semana",
                day: "Día"
              }}
              culture='es'
              eventPropGetter={eventStyleGetter}
              components={{
                event: CustomEvent
              }}
              onSelectEvent={(event) => setSelectedEvent(event as InstallmentEvent)}
              className="dark:text-text-primary"
            />
          </div>

          {/* Modal de Detalles del Evento */}
          {selectedEvent && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl p-4">
              <div className="bg-bg-surface w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border-subtle flex flex-col">
                <div className="p-5 border-b border-border-subtle flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">Detalle de Cuota</h3>
                    <p className="text-sm text-text-secondary">{selectedEvent.clientName}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedEvent(null)}
                    className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-5 flex-1 overflow-y-auto">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`p-3 rounded-full ${
                      selectedEvent.type === 'paid' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' :
                      selectedEvent.type === 'overdue' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
                      'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                    }`}>
                      {selectedEvent.type === 'paid' ? <CheckCircle2 size={24} /> :
                       selectedEvent.type === 'overdue' ? <AlertCircle size={24} /> :
                       <Clock size={24} />}
                    </div>
                    <div>
                      <div className="text-sm text-text-secondary">Estado</div>
                      <div className="font-semibold text-lg">
                        {selectedEvent.type === 'paid' ? 'Pagada' :
                         selectedEvent.type === 'overdue' ? 'En Mora' : 'Pendiente'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-bg-base p-3 rounded-xl border border-border-subtle">
                        <div className="text-xs text-text-secondary mb-1">Número de Cuota</div>
                        <div className="font-semibold">{selectedEvent.installmentNumber} de {selectedEvent.totalInstallments}</div>
                      </div>
                      <div className="bg-bg-base p-3 rounded-xl border border-border-subtle">
                        <div className="text-xs text-text-secondary mb-1">Fecha de Vencimiento</div>
                        <div className="font-semibold">{format(selectedEvent.start, "d 'de' MMMM, yyyy", { locale: es })}</div>
                      </div>
                    </div>

                    <div className="bg-bg-base rounded-xl border border-border-subtle overflow-hidden">
                      <div className="p-3 border-b border-border-subtle flex justify-between items-center bg-hover-bg/50">
                        <span className="text-sm font-medium">Cuota a Pagar</span>
                        <span className="font-bold text-lg">{formatCurrency(selectedEvent.amountToPay)}</span>
                      </div>
                      <div className="p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Interés</span>
                          <span>{formatCurrency(selectedEvent.interest)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Capital Amortizado</span>
                          <span>{formatCurrency(selectedEvent.amortizedCapital)}</span>
                        </div>
                        {selectedEvent.arrears > 0 && (
                          <div className="flex justify-between text-red-600 dark:text-red-400 font-medium pt-2 border-t border-border-subtle mt-2">
                            <span>Mora Acumulada</span>
                            <span>{formatCurrency(selectedEvent.arrears)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-bg-base p-3 rounded-xl border border-border-subtle flex justify-between items-center">
                      <span className="text-sm font-medium text-text-secondary">Capital Vivo (Restante)</span>
                      <span className="font-semibold">{formatCurrency(selectedEvent.remainingCapital)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 border-t border-border-subtle bg-bg-base flex gap-3">
                  <button 
                    onClick={() => setSelectedEvent(null)}
                    className="flex-1 px-4 py-2 border border-border-strong rounded-lg text-sm font-medium hover:bg-hover-bg transition-colors"
                  >
                    Cerrar
                  </button>
                  {selectedEvent.type !== 'paid' && (
                    <button className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                      Registrar Pago
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'simulation' && (
        <div className="bg-bg-surface rounded-2xl p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Simulador de Crédito Avanzado</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inputs */}
            <div className="col-span-1 bg-bg-base p-5 rounded-xl border border-border-subtle space-y-4 h-fit">
              <h4 className="font-medium text-text-primary mb-4 border-b border-border-subtle pb-2">Parámetros del Préstamo</h4>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Valor del préstamo</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                  <input
                    type="number"
                    value={simParams.principal}
                    onChange={(e) => setSimParams({...simParams, principal: Number(e.target.value)})}
                    className="w-full bg-bg-surface border border-border-strong rounded-lg pl-8 pr-4 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">TNA (%) - Tasa Nominal Anual</label>
                <div className="relative">
                  <input
                    type="number"
                    value={simParams.tna}
                    onChange={(e) => setSimParams({...simParams, tna: Number(e.target.value)})}
                    className="w-full bg-bg-surface border border-border-strong rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Frecuencia de Pago</label>
                <select
                  value={simParams.frequency}
                  onChange={(e) => setSimParams({...simParams, frequency: Number(e.target.value)})}
                  className="w-full bg-bg-surface border border-border-strong rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={12}>Mensual (12/año)</option>
                  <option value={24}>Quincenal (24/año)</option>
                  <option value={52}>Semanal (52/año)</option>
                  <option value={360}>Diario (360/año)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">N° Total de Cuotas</label>
                <input
                  type="number"
                  value={simParams.installments}
                  onChange={(e) => setSimParams({...simParams, installments: Number(e.target.value)})}
                  className="w-full bg-bg-surface border border-border-strong rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Resumen & Tabla */}
            <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
              {/* Resumen Cards */}
              {isSimulating ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-bg-base p-4 rounded-xl border border-border-subtle animate-pulse">
                      <div className="h-3 bg-border-subtle rounded w-20 mb-2"></div>
                      <div className="h-6 bg-border-subtle rounded w-28"></div>
                    </div>
                  ))}
                </div>
              ) : simResults ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">Cuota a Pagar</div>
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(simResults.pmt)}</div>
                  </div>
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Suma de Cuotas</div>
                    <div className="text-lg font-semibold">{formatCurrency(simResults.totalPayment)}</div>
                  </div>
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Suma de Intereses</div>
                    <div className="text-lg font-semibold">{formatCurrency(simResults.totalInterest)}</div>
                  </div>
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Ganancia por Cuota</div>
                    <div className="text-lg font-semibold">{formatCurrency(simResults.profitPerMonth)}</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Cuota a Pagar</div>
                    <div className="text-lg font-semibold text-text-secondary">-</div>
                  </div>
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Suma de Cuotas</div>
                    <div className="text-lg font-semibold text-text-secondary">-</div>
                  </div>
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Suma de Intereses</div>
                    <div className="text-lg font-semibold text-text-secondary">-</div>
                  </div>
                  <div className="bg-bg-base p-4 rounded-xl border border-border-subtle">
                    <div className="text-xs text-text-secondary mb-1">Ganancia por Cuota</div>
                    <div className="text-lg font-semibold text-text-secondary">-</div>
                  </div>
                </div>
              )}

              {/* Tabla de Amortización */}
              <div className="bg-bg-base rounded-xl border border-border-subtle overflow-hidden flex-1">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="text-xs text-text-secondary bg-bg-surface sticky top-0 shadow-sm">
                      <tr>
                        <th className="py-3 px-4 text-center font-medium">N° Cuota</th>
                        <th className="py-3 px-4 font-medium">Cuota a Pagar</th>
                        <th className="py-3 px-4 font-medium">Interés</th>
                        <th className="py-3 px-4 font-medium">Capital Amort.</th>
                        <th className="py-3 px-4 font-medium">Capital Vivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      <tr className="bg-hover-bg/50">
                        <td className="py-2 px-4 text-center">0</td>
                        <td className="py-2 px-4">-</td>
                        <td className="py-2 px-4">-</td>
                        <td className="py-2 px-4">-</td>
                        <td className="py-2 px-4 font-semibold">{formatCurrency(simParams.principal)}</td>
                      </tr>
                      {isSimulating ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-text-secondary">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              Cargando simulación...
                            </div>
                          </td>
                        </tr>
                      ) : simResults && simResults.schedule.length > 0 ? (
                        simResults.schedule.map((row) => (
                          <tr key={row.step} className="hover:bg-hover-bg transition-colors">
                            <td className="py-2 px-4 text-center">{row.step}</td>
                            <td className="py-2 px-4 font-medium text-blue-600 dark:text-blue-400">{formatCurrency(row.pmt)}</td>
                            <td className="py-2 px-4 text-amber-600 dark:text-amber-400">{formatCurrency(row.interest)}</td>
                            <td className="py-2 px-4 text-emerald-600 dark:text-emerald-400">{formatCurrency(row.principalPayment)}</td>
                            <td className="py-2 px-4 font-medium">{formatCurrency(row.balance)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-text-secondary">
                            Ajusta los parámetros para ver la simulación
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'workbench' && (
        <div className="bg-bg-surface rounded-2xl flex-1 flex flex-col min-h-[800px] overflow-hidden -mx-4 sm:mx-0 shadow-lg border border-border-subtle">
          <DAGWorkbench />
        </div>
      )}

      {/* Action Modals */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-surface w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-border-subtle flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border-subtle flex justify-between items-center">
              <h3 className="text-lg font-semibold text-text-primary">
                {actionModal.type === 'create' ? 'Crear Nuevo Crédito' :
                 actionModal.type === 'view' ? 'Detalles del Crédito' :
                 actionModal.type === 'edit' ? 'Editar Crédito' : 'Eliminar Crédito'}
              </h3>
              <button
                onClick={() => setActionModal({ isOpen: false, type: 'view', data: null })}
                className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              {actionModal.type === 'delete' ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={24} />
                  </div>
                  <h4 className="text-lg font-medium mb-2">¿Estás seguro?</h4>
                  <p className="text-text-secondary mb-6">
                     Esta acción eliminará permanentemente el crédito <strong>{actionModal.data?.id}</strong> de {getCreditLabel(actionModal.data)}. Esta acción no se puede deshacer.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setActionModal({ isOpen: false, type: 'view', data: null })} className="flex-1 px-4 py-2 border border-border-strong rounded-lg font-medium hover:bg-hover-bg">Cancelar</button>
                    <button onClick={() => setActionModal({ isOpen: false, type: 'view', data: null })} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">Eliminar</button>
                  </div>
                </div>
              ) : actionModal.type === 'view' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-text-secondary">ID Préstamo</label>
                      <div className="font-medium">{actionModal.data?.id}</div>
                    </div>
                    <div>
                      <label className="text-xs text-text-secondary">Cliente</label>
                      <div className="font-medium">{getCreditLabel(actionModal.data)}</div>
                    </div>
                    <div>
                      <label className="text-xs text-text-secondary">Monto</label>
                      <div className="font-medium">{formatCurrency(actionModal.data?.amount || 0)}</div>
                    </div>
                    <div>
                      <label className="text-xs text-text-secondary">Estado</label>
                      <div>
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">{actionModal.data?.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-border-subtle flex justify-end">
                    <button onClick={() => setActionModal({ isOpen: false, type: 'view', data: null })} className="px-4 py-2 bg-bg-base border border-border-strong rounded-lg font-medium hover:bg-hover-bg">Cerrar</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Cliente</label>
                    <input type="text" defaultValue={getCreditLabel(actionModal.data) || ''} className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Nombre del cliente" />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Monto del Préstamo</label>
                    <input type="number" defaultValue={actionModal.data?.amount || ''} className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Ej. 5000000" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">Tasa (TNA %)</label>
                      <input type="number" defaultValue={60} className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">Cuotas</label>
                      <input type="number" defaultValue={12} className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-border-subtle flex justify-end gap-3">
                    <button onClick={() => setActionModal({ isOpen: false, type: 'view', data: null })} className="px-4 py-2 bg-bg-base border border-border-strong rounded-lg font-medium hover:bg-hover-bg">Cancelar</button>
                    <button onClick={() => setActionModal({ isOpen: false, type: 'view', data: null })} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                      {actionModal.type === 'create' ? 'Crear Crédito' : 'Guardar Cambios'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
