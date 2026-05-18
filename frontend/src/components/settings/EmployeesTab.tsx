import React, { useState } from 'react';
import { PencilLine, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatDate as formatDateValue } from '../../i18n/format';
import { useUsers } from '../../services/userService';
import { toast } from '../../lib/toast';
import { confirmDanger } from '../../lib/confirmModal';
import {
  ActionButton,
  DataTableSurface,
  FormField,
  InsightStrip,
  ModalShell,
  SectionSurface,
  TextInput,
} from '../shared/Surfaces';
import EmployeeEditModal from '../EmployeeEditModal';
import { StatusBadge } from './StatusBadge';
import type { EmployeeDraft } from './settingsHelpers';

export default function EmployeesTab() {
  const { t } = useTranslation();
  const { data: usersData, registerWithPermissions, deactivateUser, reactivateUser } = useUsers({ page: 1, pageSize: 100, role: 'employee' });
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
  const activeEmployees = employees.filter((employee: any) => employee?.isActive !== false);
  const inactiveEmployees = employees.filter((employee: any) => employee?.isActive === false);

  const handleToggleEmployeeStatus = async (employee: any) => {
    const isActive = employee?.isActive !== false;
    const employeeLabel = employee?.name || employee?.email || 'empleado';

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
      console.error('[settings] toggle employee status failed', error);
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

    const duplicateEmail = employees.some((employee: any) => String(employee?.email || '').toLowerCase() === email);
    if (duplicateEmail) {
      toast.error({ description: t('errors.employeeEmailDuplicate') });
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
      console.error('[settings] create employee failed', error);
      toast.apiErrorSafe(error, { domain: 'users', action: 'generic' });
    }
  };

  const createEmployeeForm = (
    <form id="employee-create-form" onSubmit={handleCreateEmployee} aria-label={t('settings.employees.create.modalTitle')} className="space-y-4">
      <FormField
        label={t('settings.employees.create.nameLabel')}
        tooltip={t('settings.employees.create.nameTooltip')}
      >
        <TextInput
          aria-label={t('settings.employees.create.nameLabel')}
          required
          value={employeeDraft.name}
          onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, name: event.target.value }))}
          placeholder={t('settings.employees.create.namePlaceholder')}
        />
      </FormField>
      <FormField
        label={t('settings.employees.create.emailLabel')}
        tooltip={t('settings.employees.create.emailTooltip')}
      >
        <TextInput
          aria-label={t('settings.employees.create.emailLabel')}
          required
          type="text"
          inputMode="email"
          value={employeeDraft.email}
          onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, email: event.target.value }))}
          placeholder={t('settings.employees.create.emailPlaceholder')}
        />
      </FormField>
      <FormField
        label={t('settings.employees.create.passwordLabel')}
        tooltip={t('settings.employees.create.passwordTooltip')}
      >
        <TextInput
          aria-label={t('settings.employees.create.passwordLabel')}
          required
          type="password"
          minLength={8}
          value={employeeDraft.password}
          onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, password: event.target.value }))}
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
            value: employees.length,
            helper: t('settings.employees.summary.totalHelper'),
            icon: <UserPlus size={18} />,
            accent: 'slate',
          },
          {
            id: 'settings-employees-active',
            label: t('settings.employees.summary.active'),
            value: activeEmployees.length,
            helper: t('settings.employees.summary.activeHelper'),
            icon: <UserCheck size={18} />,
            accent: 'emerald',
          },
          {
            id: 'settings-employees-inactive',
            label: t('settings.employees.summary.inactive'),
            value: inactiveEmployees.length,
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

      <DataTableSurface aria-label={t('settings.employees.table.title')}>
        <div className="overflow-x-auto">
          <table className="min-w-[760px]" aria-label={t('settings.employees.table.title')}>
            <thead>
              <tr>
                <th>{t('settings.employees.table.empleadoCol')}</th>
                <th>{t('settings.employees.table.emailCol')}</th>
                <th>{t('settings.employees.table.statusCol')}</th>
                <th>{t('settings.employees.table.createdAtCol')}</th>
                <th className="text-right">{t('settings.employees.table.actionsCol')}</th>
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
                  <td>
                    <div className="flex justify-end gap-2">
                      <ActionButton
                        type="button"
                        onClick={() => setEditingEmployee(employee)}
                        variant="secondary"
                        icon={<PencilLine size={14} />}
                        className="min-h-8 px-3 py-1.5 text-xs"
                        title={t('settings.employees.actions.editTitle')}
                      >
                        {t('settings.employees.actions.edit')}
                      </ActionButton>
                      <ActionButton
                        type="button"
                        onClick={() => handleToggleEmployeeStatus(employee)}
                        disabled={deactivateUser.isPending || reactivateUser.isPending}
                        variant={employee.isActive === false ? 'secondary' : 'danger'}
                        icon={employee.isActive === false ? <UserCheck size={14} /> : <UserX size={14} />}
                        className="min-h-8 px-3 py-1.5 text-xs"
                        title={employee.isActive === false
                          ? t('settings.employees.actions.reactivateTitle')
                          : t('settings.employees.actions.deactivateTitle')}
                      >
                        {employee.isActive === false ? t('common.activate') : t('common.deactivate')}
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty-state">{t('settings.employees.table.empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DataTableSurface>

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
