import { create } from 'zustand';

interface PaginationState {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

export const usePaginationStore = create<PaginationState>((set) => ({
  page: 1,
  pageSize: 25,
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize }),
}));
