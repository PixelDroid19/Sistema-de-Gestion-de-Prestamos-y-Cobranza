import { create } from 'zustand';

const DEFAULT_STATE = { page: 1, pageSize: 25 };
const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const usePaginationStore = create()((set, get) => ({
  scopes: {},
  ensureScope: (scopeKey, defaults = {}) => {
    const current = get().scopes[scopeKey];
    if (current) {
      return current;
    }

    const next = { ...DEFAULT_STATE, ...defaults };
    set((state) => ({ scopes: { ...state.scopes, [scopeKey]: next } }));
    return next;
  },
  setPage: (scopeKey, page) => set((state) => ({
    scopes: {
      ...state.scopes,
      [scopeKey]: {
        ...(state.scopes[scopeKey] || DEFAULT_STATE),
        page: toPositiveInteger(page, DEFAULT_STATE.page),
      },
    },
  })),
  setPageSize: (scopeKey, pageSize) => set((state) => ({
    scopes: {
      ...state.scopes,
      [scopeKey]: {
        ...(state.scopes[scopeKey] || DEFAULT_STATE),
        page: 1,
        pageSize: toPositiveInteger(pageSize, DEFAULT_STATE.pageSize),
      },
    },
  })),
  setPagination: (scopeKey, pagination = {}) => set((state) => ({
    scopes: {
      ...state.scopes,
      [scopeKey]: {
        ...(state.scopes[scopeKey] || DEFAULT_STATE),
        page: toPositiveInteger(pagination.page, state.scopes[scopeKey]?.page || DEFAULT_STATE.page),
        pageSize: toPositiveInteger(pagination.pageSize, state.scopes[scopeKey]?.pageSize || DEFAULT_STATE.pageSize),
      },
    },
  })),
  resetScope: (scopeKey) => set((state) => {
    const nextScopes = { ...state.scopes };
    delete nextScopes[scopeKey];
    return { scopes: nextScopes };
  }),
}));
