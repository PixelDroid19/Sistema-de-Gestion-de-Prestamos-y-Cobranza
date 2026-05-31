import React, { useState, useEffect } from 'react';
import { User, Lock, Save, Shield } from 'lucide-react';
import { getRoleLabel } from '../constants/appShell';
import { useTranslation } from '../i18n';
import { useAuth } from '../services/authService';
import { useSessionStore } from '../store/sessionStore';
import { toast } from '../lib/toast';
import { reportClientError } from '../lib/clientDiagnostics';
import { ActionButton, FormField, PageHeader, PageShell, SectionSurface, TextInput, ViewTabs } from './shared/Surfaces';

export default function Profile() {
  const { profile, updateProfile, changePassword } = useAuth();
  const { t } = useTranslation();
  const { user } = useSessionStore();
  const [activeTab, setActiveTab] = useState<'info' | 'security'>('info');

  const [formData, setFormData] = useState({
    name: '',
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
        name: profile.name || user?.name || '',
        email: profile.email || '',
      });
    }
  }, [profile, user?.name]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.warning({ description: t('profile.toast.nameRequired') });
      return;
    }
    try {
      await updateProfile.mutateAsync({
        name: formData.name.trim(),
        email: formData.email.trim(),
      });
      toast.success({ description: t('profile.toast.updated') });
    } catch (error) {
      reportClientError('profile.update', error);
      toast.apiErrorSafe(error, { domain: 'auth', action: 'profile.update' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.warning({ description: t('profile.toast.passwordMismatch') });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      toast.warning({ description: t('profile.toast.passwordShort') });
      return;
    }
    try {
      await changePassword.mutateAsync({
        currentPassword: passwordData.currentPassword,
        nextPassword: passwordData.newPassword
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success({ description: t('profile.toast.passwordUpdated') });
    } catch (error) {
      reportClientError('profile.passwordChange', error);
      toast.apiErrorSafe(error, { domain: 'auth', action: 'password.change' });
    }
  };

  return (
    <PageShell className="mx-auto max-w-4xl" data-tour="profile-page">
      <PageHeader
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
        guideKey="profile"
        tourId="profile-header"
        actions={(
          <div className="flex w-fit items-center gap-2 px-3 py-1.5 bg-bg-surface border border-border-subtle rounded-lg text-sm">
            <Shield size={16} className="text-emerald-500" />
            <span className="font-medium">{getRoleLabel(user?.role)}</span>
          </div>
        )}
      />

      <ViewTabs
        data-tour="profile-tabs"
        ariaLabel={t('profile.tabs.aria')}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
        tabs={[
          { id: 'info', label: t('profile.tabs.info'), icon: User },
          { id: 'security', label: t('profile.tabs.security'), icon: Lock },
        ]}
      />

      <SectionSurface data-tour="profile-content">
        {activeTab === 'info' && (
          <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
            <FormField label={t('profile.fields.name')}>
              <TextInput
                id="profile-name"
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </FormField>
            <FormField label={t('profile.fields.email')}>
              <TextInput
                id="profile-email"
                type="text"
                inputMode="email"
                required
                value={formData.email}
                onChange={e => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              />
            </FormField>
            <div className="rounded-xl border border-border-subtle bg-bg-base px-4 py-3 text-sm text-text-secondary">
              {t('profile.adminNotice')}
            </div>
            <div className="pt-4">
              <ActionButton type="submit" disabled={updateProfile.isPending} isLoading={updateProfile.isPending} icon={<Save size={16} />} variant="primary">
                {t('profile.actions.save')}
              </ActionButton>
            </div>
          </form>
        )}

        {activeTab === 'security' && (
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            <FormField label={t('profile.fields.currentPassword')}>
              <TextInput
                id="profile-current-password"
                type="password"
                required
                value={passwordData.currentPassword}
                onChange={e => setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))}
              />
            </FormField>
            <FormField label={t('profile.fields.newPassword')}>
              <TextInput
                id="profile-new-password"
                type="password"
                required
                value={passwordData.newPassword}
                onChange={e => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
              />
            </FormField>
            <FormField label={t('profile.fields.confirmPassword')}>
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
                {t('profile.actions.updatePassword')}
              </ActionButton>
            </div>
          </form>
        )}
      </SectionSurface>
    </PageShell>
  );
}
