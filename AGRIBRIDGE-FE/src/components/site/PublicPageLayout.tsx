import type { ReactNode } from 'react'
import { Header } from '../Header'

type PublicPageLayoutProps = {
  title?: string
  subtitle?: string
  children: ReactNode
}

export function PublicPageLayout({ title, subtitle, children }: PublicPageLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F3F5F7] text-[#0F172A]">
      <Header variant="site" />
      <main className="mx-auto max-w-7xl px-6 py-8">
        {title ? (
          <div className="mb-6">
            <h1 className="text-5xl font-extrabold text-[#0F172A]">{title}</h1>
            {subtitle ? <p className="mt-1 text-base text-[#667085]">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  )
}
