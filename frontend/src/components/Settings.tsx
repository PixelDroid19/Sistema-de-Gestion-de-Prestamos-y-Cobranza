import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings2, CreditCard, Save, Shield, Percent, AlertTriangle, GitBranch } from 'lucide-react';
import { useConfig } from '../services/configService';
import { toast } from '../lib/toast';
import { tTerm } from '../i18n/terminology';
import { confirmDanger } from '../lib/confirmModal';
import PermissionsTab from './PermissionsTab';

export default function Settings() {
  const navigate = useNavigate();
  const { settings, paymentMethods, tnaRates, lateFeePolicies, isLoading, updateSetting, createPaymentMethod, deletePaymentMethod, createTnaRate, updateTnaRate, deleteTnaRate, createLateFeePolicy, updateLateFeePolicy, deleteLateFeePolicy } = useConfig();
  const [activeTab, setActiveTab] = useState<'general' | 'payment-methods' | 'permissions' | 'tna-rates' | 'late-fees' | 'formula-workbench'>('general');
  const [newPaymentMethod, setNewPaymentMethod] = useState({ name: '', description: '', type: 'bank_transfer' });
  const [newTnaRate, setNewTnaRate] = useState({ key: '', label: '', value: '', minValue: '', maxValue: '', effectiveDate: '', description: '' });
  const [editingTnaRate, setEditingTnaRate] = useState<any>(null);
  const [newLateFee, setNewLateFee] = useState({ key: '', label: '', gracePeriodDays: '', penaltyRate: '', penaltyType: 'percentage', maxPenaltyAmount: '', description: '' });
  const [editingLateFee, setEditingLateFee] = useState<any>(null);

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

  const handleCreateTnaRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTnaRate.mutateAsync({
        ...newTnaRate,
        value: newTnaRate.value,
        minValue: newTnaRate.minValue || null,
        maxValue: newTnaRate.maxValue || null,
      });
      setNewTnaRate({ key: '', label: '', value: '', minValue: '', maxValue: '', effectiveDate: '', description: '' });
      toast.success({ description: 'Tasa TNA creada' });
    } catch (error) {
      console.error('[settings] createTnaRate failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleUpdateTnaRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTnaRate) return;
    try {
      await updateTnaRate.mutateAsync({
        id: editingTnaRate.id,
        label: editingTnaRate.label,
        value: editingTnaRate.value,
        minValue: editingTnaRate.minValue || null,
        maxValue: editingTnaRate.maxValue || null,
        effectiveDate: editingTnaRate.effectiveDate || null,
        description: editingTnaRate.description,
        isActive: editingTnaRate.isActive,
      });
      setEditingTnaRate(null);
      toast.success({ description: 'Tasa TNA actualizada' });
    } catch (error) {
      console.error('[settings] updateTnaRate failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleCreateLateFeePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLateFeePolicy.mutateAsync({
        ...newLateFee,
        gracePeriodDays: Number(newLateFee.gracePeriodDays) || 0,
        penaltyRate: Number(newLateFee.penaltyRate) || 0,
        maxPenaltyAmount: newLateFee.maxPenaltyAmount ? Number(newLateFee.maxPenaltyAmount) : null,
      });
      setNewLateFee({ key: '', label: '', gracePeriodDays: '', penaltyRate: '', penaltyType: 'percentage', maxPenaltyAmount: '', description: '' });
      toast.success({ description: 'Política de mora creada' });
    } catch (error) {
      console.error('[settings] createLateFeePolicy failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleUpdateLateFeePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLateFee) return;
    try {
      await updateLateFeePolicy.mutateAsync({
        id: editingLateFee.id,
        label: editingLateFee.label,
        gracePeriodDays: Number(editingLateFee.gracePeriodDays) || 0,
        penaltyRate: Number(editingLateFee.penaltyRate) || 0,
        penaltyType: editingLateFee.penaltyType,
        maxPenaltyAmount: editingLateFee.maxPenaltyAmount ? Number(editingLateFee.maxPenaltyAmount) : null,
        description: editingLateFee.description,
        isActive: editingLateFee.isActive,
      });
      setEditingLateFee(null);
      toast.success({ description: 'Política de mora actualizada' });
    } catch (error) {
      console.error('[settings] updateLateFeePolicy failed', error);
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
        <button
          onClick={() => setActiveTab('tna-rates')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'tna-rates' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <Percent size={16} /> TNA
        </button>
        <button
          onClick={() => setActiveTab('late-fees')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'late-fees' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <AlertTriangle size={16} /> Multas por Mora
        </button>
        <button
          onClick={() => setActiveTab('formula-workbench')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'formula-workbench' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <GitBranch size={16} /> Fórmulas y Nodos
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

        {activeTab === 'tna-rates' && (
          <div>
            <h3 className="font-medium text-lg mb-4">Tasas Nominales Anuales (TNA)</h3>
            
            <form onSubmit={editingTnaRate ? handleUpdateTnaRate : handleCreateTnaRate} className="mb-8 p-4 border border-border-subtle bg-bg-base rounded-xl flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-text-secondary mb-1">Clave</label>
                <input required type="text" disabled={!!editingTnaRate} value={editingTnaRate ? editingTnaRate.key : newTnaRate.key} onChange={e => editingTnaRate ? setEditingTnaRate({...editingTnaRate, key: e.target.value}) : setNewTnaRate({...newTnaRate, key: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="Ej: tna-12-meses" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-text-secondary mb-1">Nombre</label>
                <input required type="text" value={editingTnaRate ? editingTnaRate.label : newTnaRate.label} onChange={e => editingTnaRate ? setEditingTnaRate({...editingTnaRate, label: e.target.value}) : setNewTnaRate({...newTnaRate, label: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="Ej: TNA 12 meses" />
              </div>
              <div className="flex-1 min-w-[80px]">
                <label className="block text-xs text-text-secondary mb-1">Tasa (%)</label>
                <input required type="number" step="0.01" value={editingTnaRate ? editingTnaRate.value : newTnaRate.value} onChange={e => editingTnaRate ? setEditingTnaRate({...editingTnaRate, value: e.target.value}) : setNewTnaRate({...newTnaRate, value: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="12.00" />
              </div>
              <div className="flex-1 min-w-[80px]">
                <label className="block text-xs text-text-secondary mb-1">Min (%)</label>
                <input type="number" step="0.01" value={editingTnaRate ? editingTnaRate.minValue ?? '' : newTnaRate.minValue} onChange={e => editingTnaRate ? setEditingTnaRate({...editingTnaRate, minValue: e.target.value}) : setNewTnaRate({...newTnaRate, minValue: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="0" />
              </div>
              <div className="flex-1 min-w-[80px]">
                <label className="block text-xs text-text-secondary mb-1">Max (%)</label>
                <input type="number" step="0.01" value={editingTnaRate ? editingTnaRate.maxValue ?? '' : newTnaRate.maxValue} onChange={e => editingTnaRate ? setEditingTnaRate({...editingTnaRate, maxValue: e.target.value}) : setNewTnaRate({...newTnaRate, maxValue: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="100" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-text-secondary mb-1">Fecha Vigencia</label>
                <input type="date" value={editingTnaRate ? editingTnaRate.effectiveDate ?? '' : newTnaRate.effectiveDate} onChange={e => editingTnaRate ? setEditingTnaRate({...editingTnaRate, effectiveDate: e.target.value}) : setNewTnaRate({...newTnaRate, effectiveDate: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs text-text-secondary mb-1">Descripción</label>
                <input type="text" value={editingTnaRate ? editingTnaRate.description : newTnaRate.description} onChange={e => editingTnaRate ? setEditingTnaRate({...editingTnaRate, description: e.target.value}) : setNewTnaRate({...newTnaRate, description: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="Descripción opcional" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                  <Save size={16} /> {editingTnaRate ? 'Actualizar' : 'Agregar'}
                </button>
                {editingTnaRate && (
                  <button type="button" onClick={() => setEditingTnaRate(null)} className="bg-bg-base border border-border-subtle text-text-secondary px-4 py-2 rounded-lg text-sm font-medium">
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-3">
              {tnaRates.map((rate: any) => (
                <div key={rate.id} className="flex justify-between items-center p-4 border border-border-subtle rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{rate.label}</p>
                      <span className="text-xs bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded">{rate.value}%</span>
                      {!rate.isActive && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Inactivo</span>}
                    </div>
                    <p className="text-xs text-text-secondary">Clave: {rate.key} | Min: {rate.minValue ?? '-'}% | Max: {rate.maxValue ?? '-'}% | Vigencia: {rate.effectiveDate || 'Sin fecha'}</p>
                    {rate.description && <p className="text-xs text-text-secondary mt-1">{rate.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingTnaRate(rate)} className="text-brand-primary hover:text-brand-primary/80 text-sm font-medium">Editar</button>
                    <button 
                      onClick={async () => {
                        const confirmed = await confirmDanger({
                          title: tTerm('confirm.tnaRate.delete.title'),
                          message: tTerm('confirm.tnaRate.delete.message'),
                          confirmLabel: tTerm('confirm.tnaRate.delete.confirm'),
                        });
                        if (confirmed) deleteTnaRate.mutateAsync(rate.id);
                      }}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              {tnaRates.length === 0 && (
                <p className="text-text-secondary">No hay tasas TNA configuradas.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'late-fees' && (
          <div>
            <h3 className="font-medium text-lg mb-4">Políticas de Multas por Mora</h3>
            
            <form onSubmit={editingLateFee ? handleUpdateLateFeePolicy : handleCreateLateFeePolicy} className="mb-8 p-4 border border-border-subtle bg-bg-base rounded-xl flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-text-secondary mb-1">Clave</label>
                <input required type="text" disabled={!!editingLateFee} value={editingLateFee ? editingLateFee.key : newLateFee.key} onChange={e => editingLateFee ? setEditingLateFee({...editingLateFee, key: e.target.value}) : setNewLateFee({...newLateFee, key: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="Ej: mora-30-dias" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-text-secondary mb-1">Nombre</label>
                <input required type="text" value={editingLateFee ? editingLateFee.label : newLateFee.label} onChange={e => editingLateFee ? setEditingLateFee({...editingLateFee, label: e.target.value}) : setNewLateFee({...newLateFee, label: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="Ej: Mora 30 días" />
              </div>
              <div className="flex-1 min-w-[80px]">
                <label className="block text-xs text-text-secondary mb-1">Días de Gracia</label>
                <input required type="number" value={editingLateFee ? editingLateFee.gracePeriodDays : newLateFee.gracePeriodDays} onChange={e => editingLateFee ? setEditingLateFee({...editingLateFee, gracePeriodDays: e.target.value}) : setNewLateFee({...newLateFee, gracePeriodDays: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="0" />
              </div>
              <div className="flex-1 min-w-[80px]">
                <label className="block text-xs text-text-secondary mb-1">Tasa (%)</label>
                <input required type="number" step="0.01" value={editingLateFee ? editingLateFee.penaltyRate : newLateFee.penaltyRate} onChange={e => editingLateFee ? setEditingLateFee({...editingLateFee, penaltyRate: e.target.value}) : setNewLateFee({...newLateFee, penaltyRate: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="5.00" />
              </div>
              <div className="flex-1 min-w-[100px]">
                <label className="block text-xs text-text-secondary mb-1">Tipo</label>
                <select value={editingLateFee ? editingLateFee.penaltyType : newLateFee.penaltyType} onChange={e => editingLateFee ? setEditingLateFee({...editingLateFee, penaltyType: e.target.value}) : setNewLateFee({...newLateFee, penaltyType: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm">
                  <option value="percentage">Porcentaje</option>
                  <option value="fixed">Fijo</option>
                </select>
              </div>
              <div className="flex-1 min-w-[80px]">
                <label className="block text-xs text-text-secondary mb-1">Máximo</label>
                <input type="number" step="0.01" value={editingLateFee ? editingLateFee.maxPenaltyAmount ?? '' : newLateFee.maxPenaltyAmount} onChange={e => editingLateFee ? setEditingLateFee({...editingLateFee, maxPenaltyAmount: e.target.value}) : setNewLateFee({...newLateFee, maxPenaltyAmount: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="Opcional" />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs text-text-secondary mb-1">Descripción</label>
                <input type="text" value={editingLateFee ? editingLateFee.description : newLateFee.description} onChange={e => editingLateFee ? setEditingLateFee({...editingLateFee, description: e.target.value}) : setNewLateFee({...newLateFee, description: e.target.value})} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm" placeholder="Descripción opcional" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-text-primary text-bg-base px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                  <Save size={16} /> {editingLateFee ? 'Actualizar' : 'Agregar'}
                </button>
                {editingLateFee && (
                  <button type="button" onClick={() => setEditingLateFee(null)} className="bg-bg-base border border-border-subtle text-text-secondary px-4 py-2 rounded-lg text-sm font-medium">
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-3">
              {lateFeePolicies.map((policy: any) => (
                <div key={policy.id} className="flex justify-between items-center p-4 border border-border-subtle rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{policy.label}</p>
                      <span className="text-xs bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded">{policy.penaltyRate}% {policy.penaltyType === 'percentage' ? 'TNA' : 'fijo'}</span>
                      <span className="text-xs bg-text-secondary/10 text-text-secondary px-2 py-0.5 rounded">Gracia: {policy.gracePeriodDays}d</span>
                      {!policy.isActive && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Inactivo</span>}
                    </div>
                    <p className="text-xs text-text-secondary">Clave: {policy.key} | Máximo: {policy.maxPenaltyAmount ?? 'Sin límite'}</p>
                    {policy.description && <p className="text-xs text-text-secondary mt-1">{policy.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingLateFee(policy)} className="text-brand-primary hover:text-brand-primary/80 text-sm font-medium">Editar</button>
                    <button 
                      onClick={async () => {
                        const confirmed = await confirmDanger({
                          title: tTerm('confirm.lateFeePolicy.delete.title'),
                          message: tTerm('confirm.lateFeePolicy.delete.message'),
                          confirmLabel: tTerm('confirm.lateFeePolicy.delete.confirm'),
                        });
                        if (confirmed) deleteLateFeePolicy.mutateAsync(policy.id);
                      }}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              {lateFeePolicies.length === 0 && (
                <p className="text-text-secondary">No hay políticas de mora configuradas.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'formula-workbench' && (
          <div>
            <h3 className="font-medium text-lg mb-4">Workbench de Fórmulas</h3>

            <div className="rounded-2xl border border-border-subtle bg-bg-base p-6 space-y-5">
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">
                  La edición de nodos y fórmulas vive en un único lugar para evitar duplicaciones entre frontend y backend.
                </p>
                <p className="text-sm text-text-secondary">
                  Cada guardado crea una nueva versión, las fórmulas usadas por créditos existentes no se eliminan y solo la versión activa aplica a créditos nuevos.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">Versionado</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Las fórmulas se guardan como versiones nuevas para conservar trazabilidad histórica.
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">Rollout seguro</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Activar una versión cambia únicamente la originación futura, nunca recalcula créditos existentes.
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">Historial de uso</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Las versiones con créditos asociados quedan protegidas contra borrado para mantener consistencia operativa.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/credits#workbench')}
                  className="inline-flex items-center gap-2 rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-bg-base hover:opacity-90"
                >
                  <GitBranch size={16} />
                  Abrir Workbench DAG
                </button>
                <p className="text-xs text-text-secondary">
                  Ruta recomendada: Operación de créditos → Workbench DAG.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
