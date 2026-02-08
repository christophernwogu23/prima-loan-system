import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
})

// Add token to requests
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle token refresh on 401
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      const refreshToken = useAuthStore.getState().refreshToken
      
      if (refreshToken) {
        try {
          // Try to refresh the token
          const response = await axios.post(
            `${client.defaults.baseURL}/auth/refresh`,
            { refresh_token: refreshToken }
          )
          
          const { access_token, refresh_token: newRefreshToken } = response.data
          
          // Update store with new tokens
          useAuthStore.setState({
            accessToken: access_token,
            refreshToken: newRefreshToken
          })
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return client(originalRequest)
        } catch (refreshError) {
          // Refresh failed - logout
          useAuthStore.getState().logout()
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      } else {
        // No refresh token - logout
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)

export default client