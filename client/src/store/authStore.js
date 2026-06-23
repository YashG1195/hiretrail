// src/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      user:        null,
      accessToken: null,
      theme:       'dark',

      setAuth: (user, accessToken) => set({ user, accessToken }),
      setToken: (accessToken)      => set({ accessToken }),
      clearAuth: ()                => set({ user: null, accessToken: null }),
      toggleTheme: ()              => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'hiretrail-auth',
      partialize: (state) => ({
        user:        state.user,
        accessToken: state.accessToken,
        theme:       state.theme,
      }),
    }
  )
);

export default useAuthStore;
