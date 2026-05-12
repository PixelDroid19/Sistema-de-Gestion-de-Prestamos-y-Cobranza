import React, { useState, useEffect } from 'react';
import { User, Lock, Save, Shield } from 'lucide-react';
import { useAuth } from '../services/authService';
import { useSessionStore } from '../store/sessionStore';
import { toast } from '../lib/toast';
import { ActionButton, FormField, PageHeader, PageShell, SectionSurface, TextInput, ViewTabs } from './shared/Surfaces';

export default function Profile() {
  const { profile, updateProfile, changePassword } = useAuth();
  const { user } = useSessionStore();
  const [activeTab, setActiveTab] = useState<'info' | 'security'>('info');
  const supportsPhoneProfile = user?.role === 'customer' || user?.role === 'socio';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || user?.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
      });
    }
  }, [profile, user?.name]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.warning({ description: 'El nombre es obligatorio' });
      return;
    }
    try {
      await updateProfile.mutateAsync({
        name: formData.name.trim(),
        email: formData.email.trim(),
        ...(supportsPhoneProfile ? { phone: formData.phone.trim() } : {}),
      });
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
    if (passwordData.newPassword.length < 8) {
      toast.warning({ description: 'La nueva contraseña debe tener al menos 8 caracteres' });
      return;
    }
    try {
      await changePassword.mutateAsync({
        currentPassword: passwordData.currentPassword,
        nextPassword: passwordData.newPassword
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success({ description: 'Contraseña actualizada correctamente' });
    } catch (error) {
      console.error('[profile] changePassword failed', error);
      toast.apiErrorSafe(error, { domain: 'auth', action: 'password.change' });
    }
  };

  return (
    <PageShell className="mx-auto max-w-4xl" data-tour="profile-page">
      <PageHeader
        title="Mi perfil"
        subtitle="Administra tu información personal y seguridad."
        guideKey="profile"
        tourId="profile-header"
        actions={(
          <div className="flex w-fit items-center gap-2 px-3 py-1.5 bg-bg-surface border border-border-subtle rounded-lg text-sm">
            <Shield size={16} className="text-emerald-500" />
            <span className="font-medium capitalize">{user?.role || 'Usuario'}</span>
          </div>
        )}
      />

      <ViewTabs
        data-tour="profile-tabs"
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
        tabs={[
          { id: 'info', label: 'Información personal', icon: User },
          { id: 'security', label: 'Seguridad', icon: Lock },
        ]}
      />

      <SectionSurface data-tour="profile-content">
        {activeTab === 'info' && (
          <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
            <FormField label="Nombre completo">
              <TextInput
                id="profile-name"
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </FormField>
            <FormField label="Correo electrónico">
              <TextInput
                id="profile-email"
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              />
            </FormField>
            {supportsPhoneProfile ? (
              <FormField label="Teléfono">
                <TextInput
                  id="profile-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </FormField>
            ) : (
              <div className="rounded-xl border border-border-subtle bg-bg-base px-4 py-3 text-sm text-text-secondary">
                Este perfil usa solo nombre y correo. El teléfono aplica para clientes y socios.
              </div>
            )}
            <div className="pt-4">
              <ActionButton type="submit" disabled={updateProfile.isPending} isLoading={updateProfile.isPending} icon={<Save size={16} />} variant="primary">
                Guardar cambios
              </ActionButton>
            </div>
          </form>
        )}

        {activeTab === 'security' && (
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            <FormField label="Contraseña actual">
              <TextInput
                id="profile-current-password"
                type="password"
                required
                value={passwordData.currentPassword}
                onChange={e => setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))}
              />
            </FormField>
            <FormField label="Nueva contraseña">
              <TextInput
                id="profile-new-password"
                type="password"
                required
                value={passwordData.newPassword}
                onChange={e => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
              />
            </FormField>
            <FormField label="Confirmar nueva contraseña">
              <TextInput
                id="profile-confirm-password"
                type="password"
                required
                value={passwordData.confirmPassword}
                onChange={e => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </FormField>
            <div className="pt-4">
              <ActionButton type="submit" disabled={changePassword.isPending} isLoading={changePassword.isPending} icon={<Lock size={16} />} variant="primary">
                Actualizar contraseña
              </ActionButton>
            </div>
          </form>
        )}
      </SectionSurface>
    </PageShell>
  );
}
