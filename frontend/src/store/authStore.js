import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import client from '../api/client'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { data } = await client.post('/auth/login', { email, password })
          set({ accessToken: data.access_token, refreshToken: data.refresh_token, isAuthenticated: true })
          const me = await client.get('/auth/me')
          set({ user: me.data, isLoading: false })
          return { success: true }
        } catch (e) {
          set({ isLoading: false })
          const detail = e.response?.data?.detail
          let errorMsg = 'Login failed'
          if (typeof detail === 'string') {
            errorMsg = detail
          } else if (Array.isArray(detail)) {
            errorMsg = detail[0]?.msg || 'Login failed'
          } else if (detail?.msg) {
            errorMsg = detail.msg
          }
          return { success: false, error: errorMsg }
        }
      },

      logout: () => set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage', partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken }) }
  )
)
