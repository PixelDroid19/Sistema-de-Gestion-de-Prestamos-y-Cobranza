import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const VIEW_DEFINITIONS = {
  dashboard: {
    id: 'dashboard',
    key: 'Dashboard',
    group: 'overview',
    labelKey: 'shell.views.Dashboard',
    searchTokens: ['dashboard'],
    roles: ['admin', 'agent', 'customer', 'socio'],
    parent: null,
  },
  customers: {
    id: 'customers',
    key: 'Customers',
    group: 'customers',
    labelKey: 'shell.views.Customers',
    searchTokens: ['clientes', 'customers'],
    roles: ['admin', 'agent'],
    parent: null,
  },
  'customers-new': {
    id: 'customers-new',
    key: 'CustomerCreate',
    group: 'customers',
    labelKey: 'shell.views.NewCustomer',
    searchTokens: ['nuevo cliente', 'new customer'],
    roles: ['admin', 'agent'],
    parent: 'customers',
  },
  loans: {
    id: 'loans',
    key: 'Loans',
    group: 'loans',
    labelKey: 'shell.views.Loans',
    searchTokens: ['creditos', 'prestamos', 'loans'],
    roles: ['admin', 'agent', 'customer', 'socio'],
    parent: null,
  },
  'loans-new': {
    id: 'loans-new',
    key: 'LoanCreate',
    group: 'loans',
    labelKey: 'shell.views.NewLoan',
    searchTokens: ['nuevo credito', 'new loan'],
    roles: ['admin', 'agent'],
    parent: 'loans',
  },
  associates: {
    id: 'associates',
    key: 'Associates',
    group: 'associates',
    labelKey: 'shell.views.Associates',
    searchTokens: ['socios', 'associates'],
    roles: ['admin', 'socio'],
    parent: null,
  },
  payments: {
    id: 'payments',
    key: 'Payments',
    group: 'payments',
    labelKey: 'shell.views.Payments',
    searchTokens: ['pagos', 'payments'],
    roles: ['admin', 'agent', 'customer'],
    parent: null,
  },
  agents: {
    id: 'agents',
    key: 'Agents',
    group: 'agents',
    labelKey: 'shell.views.Agents',
    searchTokens: ['agentes', 'agents'],
    roles: ['admin'],
    parent: null,
  },
  reports: {
    id: 'reports',
    key: 'Reports',
    group: 'reports',
    labelKey: 'shell.views.Reports',
    searchTokens: ['reportes', 'reports'],
    roles: ['admin', 'socio'],
    parent: null,
  },
  notifications: {
    id: 'notifications',
    key: 'Notifications',
    group: 'system',
    labelKey: 'shell.views.Notifications',
    searchTokens: ['notifications', 'notificaciones'],
    roles: ['admin', 'agent', 'customer', 'socio'],
    parent: null,
  },
}

const NAV_GROUPS = [
  { id: 'overview', labelKey: 'shell.groups.overview', itemIds: ['dashboard'] },
  { id: 'customers', labelKey: 'shell.groups.customers', itemIds: ['customers', 'customers-new'] },
  { id: 'loans', labelKey: 'shell.groups.loans', itemIds: ['loans', 'loans-new', 'reports'] },
  { id: 'associates', labelKey: 'shell.groups.associates', itemIds: ['associates'] },
  { id: 'payments', labelKey: 'shell.groups.payments', itemIds: ['payments'] },
  { id: 'agents', labelKey: 'shell.groups.agents', itemIds: ['agents'] },
  { id: 'system', labelKey: 'shell.groups.system', itemIds: ['notifications'] },
]

export const VIEW_COMPONENT_KEYS = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  'customers-new': 'NewCustomer',
  loans: 'Loans',
  'loans-new': 'NewLoan',
  associates: 'Associates',
  payments: 'Payments',
  agents: 'Agents',
  reports: 'Reports',
  notifications: 'Notifications',
}

const DEFAULT_OPEN_GROUPS = {
  overview: true,
  customers: true,
  loans: true,
  associates: true,
  payments: true,
  agents: true,
  system: false,
}

const LEGACY_VIEW_ALIASES = {
  Dashboard: 'dashboard',
  Loans: 'loans',
  Payments: 'payments',
  Agents: 'agents',
  Reports: 'reports',
  Customers: 'customers',
  Associates: 'associates',
  Notifications: 'notifications',
}

const normalizeViewId = (viewId) => LEGACY_VIEW_ALIASES[viewId] || viewId || 'dashboard'

export const resolveCurrentViewId = (currentView, role) => {
  const normalized = normalizeViewId(currentView)
  const allowedViews = getAllowedLeafViewIdsForRole(role)
  if (allowedViews.includes(normalized)) {
    return normalized
  }
  return allowedViews[0] || 'dashboard'
}

const getViewDefinition = (viewId) => VIEW_DEFINITIONS[normalizeViewId(viewId)] || VIEW_DEFINITIONS.dashboard

export const getAllowedViewsForRole = (role) => Object.values(VIEW_DEFINITIONS).filter((view) => view.roles.includes(role))

export const getAllowedLeafViewIdsForRole = (role) => getAllowedViewsForRole(role).map((view) => view.id)

export const getNavigationGroupsForRole = (role) => NAV_GROUPS.map((group) => {
  const items = group.itemIds
    .map((itemId) => VIEW_DEFINITIONS[itemId])
    .filter((item) => item && item.roles.includes(role))

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
      setCurrentView: (currentView) => set({ currentView: normalizeViewId(currentView) }),
      toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
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
