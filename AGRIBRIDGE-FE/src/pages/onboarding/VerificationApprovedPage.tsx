import { Check, MessageSquareQuote, Plus, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CenteredStatusLayout } from '../../components/onboarding/CenteredStatusLayout'

const nextSteps = [
  {
    title: 'Hoàn thiện hồ sơ doanh nghiệp',
    description: 'Cập nhật đầy đủ thông tin để tăng uy tín',
    icon: UserRound,
  },
  {
    title: 'Thêm sản phẩm mới',
    description: 'Bắt đầu giới thiệu hàng hóa tới đối tác',
    icon: Plus,
  },
  {
    title: 'Phản hồi RFQ để tăng cơ hội bán hàng',
    description: 'Kết nối trực tiếp với các đơn hàng đang tìm kiếm',
    icon: MessageSquareQuote,
  },
]

export function VerificationApprovedPage() {
  return (
    <CenteredStatusLayout>
      {/* Success status card */}
      <div className="w-full max-w-xl rounded-3xl border border-[#E6ECF2] bg-white p-8 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#E9F7EC] text-[#2F8F3A]">
          <Check className="h-10 w-10" />
        </div>

        <div className="mt-5 flex justify-center">
          <span className="inline-flex rounded-full bg-[#E9F7EC] px-4 py-1.5 text-xs font-extrabold tracking-[0.08em] text-[#2F8F3A]">
            ĐÃ XÁC MINH
          </span>
        </div>

        <h1 className="mt-4 text-center text-[44px] font-extrabold leading-tight text-[#0F172A]">
          Tài khoản của bạn đã được xác minh
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-center text-[15px] leading-7 text-[#667085]">
          Hồ sơ doanh nghiệp của bạn đã được phê duyệt. Bạn có thể bắt đầu sử dụng nền tảng để đăng
          sản phẩm và giao dịch.
        </p>

        {/* Actions */}
        <div className="mt-8 space-y-3">
          <Link
            to="/supplier/overview"
            className="block w-full rounded-lg bg-[#2F8F3A] py-3.5 text-center text-base font-semibold text-white transition hover:bg-[#277A31]"
          >
            Đi đến bảng điều khiển
          </Link>
          <Link
            to="/supplier/products"
            className="block w-full rounded-lg border border-[#2F8F3A] bg-white py-3.5 text-center text-base font-semibold text-[#2F8F3A] transition hover:bg-[#F0F9F1]"
          >
            Đăng sản phẩm đầu tiên
          </Link>
        </div>

        <div className="my-7 border-t border-[#E6ECF2]" />

        {/* Next steps */}
        <p className="text-xs font-extrabold tracking-[0.08em] text-[#98A2B3]">GỢI Ý TIẾP THEO</p>

        <div className="mt-4 space-y-4">
          {nextSteps.map((step) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="flex items-start gap-3">
                <div className="mt-1 text-[#2F8F3A]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#0F172A]">{step.title}</p>
                  <p className="text-sm text-[#667085]">{step.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="mt-7 text-center text-sm text-[#98A2B3]">
        Bạn cần hỗ trợ? <Link to="/auth/login" className="font-semibold text-[#2F8F3A]">Liên hệ bộ phận chăm sóc khách hàng</Link>
      </p>
    </CenteredStatusLayout>
  )
}
