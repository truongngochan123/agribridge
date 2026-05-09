import { isAxiosError } from 'axios'
import { Eye, EyeOff, LockKeyhole, Mail, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../../services/authService'
import { getStoredAuthSession, storeAuthSession } from '../../services/authSession'
import { usePageTitle } from '../../hooks/usePageTitle'

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return 'Vui lòng nhập email.'
  if (!SIMPLE_EMAIL_REGEX.test(normalized)) return 'Email không đúng định dạng.'
  return ''
}

function validatePassword(value: string): string {
  if (!value.trim()) return 'Vui lòng nhập mật khẩu.'
  if (value.trim().length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.'
  return ''
}

export function AdminLoginPage() {
  usePageTitle('Đăng nhập quản trị')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    const checkSession = () => {
      const session = getStoredAuthSession()
      if (!session || session.status !== 'SUCCESS') {
        return
      }

      const companyType = String(session.companyType ?? '').toLowerCase()
      if (companyType === 'admin' || companyType === 'system') {
        navigate('/admin/overview', { replace: true })
      } else if (companyType === 'buyer') {
        navigate('/buyer/overview', { replace: true })
      } else {
        navigate('/supplier/overview', { replace: true })
      }
    }

    checkSession()

    window.addEventListener('storage', checkSession)
    return () => window.removeEventListener('storage', checkSession)
  }, [navigate])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const nextEmailError = validateEmail(email)
    const nextPasswordError = validatePassword(password)
    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)

    if (nextEmailError || nextPasswordError) {
      return
    }

    try {
      setSubmitting(true)
      const normalizedEmail = email.trim().toLowerCase()
      const result = await login({ email: normalizedEmail, password })

      const companyType = String(result.companyType ?? '').toLowerCase()
      if (companyType !== 'admin' && companyType !== 'system') {
        setError('Tài khoản này không có quyền truy cập trang quản trị.')
        return
      }

      storeAuthSession(result, { email: normalizedEmail })
      navigate('/admin/overview', { replace: true })
    } catch (loginError: unknown) {
      const message = isAxiosError(loginError)
        ? loginError.response?.data?.message ?? 'Đăng nhập thất bại, vui lòng thử lại.'
        : 'Đăng nhập thất bại, vui lòng thử lại.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B1120]">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-emerald-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-emerald-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-700/10 blur-[100px]" />

      {/* Grid overlay */}
      <div className="admin-login-grid-overlay" />

      {/* Card */}
      <div className="relative z-10 mx-4 w-full max-w-[460px]">
        {/* Header badge */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 shadow-lg shadow-emerald-500/20 backdrop-blur-sm">
            <ShieldAlert className="h-8 w-8 text-emerald-400" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              AgriBridge Admin
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Cổng quản trị hệ thống — chỉ dành cho nội bộ
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Email quản trị
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-500">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@agribridge.vn"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError('')
                    if (error) setError('')
                  }}
                  onBlur={() => setEmailError(validateEmail(email))}
                  className={`h-12 w-full rounded-xl border bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:bg-white/8 focus:ring-2 ${
                    emailError
                      ? 'border-red-500/60 focus:ring-red-500/30'
                      : 'border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/20'
                  }`}
                />
              </div>
              {emailError && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-400">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Mật khẩu
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-500">
                  <LockKeyhole className="h-4 w-4" />
                </span>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (passwordError) setPasswordError('')
                    if (error) setError('')
                  }}
                  onBlur={() => setPasswordError(validatePassword(password))}
                  className={`h-12 w-full rounded-xl border bg-white/5 pl-10 pr-11 text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:bg-white/8 focus:ring-2 ${
                    passwordError
                      ? 'border-red-500/60 focus:ring-red-500/30'
                      : 'border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3.5 flex items-center text-slate-500 transition hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1.5 text-xs font-medium text-red-400">{passwordError}</p>
              )}
            </div>

            {/* Global error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm font-medium text-red-300">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              id="admin-login-submit"
              type="submit"
              disabled={submitting}
              className="group relative mt-2 flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Đang xác thực...
                </span>
              ) : (
                'Đăng nhập quản trị'
              )}
              {/* Shimmer effect */}
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-slate-600">
          Trang này chỉ dành cho nhân viên AgriBridge được cấp quyền.{' '}
          <a href="/auth/login" className="text-slate-500 underline-offset-2 hover:text-slate-400 hover:underline">
            Về trang đăng nhập thường
          </a>
        </p>
      </div>
    </div>
  )
}
