import type { ReactNode } from 'react'
import { Header } from '../Header'

type PublicPageShellProps = {
  children: ReactNode
}

export function PublicPageShell({ children }: PublicPageShellProps) {
  return (
    <div className="min-h-screen bg-[#F3F5F7] text-[#0F172A]">
      <Header variant="site" />
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}

export function Chip({ label }: { label: string }) {
  return <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{label}</span>
}

export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button className="rounded-lg bg-[#2F8F3A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#277A31]">
      {children}
    </button>
  )
}

export function OutlineButton({ children }: { children: ReactNode }) {
  return (
    <button className="rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
      {children}
    </button>
  )
}
