import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Lock, Shield, Users, X } from 'lucide-react';
import {
  useGrantBatchPermissions,
  usePermissions,
  useRevokePermission,
  useUserPermissions,
} from '../services/permissionsService';
import { useUsers } from '../services/userService';
import { toast } from '../lib/toast';

type PermissionRecord = {
  permission: string;
  name: string;
  module: string;
  source?: 'direct' | 'role' | string;
  description?: string;
};

export default function PermissionsTab() {
  const { permissions, isLoading: isLoadingPermissions } = usePermissions();
  const { data: usersData, isLoading: isLoadingUsers } = useUsers({ pageSize: 200 });
  const { grantBatchPermissions } = useGrantBatchPermissions();
  const { revokePermission } = useRevokePermission();

  const [activeView, setActiveView] = useState<'all' | 'user'>('all');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [selectedUserId, setSelectedUserId] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  const users = Array.isArray(usersData?.data?.users)
    ? usersData.data.users
    : Array.isArray(usersData?.data)
      ? usersData.data
      : [];

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

  const selectedUser = users.find((user: any) => String(user.id) === selectedUserId);
  const isBusy = grantBatchPermissions.isPending || revokePermission.isPending;

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
    return <div className="p-8 text-center text-text-secondary">Cargando permisos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex border-b border-border-subtle">
        <button
          onClick={() => setActiveView('all')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeView === 'all' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <Shield size={16} /> Catálogo de permisos
        </button>
        <button
          onClick={() => setActiveView('user')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeView === 'user' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <Users size={16} /> Gestión por usuario
        </button>
      </div>

      {activeView === 'all' && (
        <div className="space-y-3">
          {groupedPermissions.length === 0 ? (
            <p className="text-text-secondary py-4">No hay permisos disponibles.</p>
          ) : (
            groupedPermissions.map((group) => (
              <div key={group.module} className="border border-border-subtle rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleModule(group.module)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-bg-base hover:bg-hover-bg transition-colors"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Shield size={16} />
                    <span className="capitalize">{group.module}</span>
                    <span className="text-xs text-text-secondary bg-bg-surface px-2 py-0.5 rounded-full">
                      {group.permissions.length} permisos
                    </span>
                  </div>
                  {expandedModules.has(group.module) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {expandedModules.has(group.module) && (
                  <div className="divide-y divide-border-subtle">
                    {group.permissions.map((permission) => (
                      <div key={`${permission.module}-${permission.permission}`} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{permission.permission}</p>
                          <p className="text-xs text-text-secondary">{permission.description || 'Sin descripción'}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded bg-bg-base text-text-secondary">{permission.module}</span>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Usuario</label>
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Seleccione un usuario</option>
                {users.map((user: any) => (
                  <option key={user.id} value={String(user.id)}>
                    {user.name || user.email} ({user.role || 'sin rol'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Módulo</label>
              <select
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value)}
                className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">Todos los módulos</option>
                {groupedPermissions.map((group) => (
                  <option key={group.module} value={group.module}>{group.module}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => selectedUserPermissionsQuery.refetch()}
                disabled={!selectedUserId || selectedUserPermissionsQuery.isLoading}
                className="w-full px-3 py-2 rounded-lg border border-border-subtle hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedUserPermissionsQuery.isLoading ? 'Actualizando...' : 'Actualizar permisos'}
              </button>
            </div>
          </div>

          {!selectedUserId ? (
            <div className="text-text-secondary py-8 text-center">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>Seleccione un usuario para gestionar permisos por módulo y permiso individual.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-border-subtle bg-bg-base px-4 py-2 text-sm text-text-secondary">
                Gestionando permisos de <span className="font-medium text-text-primary">{selectedUser?.name || selectedUser?.email}</span>
              </div>
              {visibleGroupedPermissions.map((group) => {
                const modulePermissions = group.permissions;
                const totalPermissions = modulePermissions.length;
                const directCount = modulePermissions.filter((permission) => directPermissionSet.has(permission.permission.toLowerCase())).length;
                const roleCount = modulePermissions.filter((permission) => rolePermissionSet.has(permission.permission.toLowerCase())).length;

                return (
                  <div key={`user-${group.module}`} className="border border-border-subtle rounded-xl overflow-hidden">
                    <div className="w-full px-4 py-3 flex items-center justify-between bg-bg-base">
                      <div className="flex items-center gap-2 font-medium">
                        <Shield size={16} />
                        <span className="capitalize">{group.module}</span>
                        <span className="text-xs text-text-secondary bg-bg-surface px-2 py-0.5 rounded-full">
                          {directCount}/{totalPermissions} directos · {roleCount} heredados
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleModulePermissions(group.module, true)}
                          disabled={isBusy}
                          className="text-xs px-2 py-1 rounded border border-border-subtle hover:bg-hover-bg disabled:opacity-50"
                        >
                          Conceder módulo
                        </button>
                        <button
                          onClick={() => handleToggleModulePermissions(group.module, false)}
                          disabled={isBusy || directCount === 0}
                          className="text-xs px-2 py-1 rounded border border-border-subtle hover:bg-hover-bg disabled:opacity-50"
                        >
                          Revocar directos
                        </button>
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
                              <button
                                onClick={() => handleToggleUserPermission(permission, !grantedDirect)}
                                disabled={isBusy || grantedByRole}
                                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border-subtle disabled:opacity-50 disabled:cursor-not-allowed ${
                                  effectiveGranted ? 'text-emerald-600 bg-emerald-50' : 'text-text-secondary bg-bg-surface'
                                }`}
                                title={grantedByRole
                                  ? 'Permiso heredado desde rol. No se puede revocar aquí.'
                                  : grantedDirect
                                    ? 'Revocar permiso directo'
                                    : 'Conceder permiso directo'}
                              >
                                {effectiveGranted ? <Check size={12} /> : <X size={12} />}
                                {grantedDirect ? 'Revocar' : 'Conceder'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
