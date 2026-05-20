const configuredApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()

export const API_BASE_URL = configuredApiBaseUrl || 'http://localhost:8025'
