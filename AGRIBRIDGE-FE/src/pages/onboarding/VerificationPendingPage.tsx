import { AlertTriangle, Clock3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CenteredStatusLayout } from '../../components/onboarding/CenteredStatusLayout'
import { checkRegistrationStatusByEmail } from '../../services/authService'
import { usePageTitle } from '../../hooks/usePageTitle'

export function VerificationPendingPage() {
  usePageTitle('Hồ sơ đang chờ duyệt')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentRole = searchParams.get('role') === 'buyer' ? 'buyer' : 'supplier'
  const [checking, setChecking] = useState(false)
  const [statusNote, setStatusNote] = useState('Đang chờ')
  const [error, setError] = useState('')

  const emailFromQuery = searchParams.get('email')?.trim().toLowerCase() ?? ''
  const pendingEmail = emailFromQuery || (sessionStorage.getItem('agribridge.pending.email') ?? '').trim().toLowerCase()

  useEffect(() => {
    if (!pendingEmail) return

    let active = true

    const checkStatus = async () => {
      try {
        setChecking(true)
        setError('')
        const result = await checkRegistrationStatusByEmail(pendingEmail)
        if (!active) return

        if (result.status === 'SUCCESS' && result.redirectPath) {
          sessionStorage.removeItem('agribridge.pending.email')
          navigate(result.redirectPath, { replace: true })
          return
        }

        setStatusNote('Đang chờ xác minh')
      } catch {
        if (active) {
          setError('Không thể cập nhật trạng thái tự động. Bạn có thể bấm kiểm tra lại hoặc đăng nhập lại.')
        }
      } finally {
        if (active) setChecking(false)
      }
    }

    void checkStatus()
    const intervalId = window.setInterval(() => {
      void checkStatus()
    }, 10000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [pendingEmail, navigate])

  const handleCheckNow = async () => {
    if (!pendingEmail) {
      setError('Thiếu email để kiểm tra trạng thái. Vui lòng đăng nhập lại.')
      return
    }

    try {
      setChecking(true)
      setError('')
      const result = await checkRegistrationStatusByEmail(pendingEmail)
      if (result.status === 'SUCCESS' && result.redirectPath) {
        sessionStorage.removeItem('agribridge.pending.email')
        navigate(result.redirectPath, { replace: true })
        return
      }
      setStatusNote('Đang chờ xác minh')
    } catch {
      setError('Chưa thể lấy trạng thái mới nhất. Vui lòng thử lại sau ít phút.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <CenteredStatusLayout>
      <div className="w-full max-w-lg rounded-2xl border border-[#E6ECF2] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.06)] md:p-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF7ED] text-[#D97706] md:h-20 md:w-20">
          <Clock3 className="h-7 w-7 md:h-9 md:w-9" />
        </div>

        <h1 className="mt-4 text-center text-[32px] font-extrabold leading-tight text-[#0F172A] md:text-[36px]">
          Hồ sơ đang chờ admin duyệt
        </h1>
        <p className="mx-auto mt-3 max-w-md text-center text-[14px] leading-6 text-[#667085]">
          Điểm xác minh tự động của bạn chưa đủ ngưỡng. Admin sẽ xem xét hồ sơ và liên hệ trong vòng{' '}
          <span className="font-semibold text-[#0F172A]">1-3 ngày làm việc</span>.
        </p>

        <div className="mt-4 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF7ED] px-3 py-1.5 text-xs font-bold text-[#D97706] md:text-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#D97706]" />
            Chờ duyệt thủ công
          </span>
        </div>

        {/* Feature restriction notice */}
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-sm text-[#92400E]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]" />
          <div>
            <p className="font-semibold">Một số chức năng bị tạm giới hạn:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
              <li>Đăng sản phẩm và lô hàng công khai</li>
              <li>Xác nhận đơn hàng từ buyer</li>
            </ul>
            <p className="mt-1 text-xs">Bạn vẫn có thể xem dashboard và cập nhật hồ sơ trong lúc chờ.</p>
          </div>
        </div>

        <div className="my-5 border-t border-[#E6ECF2]" />

        <div className="grid grid-cols-2 gap-y-3 text-[14px]">
          <span className="text-[#667085]">Trạng thái:</span>
          <span className="text-right font-bold text-[#0F172A]">{statusNote}</span>
          <span className="text-[#667085]">Email đăng ký:</span>
          <span className="text-right font-bold text-[#0F172A] break-all">{pendingEmail || 'Chưa có'}</span>
          <span className="text-[#667085]">Thời gian dự kiến:</span>
          <span className="text-right font-bold text-[#0F172A]">1-3 ngày làm việc</span>
        </div>

        <div className="my-5 border-t border-[#E6ECF2]" />

        {error ? <p className="mb-3 text-center text-xs font-semibold text-[#DC2626]">{error}</p> : null}

        <button
          type="button"
          onClick={handleCheckNow}
          disabled={checking}
          className="block w-full rounded-lg border border-[#D0D5DD] py-2.5 text-center text-sm font-semibold text-[#344054] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60 md:py-3"
        >
          {checking ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái ngay'}
        </button>

        <Link
          to={`/onboarding/${currentRole}/business-info`}
          className="mt-3 block w-full rounded-lg bg-[#2F8F3A] py-2.5 text-center text-sm font-semibold text-white transition hover:bg-[#277A31] md:py-3"
        >
          Cập nhật hồ sơ
        </Link>
        <Link to="/auth/login" className="mt-3 block w-full text-center text-sm font-semibold text-[#667085] hover:text-[#344054]">
          Quay lại đăng nhập
        </Link>
      </div>

      <p className="mt-5 text-center text-xs text-[#98A2B3] md:text-sm">Bạn sẽ nhận được thông báo khi tài khoản được phê duyệt.</p>
    </CenteredStatusLayout>
  )
}

