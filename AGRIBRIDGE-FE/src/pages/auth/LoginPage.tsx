import {
  AlertCircle,
  CheckCircle2,
  ChartLine,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  login,
  resetForgotPassword,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
} from '../../services/authService'
import { getStoredAuthSession, storeAuthSession } from '../../services/authSession'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useToast } from '../../hooks/useToast'

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REMEMBER_EMAIL_KEY = 'agribridge.auth.rememberEmail'
const REMEMBER_ENABLED_KEY = 'agribridge.auth.rememberEnabled'
const OTP_LENGTH = 6

type ForgotStep = 'email' | 'otp' | 'reset' | 'success'

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

function getResetPasswordRules(value: string) {
  return [
    { label: 'Tối thiểu 8 ký tự', passed: value.length >= 8 },
    { label: 'Có chữ hoa', passed: /[A-Z]/.test(value) },
    { label: 'Có chữ thường', passed: /[a-z]/.test(value) },
    { label: 'Có chữ số', passed: /\d/.test(value) },
    { label: 'Có ký tự đặc biệt', passed: /[^A-Za-z0-9]/.test(value) },
  ]
}

function getPasswordStrength(value: string): number {
  if (!value) return 0
  return getResetPasswordRules(value).filter((rule) => rule.passed).length
}

function getApiError(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const maybeResponse = error as { response?: { data?: { message?: string } } }
    return maybeResponse.response?.data?.message ?? fallback
  }
  return fallback
}

const STRENGTH_LABELS = ['', 'Rất yếu', 'Yếu', 'Trung bình', 'Khá', 'Mạnh']
const STRENGTH_COLORS = ['', '#EF4444', '#F97316', '#F59E0B', '#3B82F6', '#22C55E']

