import axios from 'axios'
import { API_BASE_URL } from './config'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 7000,
})

apiClient.interceptors.request.use((config) => {
  const raw = sessionStorage.getItem('agribridge.auth.payload')
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
