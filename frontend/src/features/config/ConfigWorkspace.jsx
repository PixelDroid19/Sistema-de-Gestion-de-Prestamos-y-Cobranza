import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PaginationControls from '@/components/ui/PaginationControls';
import StatePanel from '@/components/ui/StatePanel';
import FormSection from '@/components/ui/workspace/FormSection';
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard';
import EmptyState from '@/components/ui/workspace/EmptyState';
import DataTable from '@/components/ui/workspace/DataTable';
import StatCard from '@/components/ui/workspace/StatCard';
import { useProfileQuery } from '@/hooks/useAuth';
import {
  useDeactivateUserMutation,
  useReactivateUserMutation,
  useUpdateUserMutation,
  useUsersQuery,
} from '@/hooks/useUsers';
import { handleApiError } from '@/lib/api/errors';
import {
  useConfigCatalogsQuery,
  useConfigSettingsQuery,
  useCreatePaymentMethodMutation,
  useDeletePaymentMethodMutation,
  usePaymentMethodsQuery,
  useSaveConfigSettingMutation,
  useUpdatePaymentMethodMutation,
} from '@/hooks/useConfig';
import { useChangePasswordMutation } from '@/hooks/useAuth';
import { normalizeApplicationRole } from '@/utils/applicationRole';

const EMPTY_PAYMENT_METHOD = {
  id: null,
  label: '',
  key: '',
  description: '',
  requiresReference: false,
  isActive: true,
};

const DEFAULT_SETTINGS = {
  companyName: {
    label: 'Nombre de la compania',
    description: 'Visible en encabezados internos y exportes.',
    value: '',
  },
  defaultCurrency: {
    label: 'Moneda por defecto',
    description: 'Moneda operativa para creditos y reportes.',
    value: 'COP',
  },
  supportEmail: {
    label: 'Correo de soporte',
    description: 'Contacto para clientes y socios.',
    value: '',
  },
};

const DEFAULT_USERS_PAGINATION = {
  page: 1,
  pageSize: 10,
};

const ROLE_PERMISSION_COPY = {
  admin: {
    label: 'Administrador',
    permissions: 'Gestiona configuracion, usuarios, clientes, creditos, pagos y reportes.',
  },
  customer: {
    label: 'Cliente',
    permissions: 'Solicita creditos, consulta su informacion y registra pagos sobre su propia cuenta.',
  },
  socio: {
    label: 'Socio',
    permissions: 'Consulta portal, rentabilidad y movimientos vinculados a su perfil de inversion.',
  },
};

function getEffectiveRole(role) {
  const normalizedRole = normalizeApplicationRole(role);
  if (normalizedRole) {
    return normalizedRole;
  }

  const fallbackRole = String(role || '').trim().toLowerCase();
  return fallbackRole || null;
}

