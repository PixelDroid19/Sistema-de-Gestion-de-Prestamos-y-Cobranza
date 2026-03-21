import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const VIEW_ORDER_BY_ROLE = {
  admin: ['Dashboard', 'Loans', 'Payments', 'Agents', 'Reports'],
  agent: ['Dashboard', 'Loans', 'Payments'],
  customer: ['Dashboard', 'Loans', 'Payments'],
  socio: ['Dashboard', 'Loans', 'Reports'],
};

export const getAllowedViewsForRole = (role) => VIEW_ORDER_BY_ROLE[role] || VIEW_ORDER_BY_ROLE.customer;

export const resolveCurrentView = (currentView, role) => {
  const allowedViews = getAllowedViewsForRole(role);
  return allowedViews.includes(currentView) ? currentView : allowedViews[0];
};

export const useUiStore = create(
  persist(
    (set) => ({
      currentView: 'Dashboard',
      isDarkMode: false,
      notificationsOpen: false,
      setCurrentView: (currentView) => set({ currentView }),
      toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
    }),
    {
      name: 'lendflow-ui-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentView: state.currentView,
        isDarkMode: state.isDarkMode,
      }),
    },
  ),
);
