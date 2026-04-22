import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Loader2 } from 'lucide-react';
import dagService from '../services/dagService';
import { queryKeys } from '../services/queryKeys';
import { DagVariable } from '../types/dag';

export default function VariableRegistryPage() {
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { data: variablesData, isLoading } = useQuery({
    queryKey: queryKeys.dag.variables(),
    queryFn: () => dagService.listVariables(),
  });

  const variables = variablesData?.data?.variables ?? [];

  const filtered = variables.filter((v: DagVariable) => {
    if (filterType !== 'all' && v.type !== filterType) return false;
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Variable Registry</h1>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors">
          <Plus size={16} />
          New Variable
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search variables..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-subtle bg-bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-surface text-sm text-text-primary"
        >
          <option value="all">All Types</option>
          <option value="integer">Integer</option>
          <option value="currency">Currency</option>
          <option value="boolean">Boolean</option>
          <option value="float">Float</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-surface text-sm text-text-primary"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="idle">Idle</option>
          <option value="deprecated">Deprecated</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-bg-surface border-b border-border-subtle">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Name</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Type</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Source</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Status</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Usage</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <Loader2 className="animate-spin mx-auto text-brand-primary" size={24} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  No variables found matching your filters.
                </td>
              </tr>
            ) : (
              filtered.map((v: DagVariable) => (
                <tr
                  key={v.id}
                  className={`hover:bg-hover-bg/50 transition-colors ${v.status === 'deprecated' ? 'bg-error-container/10' : ''}`}
                >
                  <td className={`px-4 py-3 font-mono font-medium ${v.status === 'deprecated' ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                    {v.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-bg-base border border-border-subtle text-xs text-text-secondary">{v.type}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{v.source}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        v.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : v.status === 'deprecated'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{v.usageCount}</td>
                  <td className="px-4 py-3 text-text-secondary">{v.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
