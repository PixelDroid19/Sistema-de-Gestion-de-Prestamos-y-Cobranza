import React, { useState } from 'react';
import { Settings2, CreditCard, Save, Shield } from 'lucide-react';
import { useConfig } from '../services/configService';
import { toast } from '../lib/toast';
import { tTerm } from '../i18n/terminology';
import { confirmDanger } from '../lib/confirmModal';
import PermissionsTab from './PermissionsTab';

export default function Settings() {
  const { settings, paymentMethods, isLoading, updateSetting, createPaymentMethod, deletePaymentMethod } = useConfig();
  const [activeTab, setActiveTab] = useState<'general' | 'payment-methods' | 'permissions'>('general');
  const [newPaymentMethod, setNewPaymentMethod] = useState({ name: '', description: '', type: 'bank_transfer' });

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

  return (
    <div className="max-w-5xl mx-auto space-y-6 h-full pb-8">
      <div>
        <h2 className="text-2xl font-semibold">Configuración</h2>
        <p className="text-sm text-text-secondary mt-1">Ajustes generales del sistema y métodos de pago.</p>
      </div>

      <div className="flex overflow-x-auto border-b border-border-subtle">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'general' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <Settings2 size={16} /> Ajustes Generales
        </button>
        <button
          onClick={() => setActiveTab('payment-methods')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'payment-methods' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <CreditCard size={16} /> Métodos de Pago
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'permissions' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <Shield size={16} /> Roles y Permisos
        </button>
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
                    <p className="text-xs text-text-secondary uppercase">{pm.type}</p>
                  </div>
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
