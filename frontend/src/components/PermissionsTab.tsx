import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Lock, Shield, Users, X } from 'lucide-react';
import {
  useGrantBatchPermissions,
  usePermissions,
  useRevokePermission,
  useUserPermissions,
} from '../services/permissionsService';
import { useUsers } from '../services/userService';
import { toast } from '../lib/toast';
import {
  ActionButton,
  ClickableSurface,
  EmptyState,
  FormField,
  MetricCard,
  SelectInput,
  SectionSurface,
  ViewTabs,
} from './shared/Surfaces';

type PermissionRecord = {
  permission: string;
  name: string;
  module: string;
  source?: 'direct' | 'role' | string;
  description?: string;
};

const MODULE_DISPLAY_LABELS: Record<string, string> = {
  auditoria: 'Auditoría',
  auditoría: 'Auditoría',
  clientes: 'Clientes',
  creditos: 'Créditos',
  dashboard: 'Dashboard',
  pagos: 'Pagos',
  permisos: 'Permisos',
  reportes: 'Reportes',
  socios: 'Socios',
  usuarios: 'Usuarios',
};

const getModuleLabel = (module: string) => {
  const normalizedModule = module.trim().toLowerCase();
  return MODULE_DISPLAY_LABELS[normalizedModule] || module;
};

