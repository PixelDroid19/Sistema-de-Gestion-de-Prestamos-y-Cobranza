import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Lock, Save, Shield, X } from 'lucide-react';
import {
  useGrantBatchPermissions,
  usePermissions,
  useRevokePermission,
  useUserPermissions,
} from '../services/permissionsService';
import { useUsers } from '../services/userService';
import { toast } from '../lib/toast';
import { useTranslation } from '../i18n';
import { getPermissionDisplayName, getPermissionModuleLabel } from './shared/permissionDisplay';
import {
  ActionButton,
  ClickableSurface,
  FormField,
  InsightStrip,
  SelectInput,
  SectionSurface,
  TextInput,
  ViewTabs,
} from './shared/Surfaces';

type Employee = {
  id: number | string;
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
};

type EmployeeEditModalProps = {
  employee: Employee;
  onClose: () => void;
};

type PermissionRecord = {
  permission: string;
  name: string;
  module: string;
  source?: 'direct' | 'role' | string;
  description?: string;
};

type Tab = 'profile' | 'password' | 'permissions';

const employeeModalFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusableEmployeeModalElements = (panel: HTMLElement) => (
  Array.from(panel.querySelectorAll<HTMLElement>(employeeModalFocusableSelector))
    .filter((element) => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true')
);

export default function EmployeeEditModal({ employee, onClose }: EmployeeEditModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const titleId = React.useId();
  const subtitleId = React.useId();
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || panel.contains(document.activeElement)) {
      return;
    }

    panel.focus({ preventScroll: true });
  }, []);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const focusableElements = getFocusableEmployeeModalElements(panel);
    if (focusableElements.length === 0) {
      event.preventDefault();
      panel.focus({ preventScroll: true });
      return;
    }

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey) {
      if (activeElement === firstFocusable || activeElement === panel || !panel.contains(activeElement)) {
        event.preventDefault();
        lastFocusable.focus({ preventScroll: true });
      }
      return;
    }

    if (activeElement === lastFocusable || activeElement === panel || !panel.contains(activeElement)) {
      event.preventDefault();
      firstFocusable.focus({ preventScroll: true });
    }
  };

  const tabs = useMemo(() => [
    { id: 'profile' as Tab, label: t('settings.employees.modal.tabs.profile') },
    { id: 'password' as Tab, label: t('settings.employees.modal.tabs.password') },
    { id: 'permissions' as Tab, label: t('settings.employees.modal.tabs.permissions') },
  ], [t]);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold text-text-primary">{t('settings.employees.modal.title')}</h2>
            <p id={subtitleId} className="mt-0.5 truncate text-xs text-text-secondary">
              {employee.name || employee.email || t('settings.employees.table.nameMissing')}
              <span className="mx-1">·</span>
              {t('settings.employees.modal.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-hover-bg"
          >
            <X size={18} />
          </button>
        </header>

        <div className="border-b border-border-subtle px-5 pb-2 pt-3">
          <ViewTabs
            ariaLabel={t('settings.employees.modal.title')}
            activeTab={activeTab}
            onChange={(next) => setActiveTab(next as Tab)}
            tabs={tabs}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {activeTab === 'profile' && <ProfileTab employee={employee} />}
          {activeTab === 'password' && <PasswordTab employee={employee} />}
          {activeTab === 'permissions' && <PermissionsForUser employee={employee} />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const { updateUser } = useUsers({ page: 1, pageSize: 1, role: 'employee' });
  const [name, setName] = useState(employee.name || '');
  const [email, setEmail] = useState(employee.email || '');

  const isDirty = name.trim() !== (employee.name || '') || email.trim().toLowerCase() !== (employee.email || '').toLowerCase();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      toast.error({ description: t('errors.employeeNameRequired') });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(trimmedEmail)) {
      toast.error({ description: t('errors.employeeEmailInvalid') });
      return;
    }
    try {
      await updateUser.mutateAsync({ id: employee.id, name: trimmedName, email: trimmedEmail });
      toast.success({ description: t('settings.employees.modal.profile.saved') });
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'users', action: 'generic' });
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <FormField label={t('settings.employees.modal.profile.nameLabel')}>
        <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
      </FormField>
      <FormField label={t('settings.employees.modal.profile.emailLabel')}>
        <TextInput type="text" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </FormField>
      <div className="flex justify-end">
        <ActionButton
          type="submit"
          variant="primary"
          disabled={!isDirty || updateUser.isPending}
          icon={<Save size={14} />}
        >
          {t('settings.employees.modal.profile.saveButton')}
        </ActionButton>
      </div>
    </form>
  );
}

