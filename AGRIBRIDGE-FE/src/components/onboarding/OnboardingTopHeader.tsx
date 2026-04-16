import { CircleHelp } from 'lucide-react'

export function OnboardingTopHeader() {
  return (
    <header className="border-b border-[#D9E1EA] bg-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <img src="/images/logo.png" alt="AgriBridge" className="h-8 w-8 object-contain" />
          <span className="text-[38px] font-extrabold leading-none text-[#2F8F3A]">AgriBridge</span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#D9E1EA] bg-[#F9FBFD] text-[#667085]">
            <CircleHelp className="h-4 w-4" />
          </div>
          <span className="text-[#667085]">Need help?</span>
          <a href="#" className="font-semibold text-[#2F8F3A] hover:text-[#277A31]">
            Contact Support
          </a>
        </div>
      </div>
    </header>
  )
}
