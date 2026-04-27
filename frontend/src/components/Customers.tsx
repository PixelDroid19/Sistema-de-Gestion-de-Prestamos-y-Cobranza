import { useState } from 'react';
import { Plus, Search, Filter, Calendar, Eye, Edit, Trash2, RotateCcw } from 'lucide-react';
import { useCustomers } from '../services/customerService';
import { usePaginationStore } from '../store/paginationStore';
import { toast } from '../lib/toast';
import { tTerm } from '../i18n/terminology';
import { confirmDanger } from '../lib/confirmModal';
import TableShell from './shared/TableShell';

export default function Customers({ setCurrentView }: { setCurrentView?: (v: string) => void }) {
  const { page, pageSize, setPage, setPageSize } = usePaginationStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const { data, isLoading, isError, updateCustomer, deleteCustomer } = useCustomers({
    page,
    pageSize,
    search: searchTerm || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    registeredWithin: dateFilter !== 'all' ? dateFilter : undefined,
  });

  const customers = Array.isArray(data?.data?.customers)
    ? data.data.customers
    : Array.isArray(data?.data)
      ? data.data
      : [];
  const pagination = data?.data?.pagination || data?.meta;
  const totalPages = pagination?.totalPages || 1;
  const totalItems = pagination?.totalItems || pagination?.total || customers.length;

  const formatCustomerId = (value: unknown) => {
    const rawId = value == null ? '' : String(value);
    return rawId ? `CUS-${rawId.slice(0, 8)}` : 'CUS-N/A';
  };

  const formatCreatedAt = (value: unknown) => {
    if (!value) return 'N/A';

    const parsedDate = new Date(value as string | number | Date);
    return Number.isNaN(parsedDate.getTime()) ? 'N/A' : parsedDate.toLocaleDateString();
  };

  const getCustomerName = (customer: any) => {
    let name = customer?.name || '';
    if (!name) {
      name = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim();
    }
    name = name || customer?.email || '';
    if (name) {
      name = name.replace(/(qa|seed|test|dev)\s*/ig, '').trim();
    }
    return name || `Cliente #${customer?.id || 'N/A'}`;
  };

  const handleDelete = async (customer: any) => {
    const customerId = Number(customer?.id);
    if (!Number.isFinite(customerId)) return;

    const confirmed = await confirmDanger({
      title: 'Eliminar cliente',
      message: `¿Está seguro de eliminar a ${getCustomerName(customer)}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      await deleteCustomer.mutateAsync(customerId);
      toast.success({ description: 'Cliente eliminado correctamente' });
    } catch (error) {
      console.error('[customers] deleteCustomer failed', error);
      toast.apiErrorSafe(error, { domain: 'customers' });
    }
  };

  const handleToggleStatus = async (customer: any) => {
    const customerId = Number(customer?.id);
    if (!Number.isFinite(customerId)) return;

    const currentStatus = String(customer?.status || '').toLowerCase();
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const actionLabel = currentStatus === 'active'
      ? 'Desactivar'
      : currentStatus === 'blacklisted'
        ? 'Quitar bloqueo'
        : 'Reactivar';

    const confirmed = await confirmDanger({
      title: nextStatus === 'inactive' ? 'Desactivar cliente' : actionLabel === 'Quitar bloqueo' ? 'Quitar bloqueo del cliente' : 'Reactivar cliente',
      message: nextStatus === 'inactive'
        ? `¿Desea desactivar a ${getCustomerName(customer)}?`
        : actionLabel === 'Quitar bloqueo'
          ? `¿Desea quitar el bloqueo de ${getCustomerName(customer)} y dejarlo activo?`
          : `¿Desea reactivar a ${getCustomerName(customer)}?`,
      confirmLabel: nextStatus === 'inactive' ? 'Desactivar' : actionLabel,
    });
    if (!confirmed) return;

    try {
      await updateCustomer.mutateAsync({ id: customerId, status: nextStatus });
      toast.success({
        description: nextStatus === 'inactive'
          ? 'Cliente desactivado correctamente'
          : 'Cliente reactivado correctamente',
      });
    } catch (error) {
      console.error('[customers] updateCustomer status failed', error);
      toast.apiErrorSafe(error, { domain: 'customers' });
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">{tTerm('customers.module.title')}</h2>
          <p className="text-sm text-text-secondary mt-1">{tTerm('customers.module.subtitle')}</p>
        </div>
        <button 
          onClick={() => setCurrentView && setCurrentView('customers-new')}
          className="flex items-center gap-2 bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> {tTerm('customers.cta.new')}
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex flex-col items-start justify-between gap-4 border-y border-border-subtle bg-bg-surface/60 py-4 sm:flex-row sm:items-center">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input 
              type="text" 
              placeholder="Buscar por nombre, correo o documento..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="bg-bg-base text-sm text-text-primary rounded-lg pl-10 pr-4 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-border-strong border border-border-subtle"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-bg-base border border-border-subtle rounded-lg px-3 py-2" title="Filtra la lista por estado del cliente">
              <Filter size={14} className="text-text-secondary" />
              <select 
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="bg-transparent text-sm text-text-secondary focus:outline-none cursor-pointer appearance-none pr-4"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="blacklisted">Bloqueado</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-bg-base border border-border-subtle rounded-lg px-3 py-2" title="Acota clientes por fecha de registro">
              <Calendar size={14} className="text-text-secondary" />
              <select 
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                className="bg-transparent text-sm text-text-secondary focus:outline-none cursor-pointer appearance-none pr-4"
              >
                <option value="all">Todo el tiempo</option>
                <option value="today">Hoy</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mes</option>
                <option value="year">Este año</option>
              </select>
            </div>
          </div>
        </div>

        <TableShell
          isLoading={isLoading}
          isError={isError}
          hasData={customers.length > 0}
          loadingContent={
            <div className="flex items-center justify-center h-64 text-text-secondary">
              Cargando clientes...
            </div>
          }
          errorContent={<div className="flex items-center justify-center h-64 text-red-500">Error al cargar los clientes.</div>}
          emptyContent={
            <div className="flex flex-col items-center justify-center h-64 text-text-secondary">
              <p>No se encontraron clientes con esos filtros.</p>
            </div>
          }
          recordsLabel="registros"
          pagination={{
            page,
            pageSize,
            totalItems,
            totalPages,
            onPrev: () => setPage(Math.max(1, page - 1)),
            onNext: () => setPage(Math.min(totalPages, page + 1)),
            onPageSizeChange: (nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            },
          }}
        >
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-text-secondary border-b border-border-subtle">
                <tr>
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Nombre</th>
                  <th className="pb-3 font-medium">Contacto</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Registrado</th>
                  <th className="pb-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {customers.map((customer: any) => (
                  <tr key={customer.id} className="hover:bg-hover-bg transition-colors">
                    <td className="py-4 text-text-secondary">{formatCustomerId(customer?.id)}</td>
                    <td className="py-4 font-medium flex items-center gap-3">
                      <img src={`https://i.pravatar.cc/150?u=${customer.id}`} className="w-8 h-8 rounded-full" alt="avatar" />
                      {getCustomerName(customer)}
                    </td>
                    <td className="py-4 text-text-secondary">{customer.email}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        customer.status === 'active'
                          ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : customer.status === 'blacklisted'
                            ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-300'
                      }`}>
                        {customer.status === 'active' ? 'Activo' : customer.status === 'blacklisted' ? 'Bloqueado' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-4 text-text-secondary">{formatCreatedAt(customer?.createdAt)}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentView && setCurrentView(`customers/${customer.id}`)} className="p-1.5 text-text-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Ver detalles"><Eye size={16} /></button>
                        <button
                          onClick={() => setCurrentView && setCurrentView(`customers/${customer.id}/edit`)}
                          className="p-1.5 text-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(customer)}
                          className="p-1.5 text-text-secondary hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors" 
                          title={customer.status === 'active' ? 'Desactivar' : customer.status === 'blacklisted' ? 'Quitar bloqueo' : tTerm('customers.cta.restore')}
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(customer)}
                          className="p-1.5 text-text-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </TableShell>
      </div>
    </div>
  );
}
