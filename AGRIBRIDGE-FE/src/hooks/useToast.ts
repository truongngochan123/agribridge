import { createContext, useContext } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastConfirmOptions {
  title?: string
  confirmText?: string
  cancelText?: string
}

export interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
  showConfirm: (message: string, options?: ToastConfirmOptions) => Promise<boolean>
}

export const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}