export function LoginPage() {
  usePageTitle('Đăng nhập')
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [restoredAccount, setRestoredAccount] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  const passwordInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  const passwordStrength = getPasswordStrength(password)
  const emailValid = emailTouched && !emailError && email.length > 0
  const passwordValid = passwordTouched && !passwordError && password.length > 0

  useEffect(() => {
    const rememberedEnabled = localStorage.getItem(REMEMBER_ENABLED_KEY) === 'true'
    const rememberedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY) ?? ''
    if (rememberedEnabled && rememberedEmail) {
      setEmail(rememberedEmail)
      setRemember(true)
      setEmailTouched(true)
      setEmailError('')
      setRestoredAccount(true)
      window.setTimeout(() => passwordInputRef.current?.focus(), 120)
      return
    }
    window.setTimeout(() => emailInputRef.current?.focus(), 120)
  }, [])

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

  const persistRememberedAccount = (normalizedEmail: string) => {
    if (remember) {
      localStorage.setItem(REMEMBER_ENABLED_KEY, 'true')
      localStorage.setItem(REMEMBER_EMAIL_KEY, normalizedEmail)
      setRestoredAccount(true)
      return
    }
    localStorage.removeItem(REMEMBER_ENABLED_KEY)
    localStorage.removeItem(REMEMBER_EMAIL_KEY)
    setRestoredAccount(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
      persistRememberedAccount(normalizedEmail)

      if (result.status === 'PENDING_VERIFICATION') {
        localStorage.setItem('agribridge.pending.email', normalizedEmail)
        navigate(`/onboarding/verification/pending?email=${encodeURIComponent(normalizedEmail)}`, { replace: true })
        return
      }

      if (result.status !== 'SUCCESS') {
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
    } catch (loginError: unknown) {
      setError(getApiError(loginError, 'Đăng nhập thất bại, vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

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
        @keyframes fadeSlideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes floatIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes softPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.62; } }
        .field-error { animation: fadeSlideDown 0.22s ease both; }
        .scale-in { animation: fadeScale 0.2s ease both; }
        .restore-chip { animation: floatIn 0.42s cubic-bezier(.2,.8,.2,1) both; }
        .login-btn { transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease; }
        .login-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(47,143,58,0.28); }
        .login-btn:not(:disabled):active { transform: translateY(0); box-shadow: none; }
        .input-field { transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; }
        .input-field:focus { box-shadow: 0 0 0 3px rgba(47,143,58,0.12); }
        .error-input:focus { box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }
        .auth-modal { animation: fadeScale 0.22s ease both; }
      `}</style>

      <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
        <aside className="relative hidden overflow-hidden lg:flex">
          <img src="/images/background4.jpg" alt="Nông nghiệp công nghệ" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#139D74]/90 to-[#087853]/88" />

          <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 text-white">
            <div className="flex items-center gap-2.5">
              <img src="/images/logo.png" alt="AgriBridge" className="h-7 w-7 object-contain" />
              <span className="text-[34px] font-extrabold leading-none">AgriBridge</span>
            </div>

            <div>
              <h1 className="text-[clamp(42px,4vw,58px)] font-extrabold leading-[1.05]">Chào mừng trở lại!</h1>
              <p className="mt-4 max-w-lg text-[clamp(20px,2vw,27px)] leading-relaxed text-emerald-50">
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

        <main className="flex items-center justify-center px-5 py-10 sm:px-6 lg:py-12">
          <div className="w-full max-w-[440px]">
            <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
              <img src="/images/logo.png" alt="AgriBridge" className="h-8 w-8 object-contain" />
              <span className="text-2xl font-black text-[#0F172A]">AgriBridge</span>
            </div>

            <h2 className="text-center text-[clamp(34px,8vw,48px)] font-extrabold text-[#0F172A]">Đăng nhập</h2>
            <p className="mt-2 text-center text-[16px] leading-6 text-[#667085] sm:text-[18px]">
              Truy cập vào tài khoản của bạn bằng email đã đăng ký
            </p>

            {restoredAccount ? (
              <div className="restore-chip mt-5 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-4 py-3 shadow-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-800">Đã ghi nhớ tài khoản</p>
                    <p className="truncate text-xs font-medium text-emerald-700">{email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRemember(false)
                    setRestoredAccount(false)
                    localStorage.removeItem(REMEMBER_ENABLED_KEY)
                    localStorage.removeItem(REMEMBER_EMAIL_KEY)
                    setEmail('')
                    window.setTimeout(() => emailInputRef.current?.focus(), 0)
                  }}
                  className="rounded-full p-1.5 text-emerald-700 transition hover:bg-emerald-100"
                  aria-label="Bỏ ghi nhớ tài khoản"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#344054]">Email đăng nhập</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#98A2B3]">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id="login-email"
                    ref={emailInputRef}
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(event) => {
                      const nextEmail = event.target.value
                      setEmail(nextEmail)
                      setRestoredAccount(false)
                      if (emailTouched) setEmailError(validateEmail(nextEmail))
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => {
                      setEmailFocused(false)
                      setEmailTouched(true)
                      setEmailError(validateEmail(email))
                    }}
                    style={{ borderColor: getEmailBorderColor() }}
                    className={`input-field h-12 w-full rounded-xl border bg-white pl-11 pr-10 text-[15px] text-[#0F172A] outline-none placeholder:text-[#98A2B3] ${emailTouched && emailError ? 'error-input' : ''}`}
                  />
                  {emailValid ? (
                    <span className="scale-in pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#22C55E]">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  ) : null}
                  {emailTouched && emailError ? (
                    <span className="scale-in pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#EF4444]">
                      <AlertCircle className="h-4 w-4" />
                    </span>
                  ) : null}
                </div>
                {emailTouched && emailError ? (
                  <p className="field-error mt-1.5 flex items-center gap-1 text-sm font-medium text-[#EF4444]">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {emailError}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#344054]">Mật khẩu</label>
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
                    onChange={(event) => {
                      setPassword(event.target.value)
                      if (passwordTouched) setPasswordError(validatePassword(event.target.value))
                    }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => {
                      setPasswordFocused(false)
                      setPasswordTouched(true)
                      setPasswordError(validatePassword(password))
                    }}
                    style={{ borderColor: getPasswordBorderColor() }}
                    className={`input-field h-12 w-full rounded-xl border bg-white pl-11 pr-20 text-[15px] text-[#0F172A] outline-none placeholder:text-[#98A2B3] ${passwordTouched && passwordError ? 'error-input' : ''}`}
                  />

                  <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
                    {passwordValid ? <CheckCircle2 className="h-4 w-4 text-[#22C55E]" /> : null}
                    {passwordTouched && passwordError ? <AlertCircle className="h-4 w-4 text-[#EF4444]" /> : null}
                    <button
                      type="button"
                      id="toggle-password-visibility"
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      onClick={() => {
                        setShowPassword((value) => !value)
                        window.setTimeout(() => passwordInputRef.current?.focus(), 0)
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#98A2B3] transition hover:bg-gray-100 hover:text-[#2F8F3A]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {password.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div key={level} className="h-1 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: passwordStrength >= level ? '100%' : '0%',
                              background: STRENGTH_COLORS[passwordStrength],
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    {passwordStrength > 0 ? (
                      <p className="text-xs font-medium" style={{ color: STRENGTH_COLORS[passwordStrength] }}>
                        Độ mạnh: {STRENGTH_LABELS[passwordStrength]}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {passwordTouched && passwordError ? (
                  <p className="field-error mt-1.5 flex items-center gap-1 text-sm font-medium text-[#EF4444]">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {passwordError}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#667085]">
                  <input
                    type="checkbox"
                    id="remember-me"
                    checked={remember}
                    onChange={(event) => {
                      setRemember(event.target.checked)
                      if (!event.target.checked) {
                        localStorage.removeItem(REMEMBER_ENABLED_KEY)
                        localStorage.removeItem(REMEMBER_EMAIL_KEY)
                        setRestoredAccount(false)
                      }
                    }}
                    className="h-4 w-4 cursor-pointer rounded border border-[#D9E1EA] accent-[#2F8F3A]"
                  />
                  Nhớ tài khoản
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-sm font-semibold text-[#2F8F3A] transition hover:text-[#277A31] hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>

              {error ? (
                <div className="field-error flex items-center gap-2 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" />
                  <p className="text-sm font-medium text-[#DC2626]">{error}</p>
                </div>
              ) : null}

              <button
                type="submit"
                id="login-submit-btn"
                disabled={submitting}
                className="login-btn block w-full rounded-xl bg-gradient-to-r from-[#2F8F3A] to-[#119267] py-3.5 text-center text-base font-semibold text-white disabled:cursor-not-allowed disabled:from-[#93c5a1] disabled:to-[#93c5a1]"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
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

      {forgotOpen ? (
        <ForgotPasswordModal
          initialEmail={email}
          onClose={() => setForgotOpen(false)}
          onBackToLogin={(nextEmail) => {
            setForgotOpen(false)
            setEmail(nextEmail)
            setPassword('')
            setPasswordTouched(false)
            setPasswordError('')
            window.setTimeout(() => passwordInputRef.current?.focus(), 120)
          }}
          showToast={showToast}
        />
      ) : null}
    </div>
  )
}

function ForgotPasswordModal({
  initialEmail,
  onClose,
  onBackToLogin,
  showToast,
}: {
  initialEmail: string
  onClose: () => void
  onBackToLogin: (email: string) => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}) {
  const [step, setStep] = useState<ForgotStep>('email')
  const [email, setEmail] = useState(initialEmail.trim().toLowerCase())
  const [emailError, setEmailError] = useState('')
  const [otp, setOtp] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ''))
  const [otpError, setOtpError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [resetError, setResetError] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const otpRefs = useRef<Array<HTMLInputElement | null>>([])
  const emailRef = useRef<HTMLInputElement>(null)

  const normalizedEmail = email.trim().toLowerCase()
  const joinedOtp = otp.join('')
  const resetRules = useMemo(() => getResetPasswordRules(newPassword), [newPassword])
  const resetStrength = resetRules.filter((rule) => rule.passed).length
  const passwordReady = resetRules.every((rule) => rule.passed)
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword

  useEffect(() => {
    window.setTimeout(() => {
      if (step === 'email') emailRef.current?.focus()
      if (step === 'otp') otpRefs.current[0]?.focus()
    }, 120)
  }, [step])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [countdown])

  const submitEmail = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    const nextError = validateEmail(email)
    setEmailError(nextError)
    setOtpError('')
    if (nextError) return

    try {
      setLoading(true)
      const response = await sendForgotPasswordOtp(normalizedEmail)
      setCountdown(response.resendAfterSeconds || 60)
      setStep('otp')
      showToast('Mã xác thực đã được gửi tới email của bạn', 'success')
    } catch (error) {
      const message = getApiError(error, 'Không thể gửi mã xác thực. Vui lòng thử lại.')
      setEmailError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    setOtpError('')
    if (!/^\d{6}$/.test(joinedOtp)) {
      setOtpError('Vui lòng nhập đủ 6 chữ số OTP.')
      return
    }

    try {
      setLoading(true)
      await verifyForgotPasswordOtp(normalizedEmail, joinedOtp)
      setStep('reset')
      showToast('Mã xác thực hợp lệ', 'success')
    } catch (error) {
      const message = getApiError(error, 'Mã OTP không chính xác hoặc đã hết hạn.')
      setOtpError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const submitReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setResetError('')
    if (!passwordReady) {
      setResetError('Mật khẩu mới chưa đáp ứng yêu cầu bảo mật.')
      return
    }
    if (newPassword !== confirmPassword) {
      setResetError('Mật khẩu xác nhận không khớp.')
      return
    }

    try {
      setLoading(true)
      await resetForgotPassword(normalizedEmail, joinedOtp, newPassword)
      setStep('success')
      showToast('Mật khẩu đã được cập nhật thành công', 'success')
    } catch (error) {
      const message = getApiError(error, 'Không thể cập nhật mật khẩu. Vui lòng thử lại.')
      setResetError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    setOtp((current) => {
      const next = [...current]
      next[index] = digit
      return next
    })
    setOtpError('')
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpPaste = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH).split('')
    if (!digits.length) return
    setOtp(Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] ?? ''))
    setOtpError('')
    window.setTimeout(() => otpRefs.current[Math.min(digits.length, OTP_LENGTH) - 1]?.focus(), 0)
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="auth-modal max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200">
                <KeyRound className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-black text-slate-950">Quên mật khẩu</h3>
                <p className="text-xs font-semibold text-slate-500">Xác thực email để đặt lại mật khẩu</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-5">
          <StepProgress step={step} />

          {step === 'email' ? (
            <form className="mt-6 space-y-4" onSubmit={submitEmail} noValidate>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-sm font-semibold text-emerald-900">Nhập email đã đăng ký. AgriBridge sẽ gửi mã xác thực gồm 6 chữ số để bảo vệ tài khoản của bạn.</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">Email đã đăng ký</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={emailRef}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value.toLowerCase())
                      setEmailError('')
                    }}
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    className={`h-12 w-full rounded-xl border bg-white pl-11 pr-4 text-sm font-medium text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${emailError ? 'border-red-300' : 'border-slate-200'}`}
                  />
                </div>
                {emailError ? <InlineError message={emailError} /> : null}
              </div>
              <PrimaryModalButton loading={loading} text="Gửi mã xác thực" loadingText="Đang gửi mã xác thực..." />
            </form>
          ) : null}

          {step === 'otp' ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Mã xác thực đã được gửi tới email của bạn</p>
                <p className="mt-1 text-sm font-bold text-slate-950">{normalizedEmail}</p>
              </div>

              <div>
                <label className="mb-3 block text-sm font-bold text-slate-700">Mã OTP</label>
                <div className="grid grid-cols-6 gap-2 sm:gap-3">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(node) => {
                        otpRefs.current[index] = node
                      }}
                      value={digit}
                      onChange={(event) => handleOtpChange(index, event.target.value)}
                      onPaste={(event) => {
                        event.preventDefault()
                        handleOtpPaste(event.clipboardData.getData('text'))
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Backspace' && !otp[index] && index > 0) {
                          otpRefs.current[index - 1]?.focus()
                        }
                      }}
                      inputMode="numeric"
                      maxLength={1}
                      className={`aspect-square min-h-12 rounded-xl border bg-white text-center text-xl font-black text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${otpError ? 'border-red-300' : 'border-slate-200'}`}
                    />
                  ))}
                </div>
                {otpError ? <InlineError message={otpError} /> : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-600">
                  {countdown > 0 ? `Gửi lại sau ${countdown}s` : 'Bạn có thể gửi lại mã xác thực.'}
                </p>
                <button
                  type="button"
                  disabled={loading || countdown > 0}
                  onClick={() => submitEmail()}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Gửi lại mã
                </button>
              </div>

              <button
                type="button"
                onClick={verifyOtp}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2F8F3A] to-[#119267] px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {loading ? 'Đang xác thực...' : 'Xác thực mã'}
              </button>
            </div>
          ) : null}

          {step === 'reset' ? (
            <form className="mt-6 space-y-5" onSubmit={submitReset}>
              <PasswordField
                label="Mật khẩu mới"
                value={newPassword}
                onChange={(value) => {
                  setNewPassword(value)
                  setResetError('')
                }}
                visible={showNewPassword}
                onToggle={() => setShowNewPassword((value) => !value)}
                autoComplete="new-password"
              />

              <div className="space-y-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div key={level} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: resetStrength >= level ? '100%' : '0%',
                          background: STRENGTH_COLORS[resetStrength],
                        }}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs font-bold" style={{ color: STRENGTH_COLORS[resetStrength] || '#64748B' }}>
                  Độ mạnh: {STRENGTH_LABELS[resetStrength] || 'Chưa nhập'}
                </p>
              </div>

              <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                {resetRules.map((rule) => (
                  <div key={rule.label} className={`flex items-center gap-2 text-xs font-bold ${rule.passed ? 'text-emerald-700' : 'text-slate-500'}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full ${rule.passed ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                      <Check className="h-3 w-3" />
                    </span>
                    {rule.label}
                  </div>
                ))}
              </div>

              <PasswordField
                label="Xác nhận mật khẩu"
                value={confirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value)
                  setResetError('')
                }}
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((value) => !value)}
                autoComplete="new-password"
              />

              {confirmPassword && !passwordsMatch ? <InlineError message="Mật khẩu xác nhận không khớp." /> : null}
              {resetError ? <InlineError message={resetError} /> : null}
              <PrimaryModalButton loading={loading} text="Cập nhật mật khẩu" loadingText="Đang cập nhật mật khẩu..." />
            </form>
          ) : null}

          {step === 'success' ? (
            <div className="mt-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Sparkles className="h-9 w-9" />
              </div>
              <h4 className="mt-5 text-2xl font-black text-slate-950">Mật khẩu đã được cập nhật thành công</h4>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                Bạn có thể quay về màn hình đăng nhập và sử dụng mật khẩu mới cho tài khoản này.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => onBackToLogin(normalizedEmail)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  Quay về đăng nhập
                </button>
                <button type="button" onClick={() => onBackToLogin(normalizedEmail)} className="rounded-xl bg-gradient-to-r from-[#2F8F3A] to-[#119267] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition hover:-translate-y-0.5">
                  Đăng nhập ngay
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StepProgress({ step }: { step: ForgotStep }) {
  const steps: Array<{ key: ForgotStep; label: string }> = [
    { key: 'email', label: 'Email' },
    { key: 'otp', label: 'OTP' },
    { key: 'reset', label: 'Mật khẩu' },
    { key: 'success', label: 'Hoàn tất' },
  ]
  const activeIndex = steps.findIndex((item) => item.key === step)

  return (
    <div className="grid grid-cols-4 gap-2">
      {steps.map((item, index) => {
        const active = index <= activeIndex
        return (
          <div key={item.key} className="min-w-0">
            <div className={`h-1.5 rounded-full transition ${active ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            <p className={`mt-2 truncate text-center text-[11px] font-bold ${active ? 'text-emerald-700' : 'text-slate-400'}`}>{item.label}</p>
          </div>
        )
      })}
    </div>
  )
}

function PrimaryModalButton({ loading, text, loadingText }: { loading: boolean; text: string; loadingText: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2F8F3A] to-[#119267] px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {loading ? loadingText : text}
    </button>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  visible: boolean
  onToggle: () => void
  autoComplete: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm font-medium text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
        />
        <button type="button" onClick={onToggle} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-emerald-700" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="field-error mt-2 flex items-start gap-1.5 text-sm font-semibold text-red-600">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  )
}

function Feature({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 rounded-full bg-white/20 p-2">{icon}</div>
      <div>
        <p className="text-[clamp(20px,2vw,27px)] font-bold">{title}</p>
        <p className="text-[clamp(15px,1.5vw,20px)] text-emerald-100">{description}</p>
      </div>
    </div>
  )
}