function ConfigWorkspace({ user }) {
  const { t } = useTranslation();
  const isAdmin = user?.role === 'admin';

  const paymentMethodsQuery = usePaymentMethodsQuery({ enabled: isAdmin });
  const settingsQuery = useConfigSettingsQuery({ enabled: isAdmin });
  const catalogsQuery = useConfigCatalogsQuery({ enabled: isAdmin });
  const profileQuery = useProfileQuery({ enabled: isAdmin });
  const [usersPagination, setUsersPagination] = useState(DEFAULT_USERS_PAGINATION);
  const usersQuery = useUsersQuery({ enabled: isAdmin, pagination: usersPagination });
  const createPaymentMethodMutation = useCreatePaymentMethodMutation();
  const updatePaymentMethodMutation = useUpdatePaymentMethodMutation();
  const deletePaymentMethodMutation = useDeletePaymentMethodMutation();
  const saveSettingMutation = useSaveConfigSettingMutation();
  const changePasswordMutation = useChangePasswordMutation();
  const updateUserMutation = useUpdateUserMutation();
  const deactivateUserMutation = useDeactivateUserMutation();
  const reactivateUserMutation = useReactivateUserMutation();

  const [paymentMethodForm, setPaymentMethodForm] = useState(EMPTY_PAYMENT_METHOD);
  const [settingsDraft, setSettingsDraft] = useState({});
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', nextPassword: '', confirmPassword: '' });
  const [editingUserId, setEditingUserId] = useState(null);
  const [userRoleDraft, setUserRoleDraft] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const paymentMethods = paymentMethodsQuery.data?.data?.paymentMethods || [];
  const settings = settingsQuery.data?.data?.settings || [];
  const catalogs = catalogsQuery.data?.data?.catalogs || {};
  const profile = profileQuery.data?.data?.user || user;
  const users = usersQuery.data?.items || usersQuery.data?.data?.users || [];
  const usersPaginationMeta = usersQuery.data?.pagination || usersQuery.data?.data?.pagination || null;
  const roleOptions = Array.from(new Set((catalogs.roles || ['admin', 'customer', 'socio'])
    .map((role) => getEffectiveRole(role))
    .filter(Boolean)));
  const currentUserId = Number(profile?.id || user?.id);

  useEffect(() => {
    if (!settings.length) {
      setSettingsDraft(DEFAULT_SETTINGS);
      return;
    }

    setSettingsDraft(settings.reduce((acc, setting) => {
      acc[setting.key] = {
        label: setting.label,
        description: setting.description,
        value: setting.value ?? '',
      };
      return acc;
    }, { ...DEFAULT_SETTINGS }));
  }, [settings]);

  const summaryCards = useMemo(() => [
    {
      label: 'Metodos de pago',
      value: paymentMethods.length,
      caption: 'Catalogo activo para registrar pagos y documentos.',
      tone: 'brand',
    },
    {
      label: 'Metodos activos',
      value: paymentMethods.filter((method) => method.isActive).length,
      caption: 'Disponibles inmediatamente para el equipo.',
      tone: 'success',
    },
    {
      label: 'Configuraciones base',
      value: Object.keys(settingsDraft || {}).length,
      caption: 'Parametros minimos del workspace compartido.',
      tone: 'info',
    },
    {
      label: 'Usuarios visibles',
      value: usersPaginationMeta?.totalItems ?? users.length,
      caption: 'Cuentas administrables bajo el modelo actual de roles.',
      tone: 'warning',
    },
  ], [paymentMethods, settingsDraft, users.length, usersPaginationMeta?.totalItems]);

  const rolePermissionCards = useMemo(() => roleOptions.map((role) => ({
    role,
    label: ROLE_PERMISSION_COPY[role]?.label || role,
    permissions: ROLE_PERMISSION_COPY[role]?.permissions || 'Permisos resueltos por rol segun el backend actual.',
  })), [roleOptions]);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleMutationError = (mutationError) => {
    handleApiError(mutationError, setError);
    setSuccess('');
  };

  const handlePaymentMethodSubmit = async (event) => {
    event.preventDefault();
    clearMessages();

    try {
      if (paymentMethodForm.id) {
        await updatePaymentMethodMutation.mutateAsync({
          paymentMethodId: paymentMethodForm.id,
          payload: paymentMethodForm,
        });
        setSuccess('Metodo de pago actualizado correctamente.');
      } else {
        await createPaymentMethodMutation.mutateAsync(paymentMethodForm);
        setSuccess('Metodo de pago creado correctamente.');
      }

      setPaymentMethodForm(EMPTY_PAYMENT_METHOD);
    } catch (mutationError) {
      handleMutationError(mutationError);
    }
  };

  const handleDeletePaymentMethod = async (paymentMethodId) => {
    clearMessages();

    try {
      await deletePaymentMethodMutation.mutateAsync(paymentMethodId);
      setSuccess('Metodo de pago eliminado correctamente.');
      if (Number(paymentMethodForm.id) === Number(paymentMethodId)) {
        setPaymentMethodForm(EMPTY_PAYMENT_METHOD);
      }
    } catch (mutationError) {
      handleMutationError(mutationError);
    }
  };

  const handleSaveSetting = async (settingKey) => {
    clearMessages();
    try {
      await saveSettingMutation.mutateAsync({
        settingKey,
        payload: settingsDraft[settingKey],
      });
      setSuccess('Configuracion guardada correctamente.');
    } catch (mutationError) {
      handleMutationError(mutationError);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    clearMessages();

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      setError('La nueva contrasena y la confirmacion deben coincidir.');
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        nextPassword: passwordForm.nextPassword,
      });
      setPasswordForm({ currentPassword: '', nextPassword: '', confirmPassword: '' });
      setSuccess('Contrasena actualizada correctamente.');
    } catch (mutationError) {
      handleMutationError(mutationError);
    }
  };

  const handleStartUserEdit = (targetUser) => {
    clearMessages();
    setEditingUserId(targetUser.id);
    setUserRoleDraft(getEffectiveRole(targetUser.role) || '');
  };

  const handleUserRoleSave = async (targetUserId) => {
    clearMessages();

    try {
      await updateUserMutation.mutateAsync({
        userId: targetUserId,
        payload: { role: userRoleDraft },
      });
      setEditingUserId(null);
      setUserRoleDraft('');
      setSuccess('Rol del usuario actualizado correctamente.');
    } catch (mutationError) {
      handleMutationError(mutationError);
    }
  };

  const handleDeactivateUser = async (targetUser) => {
    if (!window.confirm(`Desactivar al usuario ${targetUser.name}?`)) {
      return;
    }

    clearMessages();

    try {
      await deactivateUserMutation.mutateAsync(targetUser.id);
      setSuccess('Usuario desactivado correctamente.');
    } catch (mutationError) {
      handleMutationError(mutationError);
    }
  };

  const handleReactivateUser = async (targetUser) => {
    clearMessages();

    try {
      await reactivateUserMutation.mutateAsync(targetUser.id);
      setSuccess('Usuario reactivado correctamente.');
    } catch (mutationError) {
      handleMutationError(mutationError);
    }
  };

  const paymentMethodColumns = [
    {
      key: 'label',
      header: 'Metodo',
      render: (method) => method.label,
    },
    {
      key: 'key',
      header: 'Clave',
      render: (method) => method.key,
    },
    {
      key: 'requiresReference',
      header: 'Referencia',
      render: (method) => (method.requiresReference ? 'Requerida' : 'Opcional'),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (method) => (method.isActive ? 'Activo' : 'Inactivo'),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (method) => (
        <div className="action-stack">
          <Button type="button" size="sm" variant="outline" onClick={() => setPaymentMethodForm({
            id: method.id,
            label: method.label,
            key: method.key,
            description: method.description || '',
            requiresReference: Boolean(method.requiresReference),
            isActive: method.isActive !== false,
          })}
          >
            Editar
          </Button>
          <Button type="button" size="sm" variant="danger" onClick={() => handleDeletePaymentMethod(method.id)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  const userColumns = [
    {
      key: 'name',
      header: 'Usuario',
      render: (targetUser) => targetUser.name,
    },
    {
      key: 'email',
      header: 'Correo',
      render: (targetUser) => targetUser.email,
    },
    {
      key: 'role',
      header: 'Rol',
       render: (targetUser) => {
         const effectiveRole = getEffectiveRole(targetUser.role);

         return editingUserId === targetUser.id ? (
        <label className="field-group">
          <span className="sr-only">Rol</span>
          <select className="form-control" value={userRoleDraft || effectiveRole || ''} onChange={(event) => setUserRoleDraft(event.target.value)}>
            {roleOptions.map((role) => (
              <option key={role} value={role}>{ROLE_PERMISSION_COPY[role]?.label || role}</option>
            ))}
          </select>
        </label>
      ) : (ROLE_PERMISSION_COPY[effectiveRole]?.label || effectiveRole || targetUser.role)
       },
    },
    {
      key: 'permissions',
      header: 'Permisos aplicados',
      render: (targetUser) => {
        const effectiveRole = getEffectiveRole(targetUser.role);
        return ROLE_PERMISSION_COPY[effectiveRole]?.permissions || 'Permisos resueltos por rol.';
      },
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (targetUser) => (targetUser.isActive !== false ? 'Activo' : 'Inactivo'),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (targetUser) => (
        <div className="action-stack">
          {editingUserId === targetUser.id ? (
            <>
              <Button type="button" size="sm" variant="success" disabled={updateUserMutation.isPending} onClick={() => handleUserRoleSave(targetUser.id)}>
                Guardar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => {
                setEditingUserId(null);
                setUserRoleDraft('');
              }}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => handleStartUserEdit(targetUser)}>
                Editar rol
              </Button>
              {targetUser.isActive !== false ? (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={deactivateUserMutation.isPending || Number(targetUser.id) === currentUserId}
                  onClick={() => handleDeactivateUser(targetUser)}
                >
                  Desactivar
                </Button>
              ) : (
                <Button type="button" size="sm" variant="success" disabled={reactivateUserMutation.isPending} onClick={() => handleReactivateUser(targetUser)}>
                  Reactivar
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <StatePanel
        icon="🔒"
        title="Configuracion restringida"
        message="Solo los administradores pueden administrar catalogos y ajustes del sistema."
      />
    );
  }

  if (paymentMethodsQuery.isLoading || settingsQuery.isLoading || catalogsQuery.isLoading) {
    return (
      <StatePanel
        icon="⏳"
        title="Cargando configuracion"
        message="Preparando metodos de pago, catalogos y ajustes compartidos."
        loadingState
      />
    );
  }

  return (
    <div className="dashboard-page-stack config-page">
      <WorkspaceCard
        className="surface-card surface-card--hero"
        eyebrow="Configuracion"
        title="Administra catalogos, ajustes base y acceso personal desde un solo dominio"
        subtitle="Este modulo consolida metodos de pago, parametros del negocio y el cambio de contrasena sin alterar el modelo de roles existente."
      >
        <div className="metric-grid">
          {summaryCards.map((card) => (
            <StatCard key={card.label} label={card.label} value={card.value} caption={card.caption} tone={card.tone} />
          ))}
        </div>
      </WorkspaceCard>

      {error ? <div className="inline-message inline-message--error">⚠️ {error}</div> : null}
      {success ? <div className="inline-message inline-message--success">✅ {success}</div> : null}

      <WorkspaceCard
        className="surface-card"
        eyebrow="Metodos de pago"
        title="CRUD de metodos de pago"
        subtitle="Define las opciones visibles para registrar cobros y documentos asociados."
      >
        <div className="dashboard-page-stack section-stack--compact">
          <FormSection title={paymentMethodForm.id ? 'Editar metodo' : 'Crear metodo'} subtitle="Mantiene la configuracion central de pagos alineada con el backend.">
            <form className="dashboard-page-stack section-stack--compact" onSubmit={handlePaymentMethodSubmit}>
              <Input label="Nombre" value={paymentMethodForm.label} onChange={(event) => setPaymentMethodForm((current) => ({ ...current, label: event.target.value }))} />
              <Input label="Clave" value={paymentMethodForm.key} onChange={(event) => setPaymentMethodForm((current) => ({ ...current, key: event.target.value }))} placeholder="ej. transferencia" />
              <Input label="Descripcion" value={paymentMethodForm.description} onChange={(event) => setPaymentMethodForm((current) => ({ ...current, description: event.target.value }))} />
              <label className="field-group">
                <span className="field-label">Referencia requerida</span>
                <input type="checkbox" checked={paymentMethodForm.requiresReference} onChange={(event) => setPaymentMethodForm((current) => ({ ...current, requiresReference: event.target.checked }))} />
              </label>
              <label className="field-group">
                <span className="field-label">Activo</span>
                <input type="checkbox" checked={paymentMethodForm.isActive} onChange={(event) => setPaymentMethodForm((current) => ({ ...current, isActive: event.target.checked }))} />
              </label>
              <div className="action-stack">
                <Button type="submit">{paymentMethodForm.id ? 'Actualizar metodo' : 'Crear metodo'}</Button>
                {paymentMethodForm.id ? (
                  <Button type="button" variant="outline" onClick={() => setPaymentMethodForm(EMPTY_PAYMENT_METHOD)}>Cancelar</Button>
                ) : null}
              </div>
            </form>
          </FormSection>

          <DataTable
            columns={paymentMethodColumns}
            rows={paymentMethods}
            rowKey="id"
            emptyState={<EmptyState icon="💳" title="Aun no hay metodos" description="Crea el primer metodo de pago para habilitar el catalogo de configuracion." />}
          />
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        className="surface-card"
        eyebrow="Usuarios del sistema"
        title="Administra usuarios visibles, roles y estado de acceso"
        subtitle="La gestion de permisos se resuelve por rol. Esta vista reutiliza `/api/users` y mantiene el modelo actual sin ACLs granulares por usuario."
      >
        <div className="dashboard-page-stack section-stack--compact">
          <div className="inline-action-group">
            <span className="status-note">Usuarios cargados: {usersPaginationMeta?.totalItems ?? users.length}</span>
            <span className="status-note">Roles disponibles: {roleOptions.map((role) => ROLE_PERMISSION_COPY[role]?.label || role).join(', ')}</span>
          </div>

          {usersQuery.isLoading ? (
            <StatePanel icon="⏳" title="Cargando usuarios" message="Sincronizando cuentas activas, roles y estado desde el backend." loadingState />
          ) : (
            <>
              <PaginationControls pagination={usersPaginationMeta} disabled={usersQuery.isFetching} onPageChange={(page) => {
                setEditingUserId(null);
                setUserRoleDraft('');
                setUsersPagination((current) => ({ ...current, page }));
              }} />
              <DataTable
                columns={userColumns}
                rows={users}
                rowKey="id"
                emptyState={<EmptyState icon="👥" title="No se encontraron usuarios." description="Cuando existan cuentas registradas, apareceran aqui con su rol operativo." />}
              />
            </>
          )}
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        className="surface-card"
        eyebrow="Roles y permisos"
        title="Modelo de acceso cargado desde catalogos"
        subtitle="Actualmente los permisos administrativos se asignan por rol. Cambiar el rol de un usuario actualiza su alcance operativo sin introducir permisos individuales."
      >
        <div className="dashboard-page-stack section-stack--compact">
          {rolePermissionCards.map((roleCard) => (
            <FormSection key={roleCard.role} title={roleCard.label} subtitle={roleCard.permissions}>
              <div className="inline-action-group">
                <span className="status-note">Rol interno: {roleCard.role}</span>
                <span className="status-note">Permisos granulares por usuario: no disponible</span>
              </div>
            </FormSection>
          ))}
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        className="surface-card"
        eyebrow="Ajustes del negocio"
        title="Configuraciones base compartidas"
        subtitle="Guarda parametros minimos para reutilizarlos en exportes y superficies administrativas."
      >
        <div className="dashboard-page-stack section-stack--compact">
          {Object.entries(settingsDraft).map(([settingKey, setting]) => (
            <FormSection key={settingKey} title={setting.label} subtitle={setting.description}>
              <div className="dashboard-page-stack section-stack--compact">
                <Input label="Valor" value={setting.value} onChange={(event) => setSettingsDraft((current) => ({
                  ...current,
                  [settingKey]: { ...current[settingKey], value: event.target.value },
                }))} />
                <Button type="button" size="sm" onClick={() => handleSaveSetting(settingKey)}>Guardar ajuste</Button>
              </div>
            </FormSection>
          ))}
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        className="surface-card"
        eyebrow="Catalogos administrativos"
        title="Referencias reutilizables"
        subtitle="Mantiene visibles los catálogos compartidos sin introducir permisos granulares nuevos."
      >
        <div className="dashboard-page-stack section-stack--compact">
          {Object.entries(catalogs).map(([catalogKey, items]) => (
            <FormSection key={catalogKey} title={catalogKey}>
              <div className="inline-action-group">
                {(items || []).map((item) => <span key={item} className="status-note">{item}</span>)}
              </div>
            </FormSection>
          ))}
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        className="surface-card"
        eyebrow="Seguridad y acceso"
        title="Cambiar contrasena del usuario autenticado"
        subtitle="El backend actual permite cambiar la contrasena de la sesion activa. La administracion del resto de accesos sigue siendo por rol y estado del usuario."
      >
        <FormSection title="Actualizar acceso" subtitle="La nueva contrasena debe ser distinta y tener al menos 6 caracteres.">
          <div className="inline-action-group">
            <span className="status-note">Usuario: {profile?.name || user?.name}</span>
            <span className="status-note">Correo: {profile?.email || user?.email || 'N/D'}</span>
            <span className="status-note">Rol: {profile?.role || user?.role}</span>
          </div>
          <form className="dashboard-page-stack section-stack--compact" onSubmit={handlePasswordSubmit}>
            <Input type="password" label="Contrasena actual" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} />
            <Input type="password" label="Nueva contrasena" value={passwordForm.nextPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, nextPassword: event.target.value }))} />
            <Input type="password" label="Confirmar nueva contrasena" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} />
            <Button type="submit">Actualizar contrasena</Button>
          </form>
        </FormSection>
      </WorkspaceCard>
    </div>
  );
}

export default ConfigWorkspace;
