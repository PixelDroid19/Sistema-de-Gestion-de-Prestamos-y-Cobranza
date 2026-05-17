import { useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, RotateCcw } from 'lucide-react';
import { formatDate as formatDateValue } from '../i18n/format';
import { useCustomers } from '../services/customerService';
import { usePaginationStore } from '../store/paginationStore';
import { toast } from '../lib/toast';
import { tTerm } from '../i18n/terminology';
import { confirmDanger } from '../lib/confirmModal';
import { useSessionStore } from '../store/sessionStore';
import TableShell from './shared/TableShell';
import { ActionButton, FormField, PageHeader, PageShell, SelectInput, TextInput, ToolbarSurface } from './shared/Surfaces';
import { HelpLabel } from './shared/HelpSupport';

export default function Customers({ setCurrentView }: { setCurrentView?: (v: string) => void }) {
  const { user } = useSessionStore();
  const { page, pageSize, setPage, setPageSize } = usePaginationStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const permissionSet = new Set((user?.permissions || []).map((permission) => permission.toUpperCase()));
  const hasPermission = (permission: string) => user?.role === 'admin' || permissionSet.has('*') || permissionSet.has(permission);
  const canCreateCustomers = hasPermission('CLIENTS_CREATE');
  const canUpdateCustomers = hasPermission('CLIENTS_UPDATE');
  const canDeleteCustomers = hasPermission('CLIENTS_DELETE');

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

    return formatDateValue(value) || 'N/A';
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
    return name || tTerm('credits.label.customerFallback', { id: customer?.id || 'N/A' });
  };

  const handleDelete = async (customer: any) => {
    if (!canDeleteCustomers) {
      toast.apiErrorSafe(new Error('No tiene permiso para eliminar clientes.'), { domain: 'customers' });
      return;
    }

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
    if (!canUpdateCustomers) {
      toast.apiErrorSafe(new Error('No tiene permiso para cambiar el estado de clientes.'), { domain: 'customers' });
      return;
    }

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
    <PageShell className="h-full" data-tour="customers-page">
      <PageHeader
        title={tTerm('customers.module.title')}
        subtitle={tTerm('customers.module.subtitle')}
        guideKey="customers"
        tourId="customers-header"
        actions={canCreateCustomers ? (
          <ActionButton
            onClick={() => setCurrentView && setCurrentView('customers-new')}
            icon={<Plus size={16} />}
            variant="primary"
          >
            {tTerm('customers.cta.new')}
          </ActionButton>
        ) : undefined}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <ToolbarSurface data-tour="customers-filters">
          <div className="grid gap-3 md:grid-cols-[minmax(18rem,1fr)_14rem_14rem]">
            <FormField label="Buscar cliente" className="md:max-w-xl" data-tour="customers-search">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <TextInput
                  type="text"
                  placeholder="Buscar por nombre, correo o documento…"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  className="pl-10"
                />
              </div>
            </FormField>
            <FormField label="Estado" tooltip="Filtra la lista por estado operativo del cliente.">
              <SelectInput
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="all">Todos los estados</option>
                <option value="active">{tTerm('common.status.active')}</option>
                <option value="inactive">{tTerm('common.status.inactive')}</option>
                <option value="blacklisted">{tTerm('common.status.blacklisted')}</option>
              </SelectInput>
            </FormField>
            <FormField label="Registro" tooltip="Acota clientes por fecha de alta en la plataforma.">
              <SelectInput
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              >
                <option value="all">Todo el tiempo</option>
                <option value="today">Hoy</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mes</option>
                <option value="year">Este año</option>
              </SelectInput>
            </FormField>
          </div>
        </ToolbarSurface>

        <TableShell
          data-tour="customers-table"
          isLoading={isLoading}
          isError={isError}
          hasData={customers.length > 0}
          loadingContent={
            <div className="flex items-center justify-center h-64 text-text-secondary">
              Cargando clientes…
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
          className="data-table-surface"
        >
            <table className="min-w-[760px] w-full text-sm text-left">
              <thead className="text-xs text-text-secondary border-b border-border-subtle">
                <tr>
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Nombre</th>
                  <th className="pb-3 font-medium">Contacto</th>
                  <th className="pb-3 font-medium">
                    <HelpLabel
                      label="Estado"
                      text="Estado del perfil del cliente. Activo permite operar normalmente; inactivo o bloqueado restringe nuevas gestiones según la política."
                    />
                  </th>
                  <th className="pb-3 font-medium">Registrado</th>
                  <th className="pb-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {customers.map((customer: any) => (
                  <tr key={customer.id} className="hover:bg-hover-bg transition-colors">
                    <td className="py-4 text-text-secondary">{formatCustomerId(customer?.id)}</td>
                    <td className="py-4 font-medium flex items-center gap-3">
                      <img src={`https://i.pravatar.cc/150?u=${customer.id}`} className="size-8 rounded-full" alt="avatar" />
                      {getCustomerName(customer)}
                    </td>
                    <td className="py-4 text-text-secondary">{customer.email}</td>
                    <td className="py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        customer.status === 'active'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                          : customer.status === 'blacklisted'
                            ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-300'
                      }`}>
                        {customer.status === 'active'
                          ? tTerm('common.status.active')
                          : customer.status === 'blacklisted'
                            ? tTerm('common.status.blacklisted')
                            : tTerm('common.status.inactive')}
                      </span>
                    </td>
                    <td className="py-4 text-text-secondary">{formatCreatedAt(customer?.createdAt)}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <ActionButton
                          onClick={() => setCurrentView && setCurrentView(`customers/${customer.id}`)}
                          icon={<Eye size={16} />}
                          variant="ghost"
                          className="h-9 w-9 !min-h-0 !p-0"
                          title="Ver detalles"
                        >
                          <span className="sr-only">Ver detalles</span>
                        </ActionButton>
                        {canUpdateCustomers && (
                          <>
                            <ActionButton
                              onClick={() => setCurrentView && setCurrentView(`customers/${customer.id}/edit`)}
                              icon={<Edit size={16} />}
                              variant="ghost"
                              className="h-9 w-9 !min-h-0 !p-0"
                              title="Editar"
                            >
                              <span className="sr-only">Editar</span>
                            </ActionButton>
                            <ActionButton
                              onClick={() => handleToggleStatus(customer)}
                              icon={<RotateCcw size={16} />}
                              variant="ghost"
                              className="h-9 w-9 !min-h-0 !p-0"
                              title={customer.status === 'active' ? 'Desactivar' : customer.status === 'blacklisted' ? 'Quitar bloqueo' : tTerm('customers.cta.restore')}
                            >
                              <span className="sr-only">{customer.status === 'active' ? 'Desactivar' : customer.status === 'blacklisted' ? 'Quitar bloqueo' : tTerm('customers.cta.restore')}</span>
                            </ActionButton>
                          </>
                        )}
                        {canDeleteCustomers && (
                          <ActionButton
                            onClick={() => handleDelete(customer)}
                            icon={<Trash2 size={16} />}
                            variant="danger"
                            className="h-9 w-9 !min-h-0 !p-0"
                            title="Eliminar"
                          >
                            <span className="sr-only">Eliminar</span>
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </TableShell>
      </div>
    </PageShell>
  );
}
