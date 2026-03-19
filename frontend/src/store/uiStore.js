import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
