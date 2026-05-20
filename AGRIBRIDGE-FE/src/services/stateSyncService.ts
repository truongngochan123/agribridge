export const STATE_SYNC_EVENT = 'agribridge:state-sync'

export type StateSyncModule =
  | 'ADMIN'
  | 'BRANCH'
  | 'COMPLAINT'
  | 'CREDIT'
  | 'DASHBOARD'
  | 'DEBT'
  | 'DELIVERY'
  | 'INVENTORY'
  | 'NOTIFICATION'
  | 'ORDER'
  | 'PAYMENT'
  | 'PROFILE'
  | 'QUOTE'
  | 'REMINDER'
  | 'RFQ'
  | 'SOURCING'

export type StateSyncPayload = {
  modules: StateSyncModule[]
  source?: string
  entityId?: number | string
  at: number
}

export function dispatchStateSync(
  modules: StateSyncModule[],
  options: Omit<StateSyncPayload, 'modules' | 'at'> = {},
) {
  if (typeof window === 'undefined' || modules.length === 0) return
  window.dispatchEvent(
    new CustomEvent<StateSyncPayload>(STATE_SYNC_EVENT, {
      detail: {
        modules: Array.from(new Set(modules)),
        at: Date.now(),
        ...options,
      },
    }),
  )
}
