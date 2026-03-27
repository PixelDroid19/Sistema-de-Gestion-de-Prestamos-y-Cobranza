import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Filter, Calendar, ChevronLeft, ChevronRight, Eye, Edit, Trash2, Loader2 } from 'lucide-react';
import { useCustomers } from '../services/customerService';
import { usePaginationStore } from '../store/paginationStore';

export default function Customers({ setCurrentView }: { setCurrentView?: (v: string) => void }) {
  const { page, pageSize: limit, setPage } = usePaginationStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const { data, isLoading, isError } = useCustomers({
    page,
    limit,
    search: searchTerm || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const customers = Array.isArray(data?.data?.customers)
    ? data.data.customers
    : Array.isArray(data?.data)
      ? data.data
      : [];
  const pagination = data?.data?.pagination || data?.meta;
  const totalPages = pagination?.totalPages || 1;
  const totalItems = pagination?.totalItems || pagination?.total || customers.length;

  const formatCustomerId = (value: unknown) => {
    const rawId = value == null ? '' : String(value);
    return rawId ? `CUS-${rawId.slice(0, 8)}` : 'CUS-N/A';
  };

  const formatCreatedAt = (value: unknown) => {
    if (!value) return 'N/A';

    const parsedDate = new Date(value as string | number | Date);
    return Number.isNaN(parsedDate.getTime()) ? 'N/A' : parsedDate.toLocaleDateString();
  };

  const getCustomerName = (customer: any) => {
    if (customer?.name) return customer.name;

    const composedName = [customer?.firstName, customer?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return composedName || customer?.email || `Cliente ${customer?.id}`;
  };

  const handlePrevPage = () => setPage(Math.max(1, page - 1));
  const handleNextPage = () => setPage(Math.min(totalPages, page + 1));

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Clientes</h2>
          <p className="text-sm text-text-secondary mt-1">Administrar repositorio y perfiles de clientes.</p>
        </div>
        <button 
          onClick={() => setCurrentView && setCurrentView('customers-new')}
          className="flex items-center gap-2 bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> Nuevo Cliente
        </button>
      </div>

      <div className="bg-bg-surface rounded-2xl p-5 flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input 
              type="text" 
              placeholder="Buscar clientes..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="bg-bg-base text-sm text-text-primary rounded-lg pl-10 pr-4 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-border-strong border border-border-subtle"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-bg-base border border-border-subtle rounded-lg px-3 py-2">
              <Filter size={14} className="text-text-secondary" />
              <select 
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="bg-transparent text-sm text-text-secondary focus:outline-none cursor-pointer appearance-none pr-4"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="pending">Pendiente</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-bg-base border border-border-subtle rounded-lg px-3 py-2">
              <Calendar size={14} className="text-text-secondary" />
              <select 
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                className="bg-transparent text-sm text-text-secondary focus:outline-none cursor-pointer appearance-none pr-4"
              >
                <option value="all">Todo el tiempo</option>
                <option value="today">Hoy</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mes</option>
                <option value="year">Este año</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-text-secondary" />
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center h-64 text-red-500">
              Error al cargar los clientes.
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-text-secondary">
              <p>No se encontraron clientes.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-text-secondary border-b border-border-subtle">
                <tr>
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Nombre</th>
                  <th className="pb-3 font-medium">Contacto</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Registrado</th>
                  <th className="pb-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-hover-bg transition-colors">
                    <td className="py-4 text-text-secondary">{formatCustomerId(customer?.id)}</td>
                    <td className="py-4 font-medium flex items-center gap-3">
                      <img src={`https://i.pravatar.cc/150?u=${customer.id}`} className="w-8 h-8 rounded-full" alt="avatar" />
                      {getCustomerName(customer)}
                    </td>
                    <td className="py-4 text-text-secondary">{customer.email}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        customer.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 
                        customer.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' : 
                        'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {customer.status === 'active' ? 'Activo' : customer.status === 'pending' ? 'Pendiente' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-4 text-text-secondary">{formatCreatedAt(customer?.createdAt)}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentView && setCurrentView(`customers/${customer.id}`)} className="p-1.5 text-text-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Ver detalles"><Eye size={16} /></button>
                        <button className="p-1.5 text-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors" title="Editar"><Edit size={16} /></button>
                        <button className="p-1.5 text-text-secondary hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && !isError && customers.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-subtle">
            <span className="text-sm text-text-secondary">
              Mostrando {(page - 1) * limit + 1} a {Math.min(page * limit, totalItems)} de {totalItems} registros
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrevPage} 
                disabled={page === 1}
                className="p-2 rounded-lg bg-bg-base border border-border-subtle text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                  if (
                    p === 1 || 
                    p === totalPages || 
                    (p >= page - 1 && p <= page + 1)
                  ) {
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-colors ${
                          page === p 
                            ? 'bg-text-primary text-bg-base font-medium' 
                            : 'text-text-secondary hover:bg-hover-bg hover:text-text-primary'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  } else if (
                    p === page - 2 || 
                    p === page + 2
                  ) {
                    return <span key={p} className="text-text-secondary px-1">...</span>;
                  }
                  return null;
                })}
              </div>
              <button 
                onClick={handleNextPage}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-bg-base border border-border-subtle text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
