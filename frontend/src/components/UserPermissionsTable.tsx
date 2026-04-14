import React from 'react';
import { User, Shield, Trash2, Edit } from 'lucide-react';
import { useUsers } from '../services/userService';
import { useUserPermissions, useRevokePermission, useGrantPermission } from '../services/permissionsService';
import { toast } from '../lib/toast';
import PermissionToggle from './PermissionToggle';

interface UserPermissionsTableProps {
  onManagePermissions?: (userId: string) => void;
}

interface Permission {
  permission: string;
  module?: string;
  source: 'direct' | 'role';
}

export default function UserPermissionsTable({ onManagePermissions }: UserPermissionsTableProps) {
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const { revokePermission } = useRevokePermission();
  const { grantPermission } = useGrantPermission();

  const users = Array.isArray(usersData?.data?.users)
    ? usersData.data.users
    : Array.isArray(usersData?.data)
      ? usersData.data
      : [];

  const handleRevoke = async (userId: string, permission: string, module?: string) => {
    try {
      await revokePermission.mutateAsync({ userId, permission, module });
      toast.success({ description: 'Permiso revocado' });
    } catch (error) {
      console.error('[permissions] revokePermission failed', error);
      toast.apiErrorSafe(error, { domain: 'users', action: 'permission.revoke' });
    }
  };

  const handleGrant = async (userId: string, permission: string, module?: string) => {
    try {
      await grantPermission.mutateAsync({ userId, permission, module });
      toast.success({ description: 'Permiso concedido' });
    } catch (error) {
      console.error('[permissions] grantPermission failed', error);
      toast.apiErrorSafe(error, { domain: 'users', action: 'permission.grant' });
    }
  };

  if (isLoadingUsers) {
    return <div className="p-8 text-center text-text-secondary">Cargando usuarios...</div>;
  }

  if (!users || users.length === 0) {
    return <div className="p-8 text-center text-text-secondary">No hay usuarios disponibles.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-subtle">
            <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Usuario</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Rol</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Permisos Directos</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user: any) => (
            <UserRow 
              key={user.id} 
              user={user} 
              onRevoke={handleRevoke}
              onGrant={handleGrant}
              onManage={onManagePermissions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface UserRowProps {
  user: any;
  onRevoke: (userId: string, permission: string, module?: string) => void;
  onGrant: (userId: string, permission: string, module?: string) => void;
  onManage?: (userId: string) => void;
}

function UserRow({ user, onRevoke, onGrant, onManage }: UserRowProps) {
  const { permissions: userPermissions, isLoading: isLoadingPermissions } = useUserPermissions(user.id);
  const [showAll, setShowAll] = React.useState(false);

  const allPermissions = (userPermissions || []) as Permission[];
  const directPermissions = allPermissions.filter(
    (p: Permission) => p.source === 'direct'
  );

  const displayedPermissions = showAll ? directPermissions : directPermissions.slice(0, 3);
  const remainingCount = directPermissions.length - 3;

  return (
    <tr className="border-b border-border-subtle hover:bg-hover-bg transition-colors">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center">
            <User size={16} className="text-brand-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{user.name || user.email}</p>
            <p className="text-xs text-text-secondary">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-text-secondary" />
          <span className="text-sm capitalize">{user.role || 'sin rol'}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        {isLoadingPermissions ? (
          <span className="text-sm text-text-secondary">Cargando...</span>
        ) : directPermissions.length === 0 ? (
          <span className="text-sm text-text-secondary">Sin permisos directos</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(displayedPermissions as Permission[]).map((perm: Permission, idx: number) => (
              <PermissionToggle
                key={`${perm.permission}-${idx}`}
                permission={perm.permission}
                module={perm.module}
                source={perm.source}
                granted
                onToggle={(granted) => {
                  if (granted) {
                    onGrant(user.id, perm.permission, perm.module);
                  } else {
                    onRevoke(user.id, perm.permission, perm.module);
                  }
                }}
                compact
              />
            ))}
            {remainingCount > 0 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="text-xs text-brand-primary hover:underline px-2 py-1"
              >
                +{remainingCount} más
              </button>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-4">
        <button
          onClick={() => onManage?.(user.id)}
          className="flex items-center gap-1 text-sm text-brand-primary hover:underline"
        >
          <Edit size={14} /> Gestionar
        </button>
      </td>
    </tr>
  );
}
