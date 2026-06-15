import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from './queryKeys';
import { useInvalidatingMutation } from './crudHooks';

const toArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value : [];

export type PermissionEntry = {
  id?: string | number;
  permission?: string;
  name?: string;
  module?: string;
  source?: 'direct' | 'role' | string;
  description?: string;
};

const toStringValue = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number') return String(value);
  return undefined;
};

const normalizePermissionEntries = (value: unknown): PermissionEntry[] => {
  const records: PermissionEntry[] = [];

  const pushRecord = (entry: unknown, fallbackModule?: string) => {
    if (!entry) return;

    if (typeof entry === 'string') {
      records.push({
        permission: entry,
        module: fallbackModule,
        source: 'direct',
      });
      return;
    }

    if (typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const permission =
        toStringValue(obj.permission)
        ?? toStringValue(obj.permissionName)
        ?? toStringValue(obj.name)
        ?? toStringValue(obj.code)
        ?? toStringValue(obj.key);

      if (!permission) return;

      records.push({
        id: toStringValue(obj.id),
        permission,
        name: toStringValue(obj.name) ?? permission,
        module: toStringValue(obj.module) ?? fallbackModule,
        source: (toStringValue(obj.source) as PermissionEntry['source']) ?? 'direct',
        description: toStringValue(obj.description),
      });
    }
  };

  if (Array.isArray(value)) {
    value.forEach((entry) => pushRecord(entry));
    return records;
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;

    const byModule = objectValue.permissionsByModule;
    if (byModule && typeof byModule === 'object') {
      Object.entries(byModule as Record<string, unknown>).forEach(([module, entries]) => {
        if (Array.isArray(entries)) {
          entries.forEach((entry) => pushRecord(entry, module));
          return;
        }

        if (entries && typeof entries === 'object') {
          Object.entries(entries as Record<string, unknown>).forEach(([permission, granted]) => {
            if (granted) pushRecord(permission, module);
          });
        }
      });
    }

    const flatPermissions = objectValue.permissions;
    if (Array.isArray(flatPermissions)) {
      flatPermissions.forEach((entry) => pushRecord(entry));
    }

    const grantedPermissions = objectValue.grantedPermissions;
    if (Array.isArray(grantedPermissions)) {
      grantedPermissions.forEach((entry) => pushRecord(entry));
    }

    Object.entries(objectValue).forEach(([key, entry]) => {
      if (['permissionsByModule', 'permissions', 'grantedPermissions'].includes(key)) return;

      if (Array.isArray(entry)) {
        entry.forEach((nestedEntry) => pushRecord(nestedEntry, key));
        return;
      }

      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        if (
          Object.prototype.hasOwnProperty.call(obj, 'permission')
          || Object.prototype.hasOwnProperty.call(obj, 'permissionName')
          || Object.prototype.hasOwnProperty.call(obj, 'name')
          || Object.prototype.hasOwnProperty.call(obj, 'module')
          || Object.prototype.hasOwnProperty.call(obj, 'source')
        ) {
          pushRecord(obj, key);
          return;
        }

        Object.entries(obj).forEach(([permission, granted]) => {
          if (granted) pushRecord(permission, key);
        });
      }
    });
  }

  return records;
};

export const toPermissionNames = (value: unknown): string[] => normalizePermissionEntries(value)
  .map((entry) => entry.permission)
  .filter((permission): permission is string => typeof permission === 'string' && permission.trim().length > 0);

type PermissionMutationPayload = {
  userId: string;
  permission?: string;
  name?: string;
  module?: string;
};

const normalizePermissionMutationPayload = (payload: PermissionMutationPayload) => {
  const permission = payload.permission ?? payload.name;

  return {
    userId: payload.userId,
    permission,
    name: permission,
    permissionName: permission,
    module: payload.module,
    moduleName: payload.module,
  };
};

export const usePermissions = () => {
  const getPermissions = useQuery({
    queryKey: queryKeys.permissions.list,
    queryFn: async () => {
      const { data } = await apiClient.get('/permissions');
      return data;
    },
  });

  return {
    permissions: normalizePermissionEntries(
      getPermissions.data?.data?.permissions
      ?? getPermissions.data?.data?.permissionsByModule
      ?? getPermissions.data?.data,
    ),
    isLoading: getPermissions.isLoading,
    isError: getPermissions.isError,
  };
};

export const usePermissionsByModule = (module: string) => {
  const getPermissionsByModule = useQuery({
    queryKey: queryKeys.permissions.byModule(module),
    queryFn: async () => {
      const { data } = await apiClient.get(`/permissions/by-module/${module}`);
      return data;
    },
    enabled: !!module,
  });

  return {
    permissions: normalizePermissionEntries(
      getPermissionsByModule.data?.data?.permissions
      ?? getPermissionsByModule.data?.data?.permissionsByModule
      ?? getPermissionsByModule.data?.data,
    ),
    isLoading: getPermissionsByModule.isLoading,
    isError: getPermissionsByModule.isError,
  };
};

