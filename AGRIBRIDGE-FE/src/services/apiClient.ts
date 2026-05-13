import axios from 'axios'
import { API_BASE_URL } from './config'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 7000,
})

apiClient.interceptors.request.use((config) => {
  const raw = localStorage.getItem('agribridge.auth.payload')
  let accessToken: string | undefined
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { accessToken?: unknown }
      if (typeof parsed.accessToken === 'string' && parsed.accessToken.trim()) {
        accessToken = parsed.accessToken.trim()
      }
    } catch {
      accessToken = undefined
    }
  }

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // Token hết hạn hoặc không hợp lệ — xóa session và redirect về login
      const keysToDelete: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('agribridge.')) keysToDelete.push(key)
      }
      keysToDelete.forEach((key) => localStorage.removeItem(key))
      window.location.href = '/auth/login'
    }
    return Promise.reject(error)
  },
)
