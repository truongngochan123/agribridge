import { useEffect, useRef } from 'react'
import { NOTIFICATION_MODULE_EVENT } from '../services/notificationRealtimeService'
import type { AppNotification } from '../services/notificationService'
import { STATE_SYNC_EVENT, type StateSyncPayload } from '../services/stateSyncService'

export function useNotificationModuleRefresh(modules: string[], refresh: () => void | Promise<void>) {
  const refreshTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const moduleSet = new Set(modules)
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) return
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = undefined
        void refresh()
      }, 50)
    }
    const handleNotification = (event: Event) => {
      const notification = (event as CustomEvent<AppNotification>).detail
      const module = notification?.module
      if (!module || !moduleSet.has(module)) return
      scheduleRefresh()
    }
    const handleStateSync = (event: Event) => {
      const payload = (event as CustomEvent<StateSyncPayload>).detail
      if (!payload?.modules?.some((module) => moduleSet.has(module))) return
      scheduleRefresh()
    }
    window.addEventListener(NOTIFICATION_MODULE_EVENT, handleNotification)
    window.addEventListener(STATE_SYNC_EVENT, handleStateSync)
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = undefined
      }
      window.removeEventListener(NOTIFICATION_MODULE_EVENT, handleNotification)
      window.removeEventListener(STATE_SYNC_EVENT, handleStateSync)
    }
  }, [modules.join('|'), refresh])
}
