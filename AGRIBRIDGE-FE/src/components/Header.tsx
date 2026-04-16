import { CircleHelp, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const menuItems = [
  { label: 'Sản phẩm', path: '/suppliers' },
  { label: 'Nhà cung cấp', path: '/suppliers' },
  { label: 'Về chúng tôi', path: '/about' },
  { label: 'Hỗ trợ', path: '/support' },
]

type HeaderProps = {
  variant?: 'home' | 'onboarding' | 'site'
}

export function Header({ variant = 'home' }: HeaderProps) {
  const isOnboarding = variant === 'onboarding'
  const isSite = variant === 'site'
  const [open, setOpen] = useState(false)
  const [pastHero, setPastHero] = useState(false)

  useEffect(() => {
    if (isOnboarding || isSite) {
      return
    }

    const handleScroll = () => {
      const heroSection = document.getElementById('hero-section')

      if (!heroSection) {
        setPastHero(window.scrollY > 96)
        return
      }

      const heroBottom = heroSection.getBoundingClientRect().bottom
      setPastHero(heroBottom <= 96)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isOnboarding, isSite])

  return (
    <header
      className={
        isOnboarding
          ? 'fixed left-0 right-0 top-0 z-50 border-b border-[#D9E1EA] bg-white'
          : isSite
            ? 'sticky top-0 z-40 border-b border-emerald-100 bg-white'
          : `fixed left-0 right-0 top-0 z-50 transition-colors duration-300 ${
              pastHero
                ? 'border-b border-emerald-900/60 bg-emerald-950/75 backdrop-blur-md'
                : 'border-b border-transparent bg-transparent backdrop-blur-0'
            }`
      }
    >
      <nav
        className={`mx-auto flex items-center justify-between px-4 py-3 md:px-8 ${
          isOnboarding
            ? 'h-14 max-w-6xl text-[#0F172A]'
            : isSite
              ? 'max-w-7xl text-[#0F172A]'
              : 'max-w-7xl text-white'
        }`}
      >
        <Link to="/" className="flex items-center gap-3 text-xl font-extrabold tracking-tight">
          <img
            src="/images/logo.png"
            alt="Logo AgriBridge"
            className="h-8 w-8 rounded-lg object-contain md:h-9 md:w-9"
          />
          <span className={isOnboarding || isSite ? 'text-[#2F8F3A]' : ''}>AgriBridge</span>
        </Link>

        {!isOnboarding ? (
          <ul className="hidden items-center gap-7 text-base font-semibold lg:flex">
            {menuItems.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.path}
                  className={`transition ${isSite ? 'text-[#344054] hover:text-[#2F8F3A]' : 'hover:text-emerald-300'}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {!isOnboarding ? (
          <div className="hidden items-center gap-4 lg:flex">
            <Link
              to="/auth/login"
              className={`text-base font-semibold transition ${
                isSite ? 'text-[#0F172A] hover:text-[#2F8F3A]' : 'text-emerald-200 hover:text-white'
              }`}
            >
              Đăng nhập
            </Link>
            <Link
              to="/onboarding/supplier/business-info"
              className={`rounded-full px-5 py-2 text-base font-semibold text-white transition ${
                isSite ? 'bg-[#2F8F3A] hover:bg-[#277A31]' : 'bg-emerald-500 hover:bg-emerald-400'
              }`}
            >
              Đăng ký
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <Link
              to="/support"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#D9E1EA] bg-[#F9FBFD] px-2.5 py-1.5 text-[#667085] hover:text-[#344054]"
            >
              <CircleHelp className="h-3.5 w-3.5" />
              Contact Support
            </Link>
            <Link to="/auth/login" className="font-semibold text-[#2F8F3A] hover:text-[#277A31]">
              Đăng nhập
            </Link>
          </div>
        )}

        {!isOnboarding ? (
          <button
            onClick={() => setOpen((prev) => !prev)}
            className="rounded-md border border-white/30 p-2 lg:hidden"
            aria-label="Toggle menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        ) : null}
      </nav>

        {!isOnboarding && open && (
        <div className="border-t border-white/10 bg-slate-900/95 px-4 py-4 text-white lg:hidden">
          <ul className="space-y-3 pb-4">
            {menuItems.map((item) => (
              <li key={item.label}>
                <Link to={item.path} onClick={() => setOpen(false)} className="block rounded px-2 py-1 hover:bg-white/10">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <Link to="/auth/login" className="text-sm font-medium text-emerald-300">
              Đăng nhập
            </Link>
            <Link
              to="/onboarding/supplier/business-info"
              onClick={() => setOpen(false)}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold"
            >
              Đăng ký
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
