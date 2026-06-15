import React, { useEffect, useMemo, useState } from 'react';
import { PencilLine, Search, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatDate as formatDateValue } from '../../i18n/format';
import { useUsers } from '../../services/userService';
import { toast } from '../../lib/toast';
import { confirmDanger } from '../../lib/confirmModal';
import { reportClientError } from '../../lib/clientDiagnostics';
import {
  ActionButton,
  FormField,
  InsightStrip,
  AppInput,
  ModalShell,
  SectionSurface,
} from '../shared/Surfaces';
import {
  AppTable,
  RowActionsWithOverflow,
  type RowActionOverflowItem,
  TableActionsCell,
  TableActionsHeader,
} from '../shared/tables';
import EmployeeEditModal from '../EmployeeEditModal';
import { StatusBadge } from './StatusBadge';
import type { EmployeeDraft } from './settingsHelpers';

export default function EmployeesTab() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data: usersData, registerWithPermissions, deactivateUser, reactivateUser } = useUsers({
    page,
    pageSize,
    role: 'employee',
    ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
  });
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft>({
    name: '',
    email: '',
    password: '',
  });
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [isCreateEmployeeModalOpen, setIsCreateEmployeeModalOpen] = useState(false);

  const users = Array.isArray(usersData?.data?.users)
    ? usersData.data.users
    : Array.isArray(usersData?.data)
      ? usersData.data
      : [];
  const employees = users.filter((user: any) => user?.role === 'employee');
  const employeesSummary = usersData?.data?.summary;
  const employeesPagination = usersData?.data?.pagination;
  const activeEmployeesCount = Number(employeesSummary?.activeUsers ?? employees.filter((employee: any) => employee?.isActive !== false).length);
  const inactiveEmployeesCount = Number(employeesSummary?.inactiveUsers ?? employees.filter((employee: any) => employee?.isActive === false).length);
  const totalEmployeesCount = Number(employeesSummary?.totalUsers ?? employees.length);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (employeesPagination?.totalPages && page > employeesPagination.totalPages) {
      setPage(employeesPagination.totalPages);
    }
  }, [employeesPagination?.totalPages, page]);

  const tablePagination = useMemo(() => {
    if (!employeesPagination) {
      return undefined;
    }

    const totalPages = Math.max(employeesPagination.totalPages || 0, 1);
    return {
      page: employeesPagination.page,
      pageSize: employeesPagination.pageSize,
      totalItems: employeesPagination.totalItems,
      totalPages,
      onPrev: () => setPage((current) => Math.max(1, current - 1)),
      onNext: () => setPage((current) => Math.min(totalPages, current + 1)),
      onPageSizeChange: (nextPageSize: number) => {
        setPageSize(nextPageSize);
        setPage(1);
      },
      pageSizeOptions: [10, 25, 50],
    };
  }, [employeesPagination]);

  const handleToggleEmployeeStatus = async (employee: any) => {
    const isActive = employee?.isActive !== false;
    const employeeLabel = employee?.name || employee?.email || t('settings.employees.table.nameMissing');

    if (isActive) {
      const confirmed = await confirmDanger({
        title: t('errors.deactivateConfirmTitle'),
        message: t('errors.deactivateConfirmBody', { name: employeeLabel }),
        confirmLabel: t('errors.deactivateConfirmAction'),
      });
      if (!confirmed) return;
    }

    try {
      if (isActive) {
        await deactivateUser.mutateAsync(Number(employee.id));
        toast.success({ description: t('errors.employeeDeactivated') });
        return;
      }

      await reactivateUser.mutateAsync(Number(employee.id));
      toast.success({ description: t('errors.employeeReactivated') });
    } catch (error) {
      reportClientError('settings.employee.statusToggle', error);
      toast.apiErrorSafe(error, { domain: 'users', action: 'generic' });
    }
  };

  const handleCreateEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = employeeDraft.name.trim();
    const email = employeeDraft.email.trim().toLowerCase();
    const password = employeeDraft.password;

    if (!name) {
      toast.error({ description: t('errors.employeeNameRequired') });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
      toast.error({ description: t('errors.employeeEmailInvalid') });
      return;
    }

    if (password.length < 8) {
      toast.error({ description: t('errors.employeePasswordShort') });
      return;
    }

    try {
      await registerWithPermissions.mutateAsync({
        name,
        email,
        password,
        role: 'employee',
        permissions: [],
      });
      setEmployeeDraft({ name: '', email: '', password: '' });
      setIsCreateEmployeeModalOpen(false);
      toast.success({ description: t('errors.employeeCreated') });
    } catch (error) {
      reportClientError('settings.employee.create', error);
      toast.apiErrorSafe(error, { domain: 'users', action: 'generic' });
    }
  };

  const createEmployeeForm = (
    <form id="employee-create-form" onSubmit={handleCreateEmployee} aria-label={t('settings.employees.create.modalTitle')} className="space-y-4">
      <FormField
        label={t('settings.employees.create.nameLabel')}
        tooltip={t('settings.employees.create.nameTooltip')}
      >
        <AppInput
          aria-label={t('settings.employees.create.nameLabel')}
          variant="text"
          required
          value={employeeDraft.name}
          onValueChange={(v, _detail, e) => setEmployeeDraft((previous) => ({ ...previous, name: v }))}
          placeholder={t('settings.employees.create.namePlaceholder')}
        />
      </FormField>
      <FormField
        label={t('settings.employees.create.emailLabel')}
        tooltip={t('settings.employees.create.emailTooltip')}
      >
        <AppInput
          aria-label={t('settings.employees.create.emailLabel')}
          variant="email"
          required
          value={employeeDraft.email}
          onValueChange={(v, _detail, e) => setEmployeeDraft((previous) => ({ ...previous, email: v }))}
          placeholder={t('settings.employees.create.emailPlaceholder')}
        />
      </FormField>
      <FormField
        label={t('settings.employees.create.passwordLabel')}
        tooltip={t('settings.employees.create.passwordTooltip')}
      >
        <AppInput
          aria-label={t('settings.employees.create.passwordLabel')}
          variant="text"
          type="password"
          minLength={8}
          value={employeeDraft.password}
          onValueChange={(v, _detail, e) => setEmployeeDraft((previous) => ({ ...previous, password: v }))}
          placeholder={t('settings.employees.create.passwordPlaceholder')}
        />
      </FormField>
    </form>
  );

  return (
    <div className="space-y-5">
      <InsightStrip
        aria-label={t('settings.employees.summary.total')}
        items={[
          {
            id: 'settings-employees-total',
            label: t('settings.employees.summary.total'),
            value: totalEmployeesCount,
            helper: t('settings.employees.summary.totalHelper'),
            icon: <UserPlus size={18} />,
            accent: 'slate',
          },
          {
            id: 'settings-employees-active',
            label: t('settings.employees.summary.active'),
            value: activeEmployeesCount,
            helper: t('settings.employees.summary.activeHelper'),
            icon: <UserCheck size={18} />,
            accent: 'emerald',
          },
          {
            id: 'settings-employees-inactive',
            label: t('settings.employees.summary.inactive'),
            value: inactiveEmployeesCount,
            helper: t('settings.employees.summary.inactiveHelper'),
            icon: <UserX size={18} />,
            accent: 'rose',
          },
        ]}
      />

      <SectionSurface
        title={t('settings.employees.create.sectionTitle')}
        subtitle={t('settings.employees.create.sectionSubtitle')}
        actions={(
          <ActionButton
            type="button"
            variant="primary"
            icon={<UserPlus size={16} />}
            onClick={() => setIsCreateEmployeeModalOpen(true)}
          >
            {t('settings.employees.create.submit')}
          </ActionButton>
        )}
      >
        <p className="settings-inline-note">
          {t('settings.employees.create.note')}
        </p>
      </SectionSurface>

      <SectionSurface
        title={t('settings.employees.table.title')}
        subtitle={t('settings.employees.table.subtitle')}
      >
        <div className="mb-4 max-w-xl">
          <FormField label={t('settings.employees.filters.searchLabel')}>
            <AppInput
              aria-label={t('settings.employees.filters.searchLabel')}
              variant="text"
              value={searchTerm}
              onValueChange={(value) => setSearchTerm(value)}
              placeholder={t('settings.employees.filters.searchPlaceholder')}
              icon={<Search size={16} />}
            />
          </FormField>
        </div>

      <AppTable variant="operational"
        minWidthClassName="min-w-[760px]"
        data-tour="settings-employees-table"
        aria-label={t('settings.employees.table.title')}
        pagination={tablePagination}
        recordsLabel={t('settings.employees.summary.total').toLowerCase()}
      >
            <thead>
              <tr>
                <th>{t('settings.employees.table.empleadoCol')}</th>
                <th>{t('settings.employees.table.emailCol')}</th>
                <th>{t('settings.employees.table.statusCol')}</th>
                <th>{t('settings.employees.table.createdAtCol')}</th>
                <TableActionsHeader>{t('settings.employees.table.actionsCol')}</TableActionsHeader>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee: any) => (
                <tr key={employee.id}>
                  <td>
                    <p className="font-semibold text-text-primary">{employee.name || t('settings.employees.table.nameMissing')}</p>
                    <p className="mt-1 text-xs text-text-secondary">{t('settings.employees.table.roleHint')}</p>
                  </td>
                  <td className="text-text-secondary">{employee.email}</td>
                  <td><StatusBadge active={employee.isActive !== false} /></td>
                  <td className="text-text-secondary">
                    {employee.createdAt
                      ? formatDateValue(employee.createdAt, { day: '2-digit', month: 'short', year: 'numeric' }) || '—'
                      : '—'}
                  </td>
                  <TableActionsCell>
                    <RowActionsWithOverflow
                      variant="icon"
                      align="center"
                      ariaLabel={t('settings.employees.table.actionsCol')}
                      items={[
                        {
                          id: 'edit',
                          label: t('settings.employees.actions.editTitle'),
                          icon: <PencilLine size={16} />,
                          onClick: () => setEditingEmployee(employee),
                          iconVariant: 'secondary',
                        },
                        {
                          id: 'status',
                          label: employee.isActive === false
                            ? t('settings.employees.actions.reactivateTitle')
                            : t('settings.employees.actions.deactivateTitle'),
                          icon: employee.isActive === false ? <UserCheck size={16} /> : <UserX size={16} />,
                          onClick: () => { void handleToggleEmployeeStatus(employee); },
                          disabled: deactivateUser.isPending || reactivateUser.isPending,
                          iconVariant: employee.isActive === false ? 'secondary' : 'danger',
                          menuTone: employee.isActive === false ? 'default' : 'danger',
                        },
                      ] as RowActionOverflowItem[]}
                    />
                  </TableActionsCell>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty-state">{t('settings.employees.table.empty')}</td>
                </tr>
              )}
            </tbody>
      </AppTable>
      </SectionSurface>

      {editingEmployee && (
        <EmployeeEditModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
        />
      )}
      {isCreateEmployeeModalOpen && (
        <ModalShell
          title={t('settings.employees.create.title')}
          subtitle={t('settings.employees.create.modalSubtitle')}
          maxWidthClassName="max-w-xl"
          onClose={() => setIsCreateEmployeeModalOpen(false)}
          footer={(
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <ActionButton type="button" onClick={() => setIsCreateEmployeeModalOpen(false)} disabled={registerWithPermissions.isPending}>
                {t('common.cancel')}
              </ActionButton>
              <ActionButton
                type="submit"
                form="employee-create-form"
                disabled={registerWithPermissions.isPending}
                variant="primary"
                icon={<UserPlus size={16} />}
              >
                {t('settings.employees.create.submit')}
              </ActionButton>
            </div>
          )}
        >
          {createEmployeeForm}
        </ModalShell>
      )}
    </div>
  );
}
