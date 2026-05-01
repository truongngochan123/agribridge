import { ChartLine, LockKeyhole, Mail, ShieldCheck, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../../services/authService'
import { storeAuthSession } from '../../services/authSession'
import { usePageTitle } from '../../hooks/usePageTitle'

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return 'Vui long nhap email.'
  if (!SIMPLE_EMAIL_REGEX.test(normalized)) return 'Email khong dung dinh dang.'
  return ''
}

function validatePassword(value: string): string {
  if (!value.trim()) return 'Vui long nhap mat khau.'
  if (value.trim().length < 6) return 'Mat khau phai co it nhat 6 ky tu.'
  return ''
}

export function LoginPage() {
  usePageTitle('Đăng nhập')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const nextEmailError = validateEmail(email)
    const nextPasswordError = validatePassword(password)
    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)

    if (nextEmailError || nextPasswordError) {
      setError('Vui long kiem tra lai thong tin dang nhap.')
      return
    }

    try {
      setSubmitting(true)
      const normalizedEmail = email.trim().toLowerCase()
      const result = await login({ email: normalizedEmail, password })
      storeAuthSession(result, { email: normalizedEmail })

      if (result.status === 'PENDING_VERIFICATION') {
        sessionStorage.setItem('agribridge.pending.email', normalizedEmail)
        navigate(`/onboarding/verification/pending?email=${encodeURIComponent(normalizedEmail)}`)
        return
      }

      if (result.redirectPath) {
        navigate(result.redirectPath)
        return
      }

      navigate('/supplier/overview')
    } catch (loginError: any) {
      const message = loginError?.response?.data?.message ?? 'Đăng nhập thất bại, vui lòng thử lại.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F5F7]">
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

        <main className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[440px]">
            <h2 className="text-center text-[48px] font-extrabold text-[#0F172A]">Đăng nhập</h2>
            <p className="mt-2 text-center text-[18px] text-[#667085]">Truy cập vào tài khoản của bạn bằng email đã đăng ký</p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#344054]">Email đăng nhập</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#98A2B3]">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      if (emailError) setEmailError('')
                    }}
                    onBlur={() => setEmailError(validateEmail(email))}
                    className="h-12 w-full rounded-lg border border-[#D9E1EA] bg-white pl-11 pr-4 text-[15px] text-[#0F172A] outline-none placeholder:text-[#98A2B3] focus:border-[#2F8F3A]"
                  />
                </div>
                {emailError ? <p className="mt-1 text-sm font-semibold text-[#DC2626]">{emailError}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#344054]">Mật khẩu</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#98A2B3]">
                    <LockKeyhole className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      if (passwordError) setPasswordError('')
                    }}
                    onBlur={() => setPasswordError(validatePassword(password))}
                    className="h-12 w-full rounded-lg border border-[#D9E1EA] bg-white pl-11 pr-4 text-[15px] text-[#0F172A] outline-none placeholder:text-[#98A2B3] focus:border-[#2F8F3A]"
                  />
                </div>
                {passwordError ? <p className="mt-1 text-sm font-semibold text-[#DC2626]">{passwordError}</p> : null}
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-sm text-[#667085]">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="h-4 w-4 rounded border border-[#D9E1EA] accent-[#2F8F3A]"
                  />
                  Nhớ tài khoản
                </label>
                <a href="#" className="text-sm font-semibold text-[#2F8F3A] hover:text-[#277A31]">
                  Quên mật khẩu?
                </a>
              </div>

              {error ? <p className="text-sm font-semibold text-[#DC2626]">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="block w-full rounded-lg bg-[#2F8F3A] py-3.5 text-center text-base font-semibold text-white transition hover:bg-[#277A31] disabled:cursor-not-allowed disabled:bg-[#93c5a1]"
              >
                {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-[#667085]">
              Chưa có tài khoản?{' '}
              <Link to="/onboarding/supplier/business-info" className="font-semibold text-[#2F8F3A]">
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