export const useMyPermissions = (options?: { enabled?: boolean }) => {
  const getMyPermissions = useQuery({
    queryKey: queryKeys.permissions.myPermissions,
    queryFn: async () => {
      const { data } = await apiClient.get('/permissions/me');
      return data;
    },
    enabled: options?.enabled ?? true,
  });

  return {
    permissions: normalizePermissionEntries(
      getMyPermissions.data?.data?.permissions
      ?? getMyPermissions.data?.data?.permissionsByModule
      ?? getMyPermissions.data?.data,
    ),
    isLoading: getMyPermissions.isLoading,
    isError: getMyPermissions.isError,
  };
};

export const useResolvedPermissionNames = (
  user?: { id?: string | number; email?: string; role?: string; permissions?: unknown[] } | null,
): string[] => {
  const hasSessionPermissions = Array.isArray(user?.permissions) && user.permissions.length > 0;
  const shouldFetchEmployeePermissions = user?.role === 'employee' && !hasSessionPermissions;
  const permissionFetchIdentity = user?.id ?? user?.email ?? user?.role ?? '';
  const [fetchedPermissions, setFetchedPermissions] = useState<PermissionEntry[]>([]);

  useEffect(() => {
    if (!shouldFetchEmployeePermissions) {
      setFetchedPermissions([]);
      return undefined;
    }

    let cancelled = false;
    setFetchedPermissions([]);

    apiClient.get('/permissions/me')
      .then(({ data }) => {
        if (cancelled) return;
        setFetchedPermissions(normalizePermissionEntries(
          data?.data?.permissions
          ?? data?.data?.permissionsByModule
          ?? data?.data,
        ));
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedPermissions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [permissionFetchIdentity, shouldFetchEmployeePermissions]);

  return useMemo(() => {
    if (user?.role === 'admin') {
      return ['*'];
    }

    if (hasSessionPermissions) {
      return toPermissionNames(user?.permissions);
    }

    return toPermissionNames(fetchedPermissions);
  }, [fetchedPermissions, hasSessionPermissions, user?.permissions, user?.role]);
};

export const useMyPermissionsSummary = () => {
  const getMyPermissionsSummary = useQuery({
    queryKey: queryKeys.permissions.myPermissionsSummary,
    queryFn: async () => {
      const { data } = await apiClient.get('/permissions/me/summary');
      return data;
    },
  });

  return {
    summary: getMyPermissionsSummary.data?.data,
    isLoading: getMyPermissionsSummary.isLoading,
    isError: getMyPermissionsSummary.isError,
  };
};

export const useUserPermissions = (userId: string) => {
  const getUserPermissions = useQuery({
    queryKey: queryKeys.permissions.user(userId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/permissions/user/${userId}`);
      return data;
    },
    enabled: !!userId,
  });

  return {
    permissions: normalizePermissionEntries(
      getUserPermissions.data?.data?.permissions
      ?? getUserPermissions.data?.data?.permissionsByModule
      ?? getUserPermissions.data?.data,
    ),
    isLoading: getUserPermissions.isLoading,
    isError: getUserPermissions.isError,
    refetch: getUserPermissions.refetch,
  };
};

export const useGrantPermission = () => {
  const grantPermission = useInvalidatingMutation(async (payload: PermissionMutationPayload) => {
    const { data } = await apiClient.post('/permissions/grant', normalizePermissionMutationPayload(payload));
    return data;
  }, [queryKeys.permissions.list, queryKeys.permissions.myPermissions, queryKeys.permissions.myPermissionsSummary, queryKeys.permissions.userRoot]);

  return { grantPermission };
};

export const useGrantBatchPermissions = () => {
  const grantBatchPermissions = useInvalidatingMutation(async (payload: { userId: string; permissions: Array<{ permission?: string; name?: string; module?: string }> }) => {
    const normalizedPermissions = toArray<{ permission?: string; name?: string; module?: string }>(payload.permissions).map((item) => {
      const permission = item.permission ?? item.name;
      return {
        permission,
        name: permission,
        permissionName: permission,
        module: item.module,
        moduleName: item.module,
      };
    });

    const { data } = await apiClient.post('/permissions/grant/batch', {
      userId: payload.userId,
      permissions: normalizedPermissions,
    });
    return data;
  }, [queryKeys.permissions.list, queryKeys.permissions.myPermissions, queryKeys.permissions.myPermissionsSummary, queryKeys.permissions.userRoot]);

  return { grantBatchPermissions };
};

export const useRevokePermission = () => {
  const revokePermission = useInvalidatingMutation(async (payload: PermissionMutationPayload) => {
    const { data } = await apiClient.post('/permissions/revoke', normalizePermissionMutationPayload(payload));
    return data;
  }, [queryKeys.permissions.list, queryKeys.permissions.myPermissions, queryKeys.permissions.myPermissionsSummary, queryKeys.permissions.userRoot]);

  return { revokePermission };
};

export const useCheckPermission = () => {
  const checkPermission = useMutation({
    mutationFn: async (payload: { permission: string; module?: string }) => {
      const { data } = await apiClient.post('/permissions/check', payload);
      return data;
    },
  });

  return { checkPermission };
};
