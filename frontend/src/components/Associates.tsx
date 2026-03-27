import React from 'react';
import { Plus, Search, MoreVertical, Eye, Edit, Trash2 } from 'lucide-react';
import { useAssociates } from '../services/associateService';
import { usePaginationStore } from '../store/paginationStore';

export default function Associates({ setCurrentView }: { setCurrentView: (v: string) => void }) {
  const { page, setPage, pageSize: limit } = usePaginationStore();
  const { data: associatesData, isLoading, isError } = useAssociates({ page, limit });

  const associates = Array.isArray(associatesData?.data?.associates)
    ? associatesData.data.associates
    : Array.isArray(associatesData?.data)
      ? associatesData.data
      : [];
  const pagination = associatesData?.data?.pagination ?? associatesData?.pagination ?? associatesData?.meta;

  const getAssociateName = (associate: any) => {
    if (typeof associate?.name === 'string' && associate.name.trim()) {
      return associate.name.trim();
    }

    return [associate?.firstName, associate?.lastName].filter(Boolean).join(' ').trim() || 'Socio sin nombre';
  };

  const getAssociateInitials = (associate: any) => {
    return getAssociateName(associate)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Socios</h2>
          <p className="text-sm text-text-secondary mt-1">Administrar socios y sus relaciones con los préstamos.</p>
        </div>
        <button className="flex items-center gap-2 bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={16} /> Nuevo Socio
        </button>
      </div>

      <div className="bg-bg-surface rounded-2xl p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input 
              type="text" 
              placeholder="Buscar socios..." 
              className="bg-bg-base text-sm text-text-primary rounded-lg pl-10 pr-4 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-border-strong border border-border-subtle"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="pb-3 font-medium">ID</th>
                <th className="pb-3 font-medium">Nombre del Socio</th>
                <th className="pb-3 font-medium">Rol</th>
                <th className="pb-3 font-medium">Préstamos Relacionados</th>
                <th className="pb-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                <tr><td colSpan={5} className="py-4 text-center text-text-secondary">Cargando socios...</td></tr>
              ) : isError ? (
                <tr><td colSpan={5} className="py-4 text-center text-red-500">Error al cargar socios.</td></tr>
              ) : associates.length === 0 ? (
                <tr><td colSpan={5} className="py-4 text-center text-text-secondary">No hay socios registrados.</td></tr>
              ) : (
                associates.map((associate: any) => (
                  <tr key={associate.id} className="hover:bg-hover-bg transition-colors">
                    <td className="py-4 text-text-secondary font-mono">{String(associate.id).substring(0, 8)}</td>
                    <td className="py-4 font-medium flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                        {getAssociateInitials(associate)}
                      </div>
                      {getAssociateName(associate)}
                    </td>
                    <td className="py-4 text-text-secondary capitalize">{associate.role || 'socio'}</td>
                    <td className="py-4">{associate.relatedLoans?.length || 0}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentView(`associates/${associate.id}`)} className="p-1.5 text-text-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Ver detalles"><Eye size={16} /></button>
                        <button className="p-1.5 text-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors" title="Editar"><Edit size={16} /></button>
                        <button className="p-1.5 text-text-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {associatesData && pagination && (
          <div className="mt-4 flex justify-between items-center text-sm text-text-secondary">
            <div>
              Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, pagination?.totalItems ?? pagination?.total ?? 0)} de {pagination?.totalItems ?? pagination?.total ?? 0} socios
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