export default function PermissionsTab() {
  const { permissions, isLoading: isLoadingPermissions } = usePermissions();
  const { data: usersData, isLoading: isLoadingUsers } = useUsers({ page: 1, pageSize: 100 });
  const { grantBatchPermissions } = useGrantBatchPermissions();
  const { revokePermission } = useRevokePermission();

  const [activeView, setActiveView] = useState<'all' | 'user'>('user');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [selectedUserId, setSelectedUserId] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  const users = Array.isArray(usersData?.data?.users)
    ? usersData.data.users
    : Array.isArray(usersData?.data)
      ? usersData.data
      : [];
  const employeeUsers = useMemo(
    () => users.filter((user: any) => user?.role === 'employee'),
    [users],
  );

  const normalizedPermissions = useMemo<PermissionRecord[]>(() => {
    return (permissions || []).map((permission: any) => ({
      permission: String(permission.permission || permission.name || '').trim(),
      name: String(permission.name || permission.permission || '').trim(),
      module: String(permission.module || 'general').trim() || 'general',
      source: permission.source,
      description: permission.description,
    })).filter((permission) => permission.permission);
  }, [permissions]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionRecord[]>();
    normalizedPermissions.forEach((permission) => {
      const current = groups.get(permission.module) || [];
      current.push(permission);
      groups.set(permission.module, current);
    });

    return Array.from(groups.entries())
      .map(([module, modulePermissions]) => ({
        module,
        permissions: modulePermissions.sort((a, b) => a.permission.localeCompare(b.permission)),
      }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [normalizedPermissions]);

  const selectedUserPermissionsQuery = useUserPermissions(selectedUserId);

  const selectedUserPermissions = useMemo<PermissionRecord[]>(() => {
    return (selectedUserPermissionsQuery.permissions || []).map((permission: any) => ({
      permission: String(permission.permission || permission.name || '').trim(),
      name: String(permission.name || permission.permission || '').trim(),
      module: String(permission.module || 'general').trim() || 'general',
      source: permission.source || 'direct',
      description: permission.description,
    })).filter((permission) => permission.permission);
  }, [selectedUserPermissionsQuery.permissions]);

  const directPermissionSet = useMemo(() => {
    const direct = selectedUserPermissions
      .filter((permission) => permission.source === 'direct')
      .map((permission) => permission.permission.toLowerCase());

    return new Set(direct);
  }, [selectedUserPermissions]);

  const rolePermissionSet = useMemo(() => {
    const rolePermissions = selectedUserPermissions
      .filter((permission) => permission.source === 'role')
      .map((permission) => permission.permission.toLowerCase());

    return new Set(rolePermissions);
  }, [selectedUserPermissions]);

  const visibleGroupedPermissions = useMemo(() => {
    if (moduleFilter === 'all') return groupedPermissions;
    return groupedPermissions.filter((group) => group.module === moduleFilter);
  }, [groupedPermissions, moduleFilter]);

  const selectedUser = employeeUsers.find((user: any) => String(user.id) === selectedUserId);
  const isBusy = grantBatchPermissions.isPending || revokePermission.isPending;
  const selectedEffectiveCount = selectedUserPermissions.length;
  const selectedDirectCount = directPermissionSet.size;
  const selectedInheritedCount = rolePermissionSet.size;

  useEffect(() => {
    if (!selectedUserId) return;
    const stillAssignable = employeeUsers.some((user: any) => String(user.id) === selectedUserId);
    if (!stillAssignable) {
      setSelectedUserId('');
    }
  }, [employeeUsers, selectedUserId]);

  const toggleModule = (module: string) => {
    setExpandedModules((previous) => {
      const next = new Set(previous);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  };

  const handleToggleUserPermission = async (permission: PermissionRecord, shouldGrant: boolean) => {
    if (!selectedUserId) {
      toast.error({ title: 'Seleccione un usuario para gestionar permisos.' });
      return;
    }

    try {
      if (shouldGrant) {
        await grantBatchPermissions.mutateAsync({
          userId: selectedUserId,
          permissions: [{ permission: permission.permission, module: permission.module }],
        });
        toast.success({ description: `Permiso concedido: ${permission.permission}` });
      } else {
        await revokePermission.mutateAsync({
          userId: selectedUserId,
          permission: permission.permission,
          module: permission.module,
        });
        toast.success({ description: `Permiso revocado: ${permission.permission}` });
      }
      await selectedUserPermissionsQuery.refetch();
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'users', action: shouldGrant ? 'permission.grant' : 'permission.revoke' });
    }
  };

  const handleToggleModulePermissions = async (module: string, shouldGrantAll: boolean) => {
    if (!selectedUserId) {
      toast.error({ title: 'Seleccione un usuario para gestionar permisos.' });
      return;
    }

    const modulePermissions = normalizedPermissions.filter((permission) => permission.module === module);
    if (modulePermissions.length === 0) return;

    try {
      if (shouldGrantAll) {
        await grantBatchPermissions.mutateAsync({
          userId: selectedUserId,
          permissions: modulePermissions.map((permission) => ({
            permission: permission.permission,
            module: permission.module,
          })),
        });
        toast.success({ description: `Permisos del módulo ${module} concedidos.` });
      } else {
        await Promise.all(modulePermissions.map((permission) => {
          if (!directPermissionSet.has(permission.permission.toLowerCase())) {
            return Promise.resolve();
          }
          return revokePermission.mutateAsync({
            userId: selectedUserId,
            permission: permission.permission,
            module: permission.module,
          });
        }));
        toast.success({ description: `Permisos directos del módulo ${module} revocados.` });
      }

      await selectedUserPermissionsQuery.refetch();
    } catch (error) {
      toast.apiErrorSafe(error, { domain: 'users', action: shouldGrantAll ? 'permission.grant' : 'permission.revoke' });
    }
  };

  if (isLoadingPermissions || isLoadingUsers) {
    return <EmptyState title="Cargando permisos…" compact />;
  }

  return (
    <div className="space-y-6">
      <ViewTabs
        ariaLabel="Vistas de permisos"
        activeTab={activeView}
        onChange={(tabId) => setActiveView(tabId as typeof activeView)}
        tabs={[
          { id: 'all', label: 'Catálogo de permisos', icon: Shield },
          { id: 'user', label: 'Gestión por usuario', icon: Users },
        ]}
      />

      {activeView === 'all' && (
        <div className="settings-permission-grid">
          {groupedPermissions.length === 0 ? (
            <EmptyState title="No hay permisos disponibles" compact />
          ) : (
            groupedPermissions.map((group) => (
              <div key={group.module} className="settings-permission-card">
                <ClickableSurface
                  variant="list"
                  onClick={() => toggleModule(group.module)}
                  className="w-full px-4 py-4 flex items-center justify-between bg-transparent hover:bg-hover-bg/50 transition-colors"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Shield size={16} />
                    <span>{getModuleLabel(group.module)}</span>
                    <span className="text-xs text-text-secondary bg-bg-base px-2 py-0.5 rounded-full">
                      {group.permissions.length} permisos
                    </span>
                  </div>
                  {expandedModules.has(group.module) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </ClickableSurface>

                {expandedModules.has(group.module) && (
                  <div className="divide-y divide-border-subtle border-t border-border-subtle">
                    {group.permissions.map((permission) => (
                      <div key={`${permission.module}-${permission.permission}`} className="px-4 py-3 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-sm">{permission.permission}</p>
                          <p className="text-xs text-text-secondary">{permission.description || 'Sin descripción'}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded bg-bg-base text-text-secondary">{getModuleLabel(permission.module)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeView === 'user' && (
        <div className="space-y-4">
          <SectionSurface bodyClassName="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FormField label="Usuario">
                <SelectInput
                  id="permissions-user-select"
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                >
                  <option value="">Seleccione un usuario</option>
                  {employeeUsers.map((user: any) => (
                    <option key={user.id} value={String(user.id)}>
                      {user.name || user.email} (empleado)
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Módulo">
                <SelectInput
                  id="permissions-module-filter"
                  value={moduleFilter}
                  onChange={(event) => setModuleFilter(event.target.value)}
                >
                  <option value="all">Todos los módulos</option>
                  {groupedPermissions.map((group) => (
                    <option key={group.module} value={group.module}>{getModuleLabel(group.module)}</option>
                  ))}
                </SelectInput>
              </FormField>
              <div className="flex items-end">
                <ActionButton
                  onClick={() => selectedUserPermissionsQuery.refetch()}
                  disabled={!selectedUserId || selectedUserPermissionsQuery.isLoading}
                  fullWidth
                >
                  {selectedUserPermissionsQuery.isLoading ? 'Actualizando…' : 'Actualizar permisos'}
                </ActionButton>
              </div>
            </div>
            {selectedUserId ? (
              <p className="settings-inline-note">
                Gestionando permisos de <span className="font-medium text-text-primary">{selectedUser?.name || selectedUser?.email}</span>. Los permisos heredados por rol se muestran bloqueados.
              </p>
            ) : null}
          </SectionSurface>

          {!selectedUserId ? (
            <EmptyState
              title={employeeUsers.length === 0 ? 'No hay empleados creados' : 'Seleccione un empleado'}
              description={employeeUsers.length === 0
                ? 'Cree primero una cuenta de empleado. Los permisos solo se asignan a empleados administrativos.'
                : 'Luego podrá gestionar permisos por módulo y permiso individual.'}
              icon={<Users size={36} />}
            />
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de permisos del empleado">
                <MetricCard
                  label="Permisos efectivos"
                  value={selectedEffectiveCount}
                  helper="Accesos que puede usar"
                  tooltip="Suma de permisos directos y heredados por rol."
                  icon={<Shield />}
                  accent="blue"
                />
                <MetricCard
                  label="Directos"
                  value={selectedDirectCount}
                  helper="Asignados manualmente"
                  tooltip="Estos permisos sí se pueden conceder o revocar desde esta pantalla."
                  icon={<Check />}
                  accent="emerald"
                />
                <MetricCard
                  label="Heredados"
                  value={selectedInheritedCount}
                  helper="Vienen del rol"
                  tooltip="Estos permisos no se revocan aquí; se muestran para que el administrador entienda el acceso efectivo."
                  icon={<Lock />}
                  accent="slate"
                />
              </div>
              {visibleGroupedPermissions.map((group) => {
                const modulePermissions = group.permissions;
                const totalPermissions = modulePermissions.length;
                const directCount = modulePermissions.filter((permission) => directPermissionSet.has(permission.permission.toLowerCase())).length;
                const roleCount = modulePermissions.filter((permission) => rolePermissionSet.has(permission.permission.toLowerCase())).length;

                return (
                  <SectionSurface
                    key={`user-${group.module}`}
                    className="!p-0"
                    bodyClassName="space-y-0"
                  >
                    <div className="w-full px-4 py-3 flex items-center justify-between bg-bg-base border-b border-border-subtle">
                      <div className="flex items-center gap-2 font-medium">
                        <Shield size={16} />
                        <span>{getModuleLabel(group.module)}</span>
                        <span className="text-xs text-text-secondary bg-bg-surface px-2 py-0.5 rounded-full">
                          {directCount}/{totalPermissions} directos · {roleCount} heredados
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ActionButton
                          onClick={() => handleToggleModulePermissions(group.module, true)}
                          disabled={isBusy}
                          className="!min-h-0 !px-2 !py-1 text-xs"
                        >
                          Conceder módulo
                        </ActionButton>
                        <ActionButton
                          onClick={() => handleToggleModulePermissions(group.module, false)}
                          disabled={isBusy || directCount === 0}
                          className="!min-h-0 !px-2 !py-1 text-xs"
                        >
                          Revocar directos
                        </ActionButton>
                      </div>
                    </div>
                    <div className="divide-y divide-border-subtle">
                      {modulePermissions.map((permission) => {
                        const key = permission.permission.toLowerCase();
                        const grantedDirect = directPermissionSet.has(key);
                        const grantedByRole = rolePermissionSet.has(key);
                        const effectiveGranted = grantedDirect || grantedByRole;

                        return (
                          <div key={`permission-${group.module}-${permission.permission}`} className="px-4 py-3 flex items-center justify-between gap-4">
                            <div>
                              <p className="font-medium text-sm">{permission.permission}</p>
                              <p className="text-xs text-text-secondary">{permission.description || 'Sin descripción'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {grantedByRole && !grantedDirect && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-bg-base text-text-secondary">
                                  <Lock size={12} /> heredado
                                </span>
                              )}
                              <ActionButton
                                onClick={() => handleToggleUserPermission(permission, !grantedDirect)}
                                disabled={isBusy || grantedByRole}
                                icon={effectiveGranted ? <Check size={12} /> : <X size={12} />}
                                variant={effectiveGranted ? 'secondary' : 'ghost'}
                                className="!min-h-0 !px-2 !py-1 text-xs"
                                title={grantedByRole
                                  ? 'Permiso heredado desde rol. No se puede revocar aquí.'
                                  : grantedDirect
                                    ? 'Revocar permiso directo'
                                    : 'Conceder permiso directo'}
                              >
                                {grantedDirect ? 'Revocar' : 'Conceder'}
                              </ActionButton>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionSurface>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
