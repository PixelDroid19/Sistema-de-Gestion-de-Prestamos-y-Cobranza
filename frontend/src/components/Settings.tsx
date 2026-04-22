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
    <div className="max-w-4xl mx-auto space-y-6 h-full pb-8">
      <div>
        <h2 className="text-2xl font-semibold">Configuración</h2>
        <p className="text-sm text-text-secondary mt-1">Ajustes generales del sistema y métodos de pago.</p>
      </div>

      <div className="flex border-b border-border-subtle">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'general' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <Settings2 size={16} /> Ajustes Generales
        </button>
        <button
          onClick={() => setActiveTab('payment-methods')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'payment-methods' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <CreditCard size={16} /> Métodos de Pago
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'permissions' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <Shield size={16} /> Roles y Permisos
        </button>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h3 className="font-medium text-lg">Parámetros del Sistema</h3>
            <div className="space-y-4 max-w-lg">
              {settings.map((setting: any) => (
                <div key={setting.key} className="flex items-center justify-between py-3 border-b border-border-subtle">
                  <div>
                    <p className="font-medium">{setting.key}</p>
                    <p className="text-sm text-text-secondary">{setting.description || 'Configuración del sistema'}</p>
                  </div>
                  <input
                    type="text"
                    defaultValue={setting.value}
                    onBlur={(e) => handleUpdateSetting(setting.key, e.target.value)}
                    className="bg-bg-base border border-border-subtle rounded-lg px-3 py-1.5 text-sm w-32"
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
            
            <form onSubmit={handleCreatePaymentMethod} className="mb-8 p-4 border border-border-subtle bg-bg-base rounded-xl flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs text-text-secondary mb-1">Nombre</label>
                <input required type="text" value={newPaymentMethod.name} onChange={e => setNewPaymentMethod({...newPaymentMethod, name: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="Ej: Transferencia Banco X" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-secondary mb-1">Tipo</label>
                <select value={newPaymentMethod.type} onChange={e => setNewPaymentMethod({...newPaymentMethod, type: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm">
                  <option value="bank_transfer">Transferencia Bancaria</option>
                  <option value="cash">Efectivo</option>
                  <option value="crypto">Criptomoneda</option>
                </select>
              </div>
              <button type="submit" className="bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                <Save size={16} /> Agregar
              </button>
            </form>

            <div className="space-y-3">
              {paymentMethods.map((pm: any) => (
                <div key={pm.id} className="flex justify-between items-center p-4 border border-border-subtle rounded-xl">
                  <div>
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
                      if (confirmed) deletePaymentMethod.mutateAsync(pm.id);
                    }}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
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
