import React from 'react';
import { Plus, Search, MoreVertical, Eye, Edit, Trash2, ShieldOff, ShieldCheck } from 'lucide-react';
import { useUsers } from '../services/userService';
import { usePaginationStore } from '../store/paginationStore';
import { toast } from '../lib/toast';

export default function Agents() {
  const { page, setPage, pageSize: limit } = usePaginationStore();
  const { data: usersData, isLoading, isError, deactivateUser, reactivateUser } = useUsers({ page, limit, role: 'agent' });

  const allUsers = Array.isArray(usersData?.data?.users)
    ? usersData.data.users
    : Array.isArray(usersData?.data)
      ? usersData.data
      : [];
  const agents = allUsers.filter((user: any) => user?.role === 'agent');
  const pagination = usersData?.data?.pagination ?? usersData?.pagination ?? usersData?.meta;

  const getAgentStatus = (agent: any) => {
    if (typeof agent?.status === 'string' && agent.status.trim()) {
      return agent.status;
    }

    return agent?.isActive ? 'active' : 'inactive';
  };

  const getAgentName = (agent: any) => {
    if (typeof agent?.name === 'string' && agent.name.trim()) {
      return agent.name.trim();
    }

    return [agent?.firstName, agent?.lastName].filter(Boolean).join(' ').trim() || 'Agente sin nombre';
  };

  const getAgentInitial = (agent: any) => getAgentName(agent).charAt(0).toUpperCase();

  const handleToggleStatus = async (agent: any) => {
    const agentStatus = getAgentStatus(agent);
    const agentName = getAgentName(agent);

    try {
      if (agentStatus === 'active') {
        if (window.confirm(`¿Seguro que desea desactivar al agente ${agentName}?`)) {
          await deactivateUser.mutateAsync(agent.id);
        }
      } else {
        await reactivateUser.mutateAsync(agent.id);
      }
    } catch (error) {
      toast.error({ title: 'Error al cambiar el estado del agente' });
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Agentes</h2>
          <p className="text-sm text-text-secondary mt-1">Administrar agentes de campo y asignaciones operativas.</p>
        </div>
        <button className="flex items-center gap-2 bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={16} /> Nuevo Agente
        </button>
      </div>

      <div className="bg-bg-surface rounded-2xl p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input 
              type="text" 
              placeholder="Buscar agentes..." 
              className="bg-bg-base text-sm text-text-primary rounded-lg pl-10 pr-4 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-border-strong border border-border-subtle"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="pb-3 font-medium">ID</th>
                <th className="pb-3 font-medium">Nombre del Agente</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                <tr><td colSpan={5} className="py-4 text-center text-text-secondary">Cargando agentes...</td></tr>
              ) : isError ? (
                <tr><td colSpan={5} className="py-4 text-center text-red-500">Error al cargar agentes.</td></tr>
              ) : agents.length === 0 ? (
                <tr><td colSpan={5} className="py-4 text-center text-text-secondary">No hay agentes registrados.</td></tr>
              ) : (
                agents.map((agent: any) => (
                  <tr key={agent.id} className="hover:bg-hover-bg transition-colors">
                    <td className="py-4 text-text-secondary font-mono">{String(agent.id).substring(0, 8)}</td>
                    <td className="py-4 font-medium flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                        {getAgentInitial(agent)}
                      </div>
                      {getAgentName(agent)}
                    </td>
                    <td className="py-4 text-text-secondary">{agent.email}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded text-xs ${getAgentStatus(agent) === 'active' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                        {getAgentStatus(agent) === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 text-text-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Ver detalles"><Eye size={16} /></button>
                        <button className="p-1.5 text-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors" title="Editar"><Edit size={16} /></button>
                        <button 
                          onClick={() => handleToggleStatus(agent)}
                          className={`p-1.5 rounded-lg transition-colors ${getAgentStatus(agent) === 'active' ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          title={getAgentStatus(agent) === 'active' ? 'Desactivar' : 'Reactivar'}
                        >
                          {getAgentStatus(agent) === 'active' ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {usersData && pagination && (
          <div className="mt-4 flex justify-between items-center text-sm text-text-secondary">
            <div>
              Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, pagination?.totalItems ?? pagination?.total ?? 0)} de {pagination?.totalItems ?? pagination?.total ?? 0} agentes
            </div>
            <div className="flex gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 border border-border-subtle rounded hover:bg-hover-bg disabled:opacity-50"
              >
                Anterior
              </button>
              <button 
                disabled={page === (pagination?.totalPages ?? 1)}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 border border-border-subtle rounded hover:bg-hover-bg disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
