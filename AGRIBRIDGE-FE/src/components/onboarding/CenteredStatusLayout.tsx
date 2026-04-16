import type { ReactNode } from 'react'

type CenteredStatusLayoutProps = {
  children: ReactNode
}

export function CenteredStatusLayout({ children }: CenteredStatusLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F3F5F7] px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center">
        <div className="mb-5 flex items-center gap-2">
          <img src="/images/logo.png" alt="AgriBridge" className="h-7 w-7 object-contain" />
          <span className="text-[28px] font-extrabold leading-none text-[#2F8F3A] md:text-[32px]">AgriBridge</span>
        </div>
        {children}
      </div>
    </div>
  )
}
