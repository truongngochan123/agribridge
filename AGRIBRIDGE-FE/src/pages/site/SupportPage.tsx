import { Building2, Mail, Phone } from 'lucide-react'
import { supportFaqs } from '../../data/site'
import { PublicPageLayout } from '../../components/site/PublicPageLayout'
import { usePageTitle } from '../../hooks/usePageTitle'

export function SupportPage() {
  usePageTitle('Trung tâm Hỗ trợ')
  return (
    <PublicPageLayout>
      <section className="rounded-2xl bg-[#EAF8F3] px-6 py-10 text-center">
        <h1 className="text-5xl font-extrabold text-[#0F172A]">Trung tâm Hỗ trợ</h1>
        <p className="mt-2 text-[#667085]">Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7</p>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-[#D9E1EA] bg-white p-5 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Phone className="h-5 w-5" /></div>
          <p className="mt-3 text-xl font-bold text-[#0F172A]">Hotline</p>
          <p className="text-sm text-[#667085]">Hỗ trợ 24/7</p>
          <p className="mt-1 text-xl font-extrabold text-[#10B981]">1900-xxxx</p>
        </article>
        <article className="rounded-2xl border border-[#D9E1EA] bg-white p-5 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Mail className="h-5 w-5" /></div>
          <p className="mt-3 text-xl font-bold text-[#0F172A]">Email</p>
          <p className="text-sm text-[#667085]">Phản hồi trong 2 giờ</p>
          <p className="mt-1 text-sm font-semibold text-[#2563EB]">support@agribridge.vn</p>
        </article>
        <article className="rounded-2xl border border-[#D9E1EA] bg-white p-5 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-orange-700"><Building2 className="h-5 w-5" /></div>
          <p className="mt-3 text-xl font-bold text-[#0F172A]">Văn phòng</p>
          <p className="text-sm text-[#667085]">Thứ 2 - Thứ 6: 8:00 - 17:00</p>
          <p className="mt-1 text-xs text-[#667085]">Tầng 10, Tòa nhà ABC<br />123 Nguyễn Huệ, Q1, TP.HCM</p>
        </article>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-[#D9E1EA] bg-white p-5">
          <h2 className="text-2xl font-bold text-[#0F172A]">Gửi tin nhắn cho chúng tôi</h2>
          <div className="mt-4 space-y-3">
            <input className="h-11 w-full rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-3 text-sm" placeholder="Nhập họ và tên của bạn" />
            <input className="h-11 w-full rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-3 text-sm" placeholder="email@example.com" />
            <select className="h-11 w-full rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-3 text-sm"><option>Chọn chủ đề</option></select>
            <textarea className="h-28 w-full rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-3 py-2 text-sm" placeholder="Mô tả chi tiết vấn đề của bạn..." />
            <button className="w-full rounded-lg bg-[#10B981] py-3 text-sm font-semibold text-white hover:bg-[#0E9F6E]">Gửi tin nhắn</button>
          </div>
        </article>

        <article className="rounded-2xl border border-[#D9E1EA] bg-white p-5">
          <h2 className="text-2xl font-bold text-[#0F172A]">Câu hỏi thường gặp</h2>
          <div className="mt-4 space-y-2">
            {supportFaqs.map((faq) => (
              <button
                key={faq.id}
                className="flex w-full items-center justify-between rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-3 py-2.5 text-left text-sm text-[#344054]"
              >
                {faq.question}
                <span>▾</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-5">
        <h3 className="mb-3 text-2xl font-bold text-[#0F172A]">Vị trí văn phòng</h3>
        <div className="overflow-hidden rounded-2xl border border-[#D9E1EA] bg-white">
          <iframe
            title="AgriBridge Office Map"
            className="h-[320px] w-full"
            loading="lazy"
            src="https://maps.google.com/maps?q=10.7769,106.7009&z=14&output=embed"
          />
        </div>
      </section>
    </PublicPageLayout>
  )
}
