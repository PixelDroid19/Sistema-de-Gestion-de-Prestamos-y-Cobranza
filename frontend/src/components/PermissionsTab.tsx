import React, { useState } from 'react';
import { Shield, Users, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { usePermissions } from '../services/permissionsService';

interface Permission {
  id: string;
  name: string;
  module: string;
  description: string;
}

interface GroupedPermissions {
  module: string;
  permissions: Permission[];
}

export default function PermissionsTab() {
  const [activeView, setActiveView] = useState<'all' | 'user'>('all');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const { permissions, isLoading } = usePermissions();

  const groupedPermissions: GroupedPermissions[] = React.useMemo(() => {
    if (!permissions) return [];
    const groups: Record<string, Permission[]> = {};
    permissions.forEach((perm: any) => {
      const module = perm.module || 'general';
      if (!groups[module]) groups[module] = [];
      groups[module].push(perm);
    });
    return Object.entries(groups).map(([module, perms]) => ({ module, permissions: perms }));
  }, [permissions]);

  const toggleModule = (module: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(module)) {
      newExpanded.delete(module);
    } else {
      newExpanded.add(module);
    }
    setExpandedModules(newExpanded);
  };

  const getModuleIcon = (module: string) => {
    const icons: Record<string, React.ReactNode> = {
      users: <Users size={16} />,
      credits: <Shield size={16} />,
      customers: <Users size={16} />,
      reports: <Shield size={16} />,
      settings: <Shield size={16} />,
      general: <Lock size={16} />,
    };
    return icons[module] || <Shield size={16} />;
  };

  if (isLoading) {
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
          <Shield size={16} /> Todos los Permisos
        </button>
        <button
          onClick={() => setActiveView('user')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeView === 'user' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <Users size={16} /> Permisos de Usuario
        </button>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        {activeView === 'all' && (
          <div className="space-y-4">
            <h3 className="font-medium text-lg">Permisos del Sistema</h3>
            <p className="text-sm text-text-secondary">Lista de todos los permisos disponibles agrupados por módulo.</p>
            
            {groupedPermissions.length === 0 ? (
              <p className="text-text-secondary py-4">No hay permisos disponibles.</p>
            ) : (
              <div className="space-y-3 mt-4">
                {groupedPermissions.map((group) => (
                  <div key={group.module} className="border border-border-subtle rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleModule(group.module)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-bg-base hover:bg-hover-bg transition-colors"
                    >
                      <div className="flex items-center gap-2 font-medium">
                        {getModuleIcon(group.module)}
                        <span className="capitalize">{group.module}</span>
                        <span className="text-xs text-text-secondary bg-bg-surface px-2 py-0.5 rounded-full">
                          {group.permissions.length} permisos
                        </span>
                      </div>
                      {expandedModules.has(group.module) ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </button>
                    
                    {expandedModules.has(group.module) && (
                      <div className="divide-y divide-border-subtle">
                        {group.permissions.map((permission) => (
                          <div key={permission.id} className="px-4 py-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{permission.name}</p>
                              <p className="text-xs text-text-secondary">{permission.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'user' && (
          <div>
            <h3 className="font-medium text-lg mb-4">Permisos de Usuario</h3>
            <p className="text-sm text-text-secondary mb-4">
              Consulta y gestiona los permisos directos asignados a cada usuario.
            </p>
            <div className="text-text-secondary py-8 text-center">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>Selecciona un usuario desde la pestaña "Permisos de Usuario" para ver sus permisos.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