function PasswordTab({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const { updateUser } = useUsers({ page: 1, pageSize: 1, role: 'employee' });
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error({ description: t('settings.employees.modal.password.tooShort') });
      return;
    }
    if (password !== confirmation) {
      toast.error({ description: t('settings.employees.modal.password.mismatch') });
      return;
    }
    try {
      await updateUser.mutateAsync({ id: employee.id, password });
      setPassword('');
      setConfirmation('');
      toast.success({ description: t('settings.employees.modal.password.updated') });
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'users', action: 'generic' });
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <p className="text-sm text-text-secondary">{t('settings.employees.modal.password.intro')}</p>
      <FormField label={t('settings.employees.modal.password.newLabel')}>
        <TextInput
          type="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </FormField>
      <FormField label={t('settings.employees.modal.password.confirmLabel')}>
        <TextInput
          type="password"
          minLength={8}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
      </FormField>
      <div className="flex justify-end">
        <ActionButton
          type="submit"
          variant="primary"
          disabled={updateUser.isPending || password.length === 0}
          icon={<Save size={14} />}
        >
          {t('settings.employees.modal.password.submit')}
        </ActionButton>
      </div>
    </form>
  );
}

function PermissionsForUser({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const { permissions: rawPermissions, isLoading: isLoadingPermissions } = usePermissions();
  const { grantBatchPermissions } = useGrantBatchPermissions();
  const { revokePermission } = useRevokePermission();
  const userId = String(employee.id);
  const userPermsQuery = useUserPermissions(userId);

  const [moduleFilter, setModuleFilter] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const normalizedPermissions = useMemo<PermissionRecord[]>(() => (
    (rawPermissions || []).map((permission: any) => ({
      permission: String(permission.permission || permission.name || '').trim(),
      name: String(permission.name || permission.permission || '').trim(),
      module: String(permission.module || 'general').trim() || 'general',
      source: permission.source,
      description: permission.description,
    })).filter((permission) => permission.permission)
  ), [rawPermissions]);

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionRecord[]>();
    normalizedPermissions.forEach((permission) => {
      const list = map.get(permission.module) || [];
      list.push(permission);
      map.set(permission.module, list);
    });
    return Array.from(map.entries())
      .map(([module, modulePerms]) => ({ module, permissions: modulePerms.sort((a, b) => a.permission.localeCompare(b.permission)) }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [normalizedPermissions]);

  const userPermissions = useMemo<PermissionRecord[]>(() => (
    (userPermsQuery.permissions || []).map((permission: any) => ({
      permission: String(permission.permission || permission.name || '').trim(),
      name: String(permission.name || permission.permission || '').trim(),
      module: String(permission.module || 'general').trim() || 'general',
      source: permission.source || 'direct',
      description: permission.description,
    })).filter((permission) => permission.permission)
  ), [userPermsQuery.permissions]);

  const directSet = useMemo(
    () => new Set(userPermissions.filter((permission) => permission.source === 'direct').map((permission) => permission.permission.toLowerCase())),
    [userPermissions],
  );
  const roleSet = useMemo(
    () => new Set(userPermissions.filter((permission) => permission.source === 'role').map((permission) => permission.permission.toLowerCase())),
    [userPermissions],
  );

  const visibleGroups = useMemo(
    () => (moduleFilter === 'all' ? groupedPermissions : groupedPermissions.filter((group) => group.module === moduleFilter)),
    [groupedPermissions, moduleFilter],
  );

  const isBusy = grantBatchPermissions.isPending || revokePermission.isPending;

  const toggleExpanded = (module: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  };

  const handleToggle = async (permission: PermissionRecord, shouldGrant: boolean) => {
    try {
      if (shouldGrant) {
        await grantBatchPermissions.mutateAsync({
          userId,
          permissions: [{ permission: permission.permission, module: permission.module }],
        });
      } else {
        await revokePermission.mutateAsync({ userId, permission: permission.permission, module: permission.module });
      }
      await userPermsQuery.refetch();
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'users', action: shouldGrant ? 'permission.grant' : 'permission.revoke' });
    }
  };

  const handleToggleModule = async (module: string, grantAll: boolean) => {
    const modulePerms = normalizedPermissions.filter((permission) => permission.module === module);
    if (modulePerms.length === 0) return;
    try {
      if (grantAll) {
        await grantBatchPermissions.mutateAsync({
          userId,
          permissions: modulePerms.map((permission) => ({ permission: permission.permission, module: permission.module })),
        });
      } else {
        await Promise.all(modulePerms.map((permission) => (
          directSet.has(permission.permission.toLowerCase())
            ? revokePermission.mutateAsync({ userId, permission: permission.permission, module: permission.module })
            : Promise.resolve()
        )));
      }
      await userPermsQuery.refetch();
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'users', action: grantAll ? 'permission.grant' : 'permission.revoke' });
    }
  };

  if (isLoadingPermissions) {
    return <p className="text-sm text-text-secondary">{t('common.loading')}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">{t('settings.employees.modal.permissions.intro')}</p>

      <InsightStrip
        aria-label={t('settings.employees.modal.permissions.summaryAria')}
        items={[
          { id: 'effective', label: t('settings.employees.modal.permissions.effectiveLabel'), value: userPermissions.length, helper: t('settings.employees.modal.permissions.effectiveHelper'), icon: <Shield size={16} />, accent: 'blue' },
          { id: 'direct', label: t('settings.employees.modal.permissions.directLabel'), value: directSet.size, helper: t('settings.employees.modal.permissions.directHelper'), icon: <Check size={16} />, accent: 'emerald' },
          { id: 'inherited', label: t('settings.employees.modal.permissions.inheritedLabel'), value: roleSet.size, helper: t('settings.employees.modal.permissions.inheritedHelper'), icon: <Lock size={16} />, accent: 'slate' },
        ]}
      />

      <FormField label={t('settings.employees.modal.permissions.moduleLabel')}>
        <SelectInput value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
          <option value="all">{t('settings.employees.modal.permissions.moduleAll')}</option>
          {groupedPermissions.map((group) => (
            <option key={group.module} value={group.module}>{getPermissionModuleLabel(group.module)}</option>
          ))}
        </SelectInput>
      </FormField>

      <div className="space-y-3">
        {visibleGroups.map((group) => {
          const total = group.permissions.length;
          const directCount = group.permissions.filter((permission) => directSet.has(permission.permission.toLowerCase())).length;
          const inheritedCount = group.permissions.filter((permission) => roleSet.has(permission.permission.toLowerCase())).length;
          const isOpen = expanded.has(group.module);
          return (
            <SectionSurface key={group.module} className="!p-0" bodyClassName="space-y-0">
              <ClickableSurface
                variant="list"
                onClick={() => toggleExpanded(group.module)}
                className="flex w-full items-center justify-between gap-3 bg-bg-base px-4 py-3"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield size={16} />
                  <span>{getPermissionModuleLabel(group.module)}</span>
                  <span className="rounded-full bg-bg-surface px-2 py-0.5 text-[11px] text-text-secondary">
                    {t('settings.employees.modal.permissions.summary', { direct: directCount, total, inherited: inheritedCount })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ActionButton
                    type="button"
                    onClick={(event) => { event.stopPropagation(); handleToggleModule(group.module, true); }}
                    disabled={isBusy}
                    className="!min-h-0 !px-2 !py-1 text-xs"
                  >
                    {t('settings.employees.modal.permissions.grantModule')}
                  </ActionButton>
                  <ActionButton
                    type="button"
                    onClick={(event) => { event.stopPropagation(); handleToggleModule(group.module, false); }}
                    disabled={isBusy || directCount === 0}
                    className="!min-h-0 !px-2 !py-1 text-xs"
                  >
                    {t('settings.employees.modal.permissions.revokeDirect')}
                  </ActionButton>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </ClickableSurface>
              {isOpen && (
                <div className="divide-y divide-border-subtle border-t border-border-subtle">
                  {group.permissions.map((permission) => {
                    const key = permission.permission.toLowerCase();
                    const isDirect = directSet.has(key);
                    const isRole = roleSet.has(key);
                    const isEffective = isDirect || isRole;
                    return (
                      <div key={permission.permission} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{getPermissionDisplayName(permission, t)}</p>
                          <p className="truncate text-xs text-text-secondary">{getPermissionModuleLabel(permission.module)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {isRole && !isDirect && (
                            <span className="inline-flex items-center gap-1 rounded bg-bg-base px-2 py-1 text-[11px] text-text-secondary">
                              <Lock size={11} /> {t('settings.employees.modal.permissions.inherited')}
                            </span>
                          )}
                          <ActionButton
                            type="button"
                            onClick={() => handleToggle(permission, !isDirect)}
                            disabled={isBusy || isRole}
                            variant={isEffective ? 'secondary' : 'ghost'}
                            className="!min-h-0 !px-2 !py-1 text-xs"
                          >
                            {isDirect
                              ? t('settings.employees.modal.permissions.revoke')
                              : t('settings.employees.modal.permissions.grant')}
                          </ActionButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionSurface>
          );
        })}
      </div>
    </div>
  );
}
