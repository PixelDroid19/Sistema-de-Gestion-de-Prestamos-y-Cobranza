import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

const toArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value : [];

export interface AuditLog {
  id: string;
  userId: number | null;
  userName: string | null;
  action: string;
  module: string;
  entityId: string | null;
  entityType: string | null;
  previousData: object | null;
  newData: object | null;
  metadata: object | null;
  ip: string | null;
  userAgent: string | null;
  timestamp: string;
}

export interface AuditFilters {
  userId?: string;
  action?: string;
  module?: string;
  entityId?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditStats {
  module: string;
  totalCount: number;
  actions: Record<string, number>;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface AuditLogsResponse {
  items: AuditLog[];
  pagination: PaginationMeta;
}

export interface AuditStatsResponse {
  stats: AuditStats[];
  dateRange: {
    dateFrom?: string;
    dateTo?: string;
  };
}

export const useAuditLogs = (filters: AuditFilters = {}) => {
  const getAuditLogs = useQuery({
    queryKey: ['audit.logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action) params.append('action', filters.action);
      if (filters.module) params.append('module', filters.module);
      if (filters.entityId) params.append('entityId', filters.entityId);
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.page) params.append('page', String(filters.page));
      if (filters.pageSize) params.append('pageSize', String(filters.pageSize));

      const { data } = await apiClient.get(`/audits?${params.toString()}`);
      return data as { success: boolean; data: AuditLogsResponse };
    },
    enabled: true,
  });

  return {
    logs: getAuditLogs.data?.data?.items || [],
    pagination: getAuditLogs.data?.data?.pagination,
    isLoading: getAuditLogs.isLoading,
    isError: getAuditLogs.isError,
    error: getAuditLogs.error,
  };
};

export const useAuditStats = (dateFrom?: string, dateTo?: string) => {
  const getAuditStats = useQuery({
    queryKey: ['audit.stats', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const { data } = await apiClient.get(`/audits/stats?${params.toString()}`);
      return data as { success: boolean; data: AuditStatsResponse };
    },
    enabled: true,
  });

  return {
    stats: toArray<AuditStats>(getAuditStats.data?.data?.stats),
    dateRange: getAuditStats.data?.data?.dateRange,
    isLoading: getAuditStats.isLoading,
    isError: getAuditStats.isError,
    error: getAuditStats.error,
  };
};
