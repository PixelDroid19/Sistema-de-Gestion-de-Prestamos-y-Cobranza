import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

const toArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value : [];

export const usePermissions = () => {
  const queryClient = useQueryClient();

  const getPermissions = useQuery({
    queryKey: ['permissions.list'],
    queryFn: async () => {
      const { data } = await apiClient.get('/permissions');
      return data;
    },
  });

  return {
    permissions: getPermissions.data?.data?.permissions,
    isLoading: getPermissions.isLoading,
    isError: getPermissions.isError,
  };
};

export const usePermissionsByModule = (module: string) => {
  const queryClient = useQueryClient();

  const getPermissionsByModule = useQuery({
    queryKey: ['permissions.byModule', module],
    queryFn: async () => {
      const { data } = await apiClient.get(`/permissions/by-module/${module}`);
      return data;
    },
    enabled: !!module,
  });

  return {
    permissions: getPermissionsByModule.data?.data?.permissions,
    isLoading: getPermissionsByModule.isLoading,
    isError: getPermissionsByModule.isError,
  };
};

export const useMyPermissions = () => {
  const queryClient = useQueryClient();

  const getMyPermissions = useQuery({
    queryKey: ['permissions.myPermissions'],
    queryFn: async () => {
      const { data } = await apiClient.get('/permissions/me');
      return data;
    },
  });

  return {
    permissions: toArray(getMyPermissions.data?.data?.permissions),
    isLoading: getMyPermissions.isLoading,
    isError: getMyPermissions.isError,
  };
};

export const useMyPermissionsSummary = () => {
  const queryClient = useQueryClient();

  const getMyPermissionsSummary = useQuery({
    queryKey: ['permissions.myPermissionsSummary'],
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
  const queryClient = useQueryClient();

  const getUserPermissions = useQuery({
    queryKey: ['permissions.user', userId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/permissions/user/${userId}`);
      return data;
    },
    enabled: !!userId,
  });

  return {
    permissions: toArray(getUserPermissions.data?.data?.permissions),
    isLoading: getUserPermissions.isLoading,
    isError: getUserPermissions.isError,
  };
};

export const useGrantPermission = () => {
  const queryClient = useQueryClient();

  const grantPermission = useMutation({
    mutationFn: async (payload: { userId: string; permission: string; module?: string }) => {
      const { data } = await apiClient.post('/permissions/grant', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions.list'] });
      queryClient.invalidateQueries({ queryKey: ['permissions.myPermissions'] });
      queryClient.invalidateQueries({ queryKey: ['permissions.myPermissionsSummary'] });
    },
  });

  return { grantPermission };
};

export const useGrantBatchPermissions = () => {
  const queryClient = useQueryClient();

  const grantBatchPermissions = useMutation({
    mutationFn: async (payload: { userId: string; permissions: Array<{ permission: string; module?: string }> }) => {
      const { data } = await apiClient.post('/permissions/grant/batch', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions.list'] });
      queryClient.invalidateQueries({ queryKey: ['permissions.myPermissions'] });
      queryClient.invalidateQueries({ queryKey: ['permissions.myPermissionsSummary'] });
    },
  });

  return { grantBatchPermissions };
};

export const useRevokePermission = () => {
  const queryClient = useQueryClient();

  const revokePermission = useMutation({
    mutationFn: async (payload: { userId: string; permission: string; module?: string }) => {
      const { data } = await apiClient.post('/permissions/revoke', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions.list'] });
      queryClient.invalidateQueries({ queryKey: ['permissions.myPermissions'] });
      queryClient.invalidateQueries({ queryKey: ['permissions.myPermissionsSummary'] });
    },
  });

  return { revokePermission };
};

export const useCheckPermission = () => {
  const queryClient = useQueryClient();

  const checkPermission = useMutation({
    mutationFn: async (payload: { permission: string; module?: string }) => {
      const { data } = await apiClient.post('/permissions/check', payload);
      return data;
    },
  });

  return { checkPermission };
};
