import { useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, RotateCcw } from 'lucide-react';
import { formatDate as formatDateValue } from '../i18n/format';
import { useCustomers } from '../services/customerService';
import { usePaginationStore } from '../store/paginationStore';
import { toast } from '../lib/toast';
import { tTerm } from '../i18n/terminology';
import { confirmDanger } from '../lib/confirmModal';
import { reportClientError } from '../lib/clientDiagnostics';
import { useSessionStore } from '../store/sessionStore';
import { PERMISSION } from '../constants/permissionNames';
import { normalizeVisibleName } from '../lib/displayNames';
import { useResolvedPermissionNames } from '../services/permissionsService';
import {
  AppTable,
  RowActionsWithOverflow,
  type RowActionOverflowItem,
  TableActionsCell,
  TableActionsHeader,
} from './shared/tables';
import { ActionButton, FormField, PageHeader, PageShell, SelectInput, TextInput, ToolbarSurface } from './shared/Surfaces';
import { HelpLabel } from './shared/HelpSupport';

export default function Customers({ setCurrentView }: { setCurrentView?: (v: string) => void }) {
  const { user } = useSessionStore();
  const resolvedPermissions = useResolvedPermissionNames(user);
  const { page, pageSize, setPage, setPageSize } = usePaginationStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const permissionSet = new Set(resolvedPermissions.map((permission) => permission.toUpperCase()));
  const hasPermission = (permission: string) => user?.role === 'admin' || permissionSet.has('*') || permissionSet.has(permission);
  const canCreateCustomers = hasPermission(PERMISSION.CLIENTS_CREATE);
  const canUpdateCustomers = hasPermission(PERMISSION.CLIENTS_UPDATE);
  const canDeleteCustomers = hasPermission(PERMISSION.CLIENTS_DELETE);

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

  const formatCreatedAt = (value: unknown) => {
    if (!value) return tTerm('common.notAvailable');

    return formatDateValue(value) || tTerm('common.notAvailable');
  };

  const getCustomerName = (customer: any) => {
    let name = normalizeVisibleName(customer?.name);
    if (!name) {
      name = normalizeVisibleName([customer?.firstName, customer?.lastName].filter(Boolean).join(' '));
    }
    name = name || normalizeVisibleName(customer?.email);
    return name || tTerm('customerDetails.fallback.customerName');
  };

  const handleDelete = async (customer: any) => {
    if (!canDeleteCustomers) {
      toast.apiErrorSafe(new Error(tTerm('customers.permission.deleteDenied')), { domain: 'customers' });
      return;
    }

    const customerId = Number(customer?.id);
    if (!Number.isFinite(customerId)) return;

    const confirmed = await confirmDanger({
      title: tTerm('customers.confirm.delete.title'),
      message: tTerm('customers.confirm.delete.message', { name: getCustomerName(customer) }),
      confirmLabel: tTerm('customers.action.delete'),
    });
    if (!confirmed) return;

    try {
      await deleteCustomer.mutateAsync(customerId);
      toast.success({ description: tTerm('customers.toast.delete.success') });
    } catch (error) {
      reportClientError('customers.delete', error);
      toast.apiErrorSafe(error, { domain: 'customers' });
    }
  };

  const handleToggleStatus = async (customer: any) => {
    if (!canUpdateCustomers) {
      toast.apiErrorSafe(new Error(tTerm('customers.permission.statusDenied')), { domain: 'customers' });
      return;
    }

    const customerId = Number(customer?.id);
    if (!Number.isFinite(customerId)) return;

    const currentStatus = String(customer?.status || '').toLowerCase();
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const actionLabel = currentStatus === 'active'
      ? tTerm('customers.action.deactivate')
      : currentStatus === 'blacklisted'
        ? tTerm('customers.action.unblock')
        : tTerm('customers.cta.restore');

    const confirmed = await confirmDanger({
      title: nextStatus === 'inactive'
        ? tTerm('customers.confirm.deactivate.title')
        : currentStatus === 'blacklisted'
          ? tTerm('customers.confirm.unblock.title')
          : tTerm('customers.confirm.restore.title'),
      message: nextStatus === 'inactive'
        ? tTerm('customers.confirm.deactivate.message', { name: getCustomerName(customer) })
        : currentStatus === 'blacklisted'
          ? tTerm('customers.confirm.unblock.message', { name: getCustomerName(customer) })
          : tTerm('customers.confirm.restore.message', { name: getCustomerName(customer) }),
      confirmLabel: nextStatus === 'inactive' ? tTerm('customers.action.deactivate') : actionLabel,
    });
    if (!confirmed) return;

    try {
      await updateCustomer.mutateAsync({ id: customerId, status: nextStatus });
      toast.success({
        description: nextStatus === 'inactive'
          ? tTerm('customers.toast.deactivate.success')
          : tTerm('customers.toast.restore.success'),
      });
    } catch (error) {
      reportClientError('customers.statusUpdate', error);
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
          <div className="grid items-start gap-3 lg:grid-cols-[minmax(18rem,26rem)_14rem_14rem]">
            <FormField label={tTerm('customers.filter.search.label')} data-tour="customers-search">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <TextInput
                  type="text"
                  placeholder={tTerm('customers.filter.search.placeholder')}
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  className="pl-10"
                />
              </div>
            </FormField>
            <FormField label={tTerm('customers.filter.status.label')} tooltip={tTerm('customers.filter.status.tooltip')}>
              <SelectInput
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="all">{tTerm('customers.filter.status.all')}</option>
                <option value="active">{tTerm('common.status.active')}</option>
                <option value="inactive">{tTerm('common.status.inactive')}</option>
                <option value="blacklisted">{tTerm('common.status.blacklisted')}</option>
              </SelectInput>
            </FormField>
            <FormField label={tTerm('customers.filter.registered.label')} tooltip={tTerm('customers.filter.registered.tooltip')}>
              <SelectInput
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              >
                <option value="all">{tTerm('customers.filter.registered.all')}</option>
                <option value="today">{tTerm('customers.filter.registered.today')}</option>
                <option value="week">{tTerm('customers.filter.registered.week')}</option>
                <option value="month">{tTerm('customers.filter.registered.month')}</option>
                <option value="year">{tTerm('customers.filter.registered.year')}</option>
              </SelectInput>
            </FormField>
          </div>
        </ToolbarSurface>

        <AppTable variant="operational"
          data-tour="customers-table"
          isLoading={isLoading}
          isError={isError}
          hasData={customers.length > 0}
          loadingContent={
            <div className="flex items-center justify-center h-64 text-text-secondary">
              {tTerm('customers.state.loading')}
            </div>
          }
          errorContent={<div className="flex items-center justify-center h-64 text-red-500">{tTerm('customers.state.error')}</div>}
          emptyContent={
            <div className="flex flex-col items-center justify-center h-64 text-text-secondary">
              <p>{tTerm('customers.state.empty')}</p>
            </div>
          }
          recordsLabel={tTerm('customers.table.recordsLabel')}
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
            <thead>
                <tr>
                  <th className="pb-3 font-medium">{tTerm('customers.table.name')}</th>
                  <th className="pb-3 font-medium">{tTerm('customers.table.contact')}</th>
                  <th className="pb-3 font-medium">
                    <HelpLabel
                      label={tTerm('customers.table.status')}
                      text={tTerm('customers.table.statusHelp')}
                    />
                  </th>
                  <th className="pb-3 font-medium">{tTerm('customers.table.registered')}</th>
                  <TableActionsHeader className="pb-3 font-medium">{tTerm('customers.table.actions')}</TableActionsHeader>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer: any) => (
                  <tr key={customer.id} className="hover:bg-hover-bg transition-colors">
                    <td className="py-4 font-medium flex items-center gap-3">
                      <img src={`https://i.pravatar.cc/150?u=${customer.id}`} className="size-8 rounded-full" alt={tTerm('customers.table.avatarAlt')} />
                      {getCustomerName(customer)}
                    </td>
                    <td className="py-4 text-text-secondary">{customer.email}</td>
                    <td className="py-4 align-middle">
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
                    <td className="py-4 align-middle text-text-secondary">{formatCreatedAt(customer?.createdAt)}</td>
                    <TableActionsCell className="py-4 align-middle">
                      {(() => {
                        const items: RowActionOverflowItem[] = [
                          {
                            id: 'view',
                            label: tTerm('customers.action.viewDetails'),
                            icon: <Eye size={16} />,
                            onClick: () => setCurrentView && setCurrentView(`customers/${customer.id}`),
                          },
                        ];
                        if (canUpdateCustomers) {
                          items.push(
                            {
                              id: 'edit',
                              label: tTerm('customers.action.edit'),
                              icon: <Edit size={16} />,
                              onClick: () => setCurrentView && setCurrentView(`customers/${customer.id}/edit`),
                            },
                            {
                              id: 'status',
                              label: customer.status === 'active'
                                ? tTerm('customers.action.deactivate')
                                : customer.status === 'blacklisted'
                                  ? tTerm('customers.action.unblock')
                                  : tTerm('customers.cta.restore'),
                              icon: <RotateCcw size={16} />,
                              onClick: () => { void handleToggleStatus(customer); },
                            },
                          );
                        }
                        if (canDeleteCustomers) {
                          items.push({
                            id: 'delete',
                            label: tTerm('customers.action.delete'),
                            icon: <Trash2 size={16} />,
                            onClick: () => { void handleDelete(customer); },
                            iconVariant: 'danger',
                            menuTone: 'danger',
                          });
                        }
                        return (
                          <RowActionsWithOverflow
                            variant="icon"
                            align="center"
                            items={items}
                            ariaLabel={tTerm('customers.table.actions')}
                          />
                        );
                      })()}
                    </TableActionsCell>
                  </tr>
                ))}
              </tbody>
        </AppTable>
      </div>
    </PageShell>
  );
}
