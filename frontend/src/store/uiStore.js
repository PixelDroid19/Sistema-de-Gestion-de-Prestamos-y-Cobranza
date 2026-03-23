import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { normalizeApplicationRole } from '@/utils/applicationRole'

const VIEW_DEFINITIONS = {
  dashboard: {
    id: 'dashboard',
    key: 'Dashboard',
    group: 'overview',
    labelKey: 'shell.views.Dashboard',
    searchTokens: ['dashboard'],
    roles: ['admin', 'customer', 'socio'],
    parent: null,
  },
  customers: {
    id: 'customers',
    key: 'Customers',
    group: 'customers',
    labelKey: 'shell.views.Customers',
    searchTokens: ['clientes', 'customers'],
    roles: ['admin'],
    parent: null,
  },
  'customers-new': {
    id: 'customers-new',
    key: 'CustomerCreate',
    group: 'customers',
    labelKey: 'shell.views.NewCustomer',
    searchTokens: ['nuevo cliente', 'new customer'],
    roles: ['admin'],
    parent: 'customers',
  },
  credits: {
    id: 'credits',
    key: 'Loans',
    group: 'credits',
    labelKey: 'shell.views.Credits',
    searchTokens: ['creditos', 'prestamos', 'loans', 'cartera'],
    roles: ['admin', 'customer'],
    parent: null,
  },
  'credits-new': {
    id: 'credits-new',
    key: 'NewLoan',
    group: 'credits',
    labelKey: 'shell.views.NewCredit',
    searchTokens: ['nuevo credito', 'new credit', 'new loan'],
    roles: ['admin'],
    parent: 'credits',
  },
  'credits-payments': {
    id: 'credits-payments',
    key: 'Payments',
    group: 'credits',
    labelKey: 'shell.views.Payments',
    searchTokens: ['pagos', 'payments', 'cobros'],
    roles: ['admin', 'customer'],
    parent: 'credits',
  },
  partners: {
    id: 'partners',
    key: 'Associates',
    group: 'partners',
    labelKey: 'shell.views.Partners',
    searchTokens: ['socios', 'partners', 'associates'],
    roles: ['admin', 'socio'],
    parent: null,
  },
  'partners-reports': {
    id: 'partners-reports',
    key: 'Reports',
    group: 'partners',
    labelKey: 'shell.views.Reports',
    searchTokens: ['reportes', 'reports', 'rendimiento'],
    roles: ['admin', 'socio'],
    parent: 'partners',
  },
  config: {
    id: 'config',
    key: 'Config',
    group: 'config',
    labelKey: 'shell.views.Config',
    searchTokens: ['configuracion', 'config', 'payment methods', 'metodos de pago'],
    roles: ['admin'],
    parent: null,
  },
  notifications: {
    id: 'notifications',
    key: 'Notifications',
    group: 'system',
    labelKey: 'shell.views.Notifications',
    searchTokens: ['notifications', 'notificaciones'],
    roles: ['admin', 'customer', 'socio'],
    parent: null,
  },
}

const NAV_GROUPS = [
  { id: 'overview', labelKey: 'shell.groups.overview', itemIds: ['dashboard'] },
  { id: 'customers', labelKey: 'shell.groups.customers', itemIds: ['customers', 'customers-new'] },
  { id: 'credits', labelKey: 'shell.groups.credits', itemIds: ['credits', 'credits-new', 'credits-payments'] },
  { id: 'partners', labelKey: 'shell.groups.partners', itemIds: ['partners', 'partners-reports'] },
  { id: 'config', labelKey: 'shell.groups.config', itemIds: ['config'] },
  { id: 'system', labelKey: 'shell.groups.system', itemIds: ['notifications'] },
]

export const VIEW_COMPONENT_KEYS = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  'customers-new': 'NewCustomer',
  credits: 'Loans',
  'credits-new': 'NewLoan',
  'credits-payments': 'Payments',
  partners: 'Associates',
  'partners-reports': 'Reports',
  config: 'Config',
  notifications: 'Notifications',
}

