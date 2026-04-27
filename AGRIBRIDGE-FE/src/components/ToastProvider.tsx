import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastContext, type ToastConfirmOptions, type ToastType } from '../hooks/useToast'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ConfirmState {
  message: string
  options: ToastConfirmOptions
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null)

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now()

    setToasts((prev) => [...prev, { id, message, type }])

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 3000)
  }

  const showConfirm = (message: string, options: ToastConfirmOptions = {}) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false)
    }

    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve
      setConfirmState({ message, options })
    })
  }

  const closeConfirm = (accepted: boolean) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(accepted)
      confirmResolverRef.current = null
    }
    setConfirmState(null)
  }

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}

      <div className="fixed right-4 top-4 z-[9999] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[260px] rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
              toast.type === 'success'
                ? 'bg-emerald-600'
                : toast.type === 'error'
                ? 'bg-red-500'
                : 'bg-slate-800'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {confirmState ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <h4 className="text-base font-bold text-slate-900">
              {confirmState.options.title ?? 'Xác nhận thao tác'}
            </h4>
            <p className="mt-2 text-sm text-slate-600">{confirmState.message}</p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => closeConfirm(false)}
              >
                {confirmState.options.cancelText ?? 'Hủy'}
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                onClick={() => closeConfirm(true)}
              >
                {confirmState.options.confirmText ?? 'Đồng ý'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}