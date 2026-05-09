import {
  AlertCircle,
  CheckCircle2,
  ChartLine,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  if (!value) return 'Vui lòng nhập mật khẩu.'
  if (value.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.'
  return ''
}

/** Tính độ mạnh mật khẩu: 0–4 */
function getPasswordStrength(value: string): number {
  if (!value) return 0
  let score = 0
  if (value.length >= 8) score++
  if (/[A-Z]/.test(value)) score++
  if (/[0-9]/.test(value)) score++
  if (/[^A-Za-z0-9]/.test(value)) score++
  return score
}

const STRENGTH_LABELS = ['', 'Yếu', 'Trung bình', 'Khá', 'Mạnh']
const STRENGTH_COLORS = ['', '#EF4444', '#F59E0B', '#3B82F6', '#22C55E']

export function LoginPage() {
  usePageTitle('Đăng nhập')
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  const passwordInputRef = useRef<HTMLInputElement>(null)

  const passwordStrength = getPasswordStrength(password)
  const emailValid = emailTouched && !emailError && email.length > 0
  const passwordValid = passwordTouched && !passwordError && password.length > 0

  useEffect(() => {
    const checkSession = () => {
      const session = getStoredAuthSession()
      if (!session || session.status !== 'SUCCESS') return

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
    setEmailTouched(true)
    setPasswordTouched(true)

    if (nextEmailError || nextPasswordError) return

    try {
      setSubmitting(true)
      const normalizedEmail = email.trim().toLowerCase()
      const result = await login({ email: normalizedEmail, password })
      storeAuthSession(result, { email: normalizedEmail })

      if (result.status === 'PENDING_VERIFICATION') {
        localStorage.setItem('agribridge.pending.email', normalizedEmail)
        navigate(`/onboarding/verification/pending?email=${encodeURIComponent(normalizedEmail)}`, { replace: true })
        return
      }
      
      if (result.status !== 'SUCCESS') {
        // Fallback for NEED_MORE_INFO or REJECTED
        navigate(result.redirectPath || '/auth/login', { replace: true })
        return
      }

      const companyType = String(result.companyType ?? '').toLowerCase()
      if (companyType === 'admin' || companyType === 'system') {
        navigate('/admin/overview', { replace: true })
      } else if (companyType === 'buyer') {
        navigate('/buyer/overview', { replace: true })
      } else {
        navigate('/supplier/overview', { replace: true })
      }
    } catch (loginError: any) {
      const message = loginError?.response?.data?.message ?? 'Đăng nhập thất bại, vui lòng thử lại.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  /* ─── border color helper ─── */
  function getEmailBorderColor() {
    if (emailFocused && !emailError) return '#2F8F3A'
    if (emailTouched && emailError) return '#EF4444'
    if (emailValid) return '#22C55E'
    return '#D9E1EA'
  }
  function getPasswordBorderColor() {
    if (passwordFocused && !passwordError) return '#2F8F3A'
    if (passwordTouched && passwordError) return '#EF4444'
    if (passwordValid) return '#22C55E'
    return '#D9E1EA'
  }

  return (
    <div className="min-h-screen bg-[#F3F5F7]">
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shakeX {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse-soft {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.6; }
        }
        .field-error { animation: fadeSlideDown 0.22s ease both; }
        .shake       { animation: shakeX 0.35s ease both; }
        .scale-in    { animation: scaleIn 0.2s ease both; }
        .login-btn   { transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease; }
        .login-btn:not(:disabled):hover  { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(47,143,58,0.35); }
        .login-btn:not(:disabled):active { transform: translateY(0px); box-shadow: none; }
        .eye-btn     { transition: color 0.15s ease; }
        .eye-btn:hover { color: #2F8F3A; }
        .strength-bar { transition: width 0.4s ease, background 0.4s ease; border-radius: 99px; height: 4px; }
        .input-field  { transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .input-field:focus { box-shadow: 0 0 0 3px rgba(47,143,58,0.12); }
        .error-input:focus { box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }
      `}</style>

      <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
        {/* ── LEFT PANEL ── */}
        <aside className="relative hidden overflow-hidden lg:flex">
          <img
            src="/images/background4.jpg"
            alt="Nông nghiệp công nghệ"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#139D74]/90 to-[#087853]/88" />

          <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 text-white">
            <div className="flex items-center gap-2.5">
              <img src="/images/logo.png" alt="AgriBridge" className="h-7 w-7 object-contain" />
              <span className="text-[34px] font-extrabold leading-none">AgriBridge</span>
            </div>

            <div>
              <h1 className="text-[58px] font-extrabold leading-[1.05]">Chào mừng trở lại!</h1>
              <p className="mt-4 max-w-lg text-[27px] leading-10 text-emerald-50">
                Đăng nhập bằng email để quản lý đơn hàng, theo dõi giao hàng và kết nối với đối tác kinh doanh.
              </p>

              <div className="mt-10 space-y-5">
                <Feature icon={<ChartLine className="h-5 w-5" />} title="Quản lý hiệu quả" description="Theo dõi đơn hàng, công nợ và doanh thu realtime" />
                <Feature icon={<Users className="h-5 w-5" />} title="Kết nối đối tác" description="Mở rộng mạng lưới kinh doanh toàn quốc" />
                <Feature icon={<ShieldCheck className="h-5 w-5" />} title="An toàn bảo mật" description="Thông tin được mã hóa và bảo vệ tuyệt đối" />
              </div>
            </div>

            <div />
          </div>
        </aside>

        {/* ── RIGHT PANEL ── */}
        <main className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[440px]">
            <h2 className="text-center text-[48px] font-extrabold text-[#0F172A]">Đăng nhập</h2>
            <p className="mt-2 text-center text-[18px] text-[#667085]">
              Truy cập vào tài khoản của bạn bằng email đã đăng ký
            </p>

            <form
              className="mt-8 space-y-5"
              onSubmit={handleSubmit}
              noValidate
            >
              {/* ── EMAIL ── */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#344054]">
                  Email đăng nhập
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#98A2B3]">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (emailTouched) setEmailError(validateEmail(e.target.value))
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => {
                      setEmailFocused(false)
                      setEmailTouched(true)
                      setEmailError(validateEmail(email))
                    }}
                    style={{ borderColor: getEmailBorderColor() }}
                    className={`input-field h-12 w-full rounded-lg border bg-white pl-11 pr-10 text-[15px] text-[#0F172A] outline-none placeholder:text-[#98A2B3] ${emailTouched && emailError ? 'error-input' : ''}`}
                  />
                  {/* Valid checkmark */}
                  {emailValid && (
                    <span className="scale-in pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#22C55E]">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  )}
                  {/* Error icon */}
                  {emailTouched && emailError && (
                    <span className="scale-in pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#EF4444]">
                      <AlertCircle className="h-4 w-4" />
                    </span>
                  )}
                </div>
                {emailTouched && emailError && (
                  <p className="field-error mt-1.5 flex items-center gap-1 text-sm font-medium text-[#EF4444]">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>

              {/* ── PASSWORD ── */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#344054]">
                  Mật khẩu
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#98A2B3]">
                    <LockKeyhole className="h-4 w-4" />
                  </span>
                  <input
                    id="login-password"
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (passwordTouched) setPasswordError(validatePassword(e.target.value))
                    }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => {
                      setPasswordFocused(false)
                      setPasswordTouched(true)
                      setPasswordError(validatePassword(password))
                    }}
                    style={{ borderColor: getPasswordBorderColor() }}
                    className={`input-field h-12 w-full rounded-lg border bg-white pl-11 pr-20 text-[15px] text-[#0F172A] outline-none placeholder:text-[#98A2B3] ${passwordTouched && passwordError ? 'error-input' : ''}`}
                  />

                  {/* Right side icons */}
                  <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
                    {/* Valid / Error icon */}
                    {passwordValid && (
                      <span className="scale-in pointer-events-none flex items-center text-[#22C55E]">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    )}
                    {passwordTouched && passwordError && (
                      <span className="scale-in pointer-events-none flex items-center text-[#EF4444]">
                        <AlertCircle className="h-4 w-4" />
                      </span>
                    )}
                    {/* Show/Hide button */}
                    <button
                      type="button"
                      id="toggle-password-visibility"
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      onClick={() => {
                        setShowPassword((v) => !v)
                        // keep focus on input
                        setTimeout(() => passwordInputRef.current?.focus(), 0)
                      }}
                      className="eye-btn flex h-8 w-8 items-center justify-center rounded-md text-[#98A2B3] hover:bg-gray-100"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password strength bar */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div key={level} className="h-1 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
                          <div
                            className="strength-bar h-full"
                            style={{
                              width: passwordStrength >= level ? '100%' : '0%',
                              background: STRENGTH_COLORS[passwordStrength],
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    {passwordStrength > 0 && (
                      <p className="text-xs font-medium" style={{ color: STRENGTH_COLORS[passwordStrength] }}>
                        Độ mạnh: {STRENGTH_LABELS[passwordStrength]}
                      </p>
                    )}
                  </div>
                )}

                {passwordTouched && passwordError && (
                  <p className="field-error mt-1.5 flex items-center gap-1 text-sm font-medium text-[#EF4444]">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {passwordError}
                  </p>
                )}
              </div>

              {/* ── REMEMBER / FORGOT ── */}
              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#667085]">
                  <input
                    type="checkbox"
                    id="remember-me"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border border-[#D9E1EA] accent-[#2F8F3A]"
                  />
                  Nhớ tài khoản
                </label>
                <a href="#" className="text-sm font-semibold text-[#2F8F3A] transition hover:text-[#277A31] hover:underline">
                  Quên mật khẩu?
                </a>
              </div>

              {/* ── GLOBAL ERROR ── */}
              {error && (
                <div className="field-error flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" />
                  <p className="text-sm font-medium text-[#DC2626]">{error}</p>
                </div>
              )}

              {/* ── SUBMIT ── */}
              <button
                type="submit"
                id="login-submit-btn"
                disabled={submitting}
                className="login-btn block w-full rounded-lg bg-[#2F8F3A] py-3.5 text-center text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#93c5a1]"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Đang đăng nhập...
                  </span>
                ) : (
                  'Đăng nhập'
                )}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-[#667085]">
              Chưa có tài khoản?{' '}
              <Link to="/onboarding/supplier/business-info" className="font-semibold text-[#2F8F3A] hover:underline">
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

function Feature({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 rounded-full bg-white/20 p-2">{icon}</div>
      <div>
        <p className="text-[27px] font-bold">{title}</p>
        <p className="text-[20px] text-emerald-100">{description}</p>
      </div>
    </div>
  )
}