const DEFAULT_OPEN_GROUPS = {
  overview: true,
  customers: true,
  credits: true,
  partners: true,
  config: true,
  system: false,
}

const LEGACY_VIEW_ALIASES = {
  Dashboard: 'dashboard',
  Loans: 'credits',
  NewLoan: 'credits-new',
  Payments: 'credits-payments',
  Reports: 'partners-reports',
  Customers: 'customers',
  Associates: 'partners',
  Notifications: 'notifications',
  Config: 'config',
  loans: 'credits',
  'loans-new': 'credits-new',
  payments: 'credits-payments',
  associates: 'partners',
  reports: 'partners-reports',
  config: 'config',
}

const normalizeViewId = (viewId) => LEGACY_VIEW_ALIASES[viewId] || viewId || 'dashboard'

export const resolveCurrentViewId = (currentView, role) => {
  const normalizedRole = normalizeApplicationRole(role)
  const normalized = normalizeViewId(currentView)
  const allowedViews = getAllowedLeafViewIdsForRole(normalizedRole)
  if (allowedViews.includes(normalized)) {
    return normalized
  }
  return allowedViews[0] || 'dashboard'
}

const getViewDefinition = (viewId) => VIEW_DEFINITIONS[normalizeViewId(viewId)] || VIEW_DEFINITIONS.dashboard

export const getAllowedViewsForRole = (role) => {
  const normalizedRole = normalizeApplicationRole(role)
  if (!normalizedRole) {
    return [VIEW_DEFINITIONS.dashboard]
  }

  return Object.values(VIEW_DEFINITIONS).filter((view) => view.roles.includes(normalizedRole))
}

export const getAllowedLeafViewIdsForRole = (role) => getAllowedViewsForRole(role).map((view) => view.id)

export const getNavigationGroupsForRole = (role) => NAV_GROUPS.map((group) => {
  const normalizedRole = normalizeApplicationRole(role)
  const items = group.itemIds
    .map((itemId) => VIEW_DEFINITIONS[itemId])
    .filter((item) => item && normalizedRole && item.roles.includes(normalizedRole))

  return { ...group, items }
}).filter((group) => group.items.length)

export const resolveViewComponentKey = (viewId, role) => VIEW_COMPONENT_KEYS[resolveCurrentViewId(viewId, role)] || VIEW_COMPONENT_KEYS.dashboard

export const useUiStore = create()(
  persist(
    (set, get) => ({
      currentView: 'dashboard',
      isDarkMode: false,
      notificationsOpen: false,
      navOpenGroups: DEFAULT_OPEN_GROUPS,
      searchQuery: '',
      loanDraftCustomerId: null,
      loanFilterCustomerId: null,
      customerEditId: null,
      setCurrentView: (currentView) => set({ currentView: normalizeViewId(currentView) }),
      toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setLoanDraftCustomerId: (customerId) => set({ loanDraftCustomerId: customerId ? Number(customerId) : null }),
      clearLoanDraftCustomerId: () => set({ loanDraftCustomerId: null }),
      setLoanFilterCustomerId: (customerId) => set({ loanFilterCustomerId: customerId ? Number(customerId) : null }),
      clearLoanFilterCustomerId: () => set({ loanFilterCustomerId: null }),
      setCustomerEditId: (customerId) => set({ customerEditId: customerId ? Number(customerId) : null }),
      clearCustomerEditId: () => set({ customerEditId: null }),
      toggleNavGroup: (groupId) => set((state) => ({
        navOpenGroups: {
          ...state.navOpenGroups,
          [groupId]: !state.navOpenGroups[groupId],
        },
      })),
      ensureAllowedView: (role) => {
        const nextView = resolveCurrentViewId(get().currentView, role)
        if (nextView !== get().currentView) {
          set({ currentView: nextView })
        }
        return nextView
      },
      getResolvedViewMeta: (role) => {
        const nextView = resolveCurrentViewId(get().currentView, role)
        return getViewDefinition(nextView)
      },
    }),
    {
      name: 'lendflow-ui-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentView: state.currentView,
        isDarkMode: state.isDarkMode,
        navOpenGroups: state.navOpenGroups,
      }),
    },
  ),
)
