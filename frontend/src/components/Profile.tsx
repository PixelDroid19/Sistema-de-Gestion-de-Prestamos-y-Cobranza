import React, { useState, useEffect } from 'react';
import { User, Lock, Save, Shield } from 'lucide-react';
import { useAuth } from '../services/authService';
import { useSessionStore } from '../store/sessionStore';
import { toast } from '../lib/toast';

export default function Profile() {
  const { profile, updateProfile, changePassword } = useAuth();
  const { user } = useSessionStore();
  const [activeTab, setActiveTab] = useState<'info' | 'security'>('info');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
      });
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync(formData);
      toast.success({ description: 'Perfil actualizado correctamente' });
    } catch (error) {
      console.error('[profile] updateProfile failed', error);
      toast.apiErrorSafe(error, { domain: 'auth', action: 'profile.update' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.warning({ description: 'Las contraseñas nuevas no coinciden' });
      return;
    }
    try {
      await changePassword.mutateAsync({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success({ description: 'Contraseña actualizada correctamente' });
    } catch (error) {
      console.error('[profile] changePassword failed', error);
      toast.apiErrorSafe(error, { domain: 'auth', action: 'password.change' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 h-full pb-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary">
          <User size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Mi Perfil</h2>
          <p className="text-sm text-text-secondary mt-1">Administra tu información personal y seguridad.</p>
        </div>
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-bg-surface border border-border-subtle rounded-lg text-sm">
          <Shield size={16} className="text-emerald-500" />
          <span className="font-medium capitalize">{user?.role || 'Usuario'}</span>
        </div>
      </div>

      <div className="flex border-b border-border-subtle">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'info' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <User size={16} /> Información Personal
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'security' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary'
          }`}
        >
          <Lock size={16} /> Seguridad
        </button>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
        {activeTab === 'info' && (
          <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Nombre</label>
                <input 
                  type="text" 
                  value={formData.firstName}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Apellido</label>
                <input 
                  type="text" 
                  value={formData.lastName}
                  onChange={e => setFormData({...formData, lastName: e.target.value})}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Correo Electrónico</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2" 
              />
            </div>
            <div className="pt-4">
              <button type="submit" disabled={updateProfile.isPending} className="bg-text-primary text-bg-base px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90">
                <Save size={16} /> Guardar Cambios
              </button>
            </div>
          </form>
        )}

        {activeTab === 'security' && (
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Contraseña Actual</label>
              <input 
                type="password" 
                required
                value={passwordData.currentPassword}
                onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})}
                className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Nueva Contraseña</label>
              <input 
                type="password" 
                required
                value={passwordData.newPassword}
                onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Confirmar Nueva Contraseña</label>
              <input 
                type="password" 
                required
                value={passwordData.confirmPassword}
                onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-2" 
              />
            </div>
            <div className="pt-4">
              <button type="submit" disabled={changePassword.isPending} className="bg-text-primary text-bg-base px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90">
                <Lock size={16} /> Actualizar Contraseña
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
