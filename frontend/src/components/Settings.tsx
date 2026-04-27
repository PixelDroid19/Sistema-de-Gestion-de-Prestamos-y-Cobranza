import React, { useState } from 'react';
import { Settings2, CreditCard, Save, Shield, Percent, AlertTriangle } from 'lucide-react';
import { useConfig } from '../services/configService';
import { toast } from '../lib/toast';
import { tTerm } from '../i18n/terminology';
import { confirmDanger } from '../lib/confirmModal';
import PermissionsTab from './PermissionsTab';

export default function Settings() {
  const {
    settings,
    paymentMethods,
    ratePolicies,
    lateFeePolicies,
    isLoading,
    updateSetting,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    createRatePolicy,
    updateRatePolicy,
    deleteRatePolicy,
    createLateFeePolicy,
    updateLateFeePolicy,
    deleteLateFeePolicy,
  } = useConfig();
  const [activeTab, setActiveTab] = useState<'general' | 'payment-methods' | 'rate-policies' | 'late-fee-policies' | 'permissions'>('general');
  const [newPaymentMethod, setNewPaymentMethod] = useState({ name: '', description: '', type: 'bank_transfer' });
  const [newRatePolicy, setNewRatePolicy] = useState({
    label: '',
    minAmount: '',
    maxAmount: '',
    annualEffectiveRate: '',
    priority: '100',
    description: '',
  });
  const [newLateFeePolicy, setNewLateFeePolicy] = useState({
    label: '',
    annualEffectiveRate: '',
    lateFeeMode: 'SIMPLE',
    priority: '100',
    description: '',
  });

  const paymentMethodTypeLabels: Record<string, string> = {
    bank_transfer: 'Transferencia bancaria',
    cash: 'Efectivo',
    card: 'Tarjeta',
    other: 'Otro',
  };

  if (isLoading) return <div className="p-8 text-center text-text-secondary">Cargando configuración...</div>;

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      await updateSetting.mutateAsync({ key, value });
      toast.success({ description: 'Configuración actualizada' });
    } catch (error) {
      console.error('[settings] updateSetting failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleCreatePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPaymentMethod.mutateAsync({
        ...newPaymentMethod,
        isActive: true
      });
      setNewPaymentMethod({ name: '', description: '', type: 'bank_transfer' });
      toast.success({ description: 'Método de pago creado' });
    } catch (error) {
      console.error('[settings] createPaymentMethod failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleCreateRatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRatePolicy.mutateAsync({
        ...newRatePolicy,
        annualEffectiveRate: Number(newRatePolicy.annualEffectiveRate),
        minAmount: newRatePolicy.minAmount === '' ? null : Number(newRatePolicy.minAmount),
        maxAmount: newRatePolicy.maxAmount === '' ? null : Number(newRatePolicy.maxAmount),
        priority: Number(newRatePolicy.priority || 100),
        isActive: true,
      });
      setNewRatePolicy({ label: '', minAmount: '', maxAmount: '', annualEffectiveRate: '', priority: '100', description: '' });
      toast.success({ description: 'Política de tasa creada' });
    } catch (error) {
      console.error('[settings] createRatePolicy failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleCreateLateFeePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLateFeePolicy.mutateAsync({
        ...newLateFeePolicy,
        annualEffectiveRate: Number(newLateFeePolicy.annualEffectiveRate),
        priority: Number(newLateFeePolicy.priority || 100),
        isActive: true,
      });
      setNewLateFeePolicy({ label: '', annualEffectiveRate: '', lateFeeMode: 'SIMPLE', priority: '100', description: '' });
      toast.success({ description: 'Política de mora creada' });
    } catch (error) {
      console.error('[settings] createLateFeePolicy failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const formatCurrency = (value: unknown) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

  const getPaymentMethodTypeLabel = (type: unknown) => {
    const normalizedType = String(type || 'other').trim().toLowerCase();
    return paymentMethodTypeLabels[normalizedType] || 'Otro';
  };

  const TabButton = ({
    id,
    icon: Icon,
    label,
  }: {
    id: typeof activeTab;
    icon: React.ElementType;
    label: string;
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
        activeTab === id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 h-full pb-8">
      <div>
        <h2 className="text-2xl font-semibold">Configuración</h2>
        <p className="text-sm text-text-secondary mt-1">Ajustes generales del sistema y métodos de pago.</p>
      </div>

      <div className="flex overflow-x-auto border-b border-border-subtle">
        <TabButton id="general" icon={Settings2} label="Ajustes Generales" />
        <TabButton id="payment-methods" icon={CreditCard} label="Métodos de Pago" />
        <TabButton id="rate-policies" icon={Percent} label="Tasas" />
        <TabButton id="late-fee-policies" icon={AlertTriangle} label="Mora" />
        <TabButton id="permissions" icon={Shield} label="Roles y Permisos" />
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-4 sm:p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h3 className="font-medium text-lg">Parámetros del Sistema</h3>
            <div className="space-y-4 max-w-2xl">
              {settings.map((setting: any) => (
                <div key={setting.key} className="flex flex-col gap-3 py-3 border-b border-border-subtle sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{setting.key}</p>
                    <p className="text-sm text-text-secondary">{setting.description || 'Configuración del sistema'}</p>
                  </div>
                  <input
                    type="text"
                    defaultValue={setting.value}
                    onBlur={(e) => handleUpdateSetting(setting.key, e.target.value)}
                    className="bg-bg-base border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary w-full sm:w-40"
                  />
                </div>
              ))}
              {(!settings || settings.length === 0) && (
                <p className="text-text-secondary">No hay configuraciones disponibles.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'permissions' && (
          <PermissionsTab />
        )}

        {activeTab === 'rate-policies' && (
          <div>
            <h3 className="font-medium text-lg mb-1">Políticas de tasa anual</h3>
            <p className="mb-4 text-sm text-text-secondary">
              Estas políticas son datos formales de operación. Se usan como fuente controlada para alimentar la tasa aplicada en créditos nuevos y pruebas de fórmula.
            </p>

            <form onSubmit={handleCreateRatePolicy} className="mb-8 grid grid-cols-1 gap-4 rounded-xl border border-border-subtle bg-bg-base p-4 lg:grid-cols-6 lg:items-end">
              <div className="lg:col-span-2">
                <label className="block text-xs text-text-secondary mb-1">Nombre</label>
                <input required value={newRatePolicy.label} onChange={e => setNewRatePolicy({ ...newRatePolicy, label: e.target.value })} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="Ej: Crédito estándar" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Monto mínimo</label>
                <input type="number" min="0" value={newRatePolicy.minAmount} onChange={e => setNewRatePolicy({ ...newRatePolicy, minAmount: e.target.value })} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Monto máximo</label>
                <input type="number" min="0" value={newRatePolicy.maxAmount} onChange={e => setNewRatePolicy({ ...newRatePolicy, maxAmount: e.target.value })} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Tasa EA %</label>
                <input required type="number" min="0" max="100" step="0.01" value={newRatePolicy.annualEffectiveRate} onChange={e => setNewRatePolicy({ ...newRatePolicy, annualEffectiveRate: e.target.value })} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary" />
              </div>
              <button type="submit" disabled={createRatePolicy.isPending} className="flex items-center justify-center gap-2 rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50">
                <Save size={16} /> Agregar
              </button>
            </form>

            <div className="overflow-x-auto rounded-xl border border-border-subtle">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="bg-bg-base text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-3">Política</th>
                    <th className="px-4 py-3">Rango</th>
                    <th className="px-4 py-3">Tasa</th>
                    <th className="px-4 py-3">Prioridad</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {ratePolicies.map((policy: any) => (
                    <tr key={policy.id}>
                      <td className="px-4 py-3 font-medium text-text-primary">{policy.label}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {(policy.minAmount || policy.maxAmount)
                          ? `${policy.minAmount ? formatCurrency(policy.minAmount) : '$0'} - ${policy.maxAmount ? formatCurrency(policy.maxAmount) : 'Sin tope'}`
                          : 'Todos los montos'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-text-primary">{policy.annualEffectiveRate}% EA</td>
                      <td className="px-4 py-3 text-text-secondary">{policy.priority}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${policy.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                          {policy.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={async () => {
                              try {
                                await updateRatePolicy.mutateAsync({ id: policy.id, isActive: !policy.isActive });
                                toast.success({ description: policy.isActive ? 'Política de tasa desactivada' : 'Política de tasa activada' });
                              } catch (error) {
                                console.error('[settings] updateRatePolicy failed', error);
                                toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                              }
                            }}
                            className="text-sm font-medium text-brand-primary"
                          >
                            {policy.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            onClick={async () => {
                              const confirmed = await confirmDanger({
                                title: 'Eliminar política de tasa',
                                message: `Se eliminará la política "${policy.label}".`,
                                confirmLabel: 'Eliminar',
                              });
                              if (!confirmed) return;
                              try {
                                await deleteRatePolicy.mutateAsync(policy.id);
                                toast.success({ description: 'Política de tasa eliminada' });
                              } catch (error) {
                                console.error('[settings] deleteRatePolicy failed', error);
                                toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                              }
                            }}
                            className="text-sm font-medium text-red-600"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {ratePolicies.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-text-secondary">No hay políticas de tasa.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'late-fee-policies' && (
          <div>
            <h3 className="font-medium text-lg mb-1">Políticas de mora</h3>
            <p className="mb-4 text-sm text-text-secondary">Define cómo se calcula la mora real sobre cuotas vencidas.</p>

            <form onSubmit={handleCreateLateFeePolicy} className="mb-8 grid grid-cols-1 gap-4 rounded-xl border border-border-subtle bg-bg-base p-4 md:grid-cols-[1fr_160px_180px_120px_auto] md:items-end">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Nombre</label>
                <input required value={newLateFeePolicy.label} onChange={e => setNewLateFeePolicy({ ...newLateFeePolicy, label: e.target.value })} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="Ej: Mora simple estándar" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Tasa EA %</label>
                <input required type="number" min="0" max="100" step="0.01" value={newLateFeePolicy.annualEffectiveRate} onChange={e => setNewLateFeePolicy({ ...newLateFeePolicy, annualEffectiveRate: e.target.value })} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Modo</label>
                <select value={newLateFeePolicy.lateFeeMode} onChange={e => setNewLateFeePolicy({ ...newLateFeePolicy, lateFeeMode: e.target.value })} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary">
                  <option value="SIMPLE">Mora simple</option>
                  <option value="COMPOUND">Mora compuesta</option>
                  <option value="NONE">Sin mora</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Prioridad</label>
                <input type="number" min="0" value={newLateFeePolicy.priority} onChange={e => setNewLateFeePolicy({ ...newLateFeePolicy, priority: e.target.value })} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary" />
              </div>
              <button type="submit" disabled={createLateFeePolicy.isPending} className="flex items-center justify-center gap-2 rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50">
                <Save size={16} /> Agregar
              </button>
            </form>

            <div className="space-y-3">
              {lateFeePolicies.map((policy: any) => (
                <div key={policy.id} className="flex flex-col gap-3 rounded-xl border border-border-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-text-primary">{policy.label}</p>
                    <p className="text-sm text-text-secondary">{policy.annualEffectiveRate}% EA · {policy.lateFeeMode} · Prioridad {policy.priority}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        try {
                          await updateLateFeePolicy.mutateAsync({ id: policy.id, isActive: !policy.isActive });
                          toast.success({ description: policy.isActive ? 'Política de mora desactivada' : 'Política de mora activada' });
                        } catch (error) {
                          console.error('[settings] updateLateFeePolicy failed', error);
                          toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                        }
                      }}
                      className="text-sm font-medium text-brand-primary"
                    >
                      {policy.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={async () => {
                        const confirmed = await confirmDanger({
                          title: 'Eliminar política de mora',
                          message: `Se eliminará la política "${policy.label}".`,
                          confirmLabel: 'Eliminar',
                        });
                        if (!confirmed) return;
                        try {
                          await deleteLateFeePolicy.mutateAsync(policy.id);
                          toast.success({ description: 'Política de mora eliminada' });
                        } catch (error) {
                          console.error('[settings] deleteLateFeePolicy failed', error);
                          toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                        }
                      }}
                      className="text-sm font-medium text-red-600"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              {lateFeePolicies.length === 0 && <p className="text-text-secondary">No hay políticas de mora.</p>}
            </div>
          </div>
        )}

        {activeTab === 'payment-methods' && (
          <div>
            <h3 className="font-medium text-lg mb-4">Métodos de Pago Activos</h3>
            
            <form onSubmit={handleCreatePaymentMethod} className="mb-8 grid grid-cols-1 gap-4 rounded-xl border border-border-subtle bg-bg-base p-4 md:grid-cols-[1fr_220px_auto] md:items-end">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Nombre</label>
                <input required type="text" value={newPaymentMethod.name} onChange={e => setNewPaymentMethod({...newPaymentMethod, name: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="Ej: Transferencia Banco X" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Tipo</label>
                <select value={newPaymentMethod.type} onChange={e => setNewPaymentMethod({...newPaymentMethod, type: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary">
                  <option value="bank_transfer">Transferencia Bancaria</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                </select>
              </div>
              <button type="submit" disabled={createPaymentMethod.isPending} className="flex items-center justify-center gap-2 rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50">
                <Save size={16} /> {createPaymentMethod.isPending ? 'Agregando...' : 'Agregar'}
              </button>
            </form>

            <div className="space-y-3">
              {paymentMethods.map((pm: any) => (
                <div key={pm.id} className="flex flex-col gap-3 p-4 border border-border-subtle rounded-xl sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{pm.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-bg-base px-2 py-1 text-[11px] font-medium text-text-secondary">
                        {getPaymentMethodTypeLabel(pm.type)}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${pm.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                        {pm.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                      {pm.requiresReference && (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
                          Requiere referencia
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={async () => {
                        try {
                          await updatePaymentMethod.mutateAsync({ id: pm.id, isActive: !pm.isActive, type: pm.type });
                          toast.success({ description: pm.isActive ? 'Método de pago desactivado' : 'Método de pago activado' });
                        } catch (error) {
                          console.error('[settings] updatePaymentMethod failed', error);
                          toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                        }
                      }}
                      disabled={updatePaymentMethod.isPending}
                      className="text-left text-sm font-medium text-brand-primary disabled:opacity-50 sm:text-right"
                    >
                      {pm.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button 
                      onClick={async () => {
                        const confirmed = await confirmDanger({
                          title: tTerm('confirm.paymentMethod.delete.title'),
                          message: tTerm('confirm.paymentMethod.delete.message'),
                          confirmLabel: tTerm('confirm.paymentMethod.delete.confirm'),
                        });
                        if (!confirmed) return;
                        try {
                          await deletePaymentMethod.mutateAsync(pm.id);
                          toast.success({ description: 'Método de pago eliminado' });
                        } catch (error) {
                          console.error('[settings] deletePaymentMethod failed', error);
                          toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                        }
                      }}
                      disabled={deletePaymentMethod.isPending}
                      className="text-left text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50 sm:text-right"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              {paymentMethods.length === 0 && (
                <p className="text-text-secondary">No hay métodos de pago disponibles.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
