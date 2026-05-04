import { Eye, Flag, HandHeart, ShieldCheck, ShoppingCart, Store, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { aboutLeadership } from '../../data/site'
import { Header } from '../../components/Header'
import { usePageTitle } from '../../hooks/usePageTitle'

const highlights = [
  { icon: Store, value: '2,500+', label: 'Nhà cung cấp' },
  { icon: ShoppingCart, value: '5,800+', label: 'Nhà buôn' },
  { icon: Truck, value: '15,000+', label: 'Giao dịch/tháng' },
  { icon: ShieldCheck, value: '450 tỷ', label: 'GMV' },
]

const coreValues = [
  { title: 'Minh bạch', description: 'Mọi giao dịch đều được ghi nhận rõ ràng, công khai, đảm bảo quyền lợi cho cả hai bên.', icon: ShieldCheck },
  { title: 'Tin cậy', description: 'Xác minh nghiêm ngặt nhà cung cấp, đảm bảo chất lượng sản phẩm và uy tín giao dịch.', icon: HandHeart },
  { title: 'Hiệu quả', description: 'Tối ưu hóa quy trình từ tìm kiếm, đặt hàng đến thanh toán và vận chuyển.', icon: Flag },
  { title: 'Hỗ trợ tận tâm', description: 'Đội ngũ chăm sóc khách hàng chuyên nghiệp, sẵn sàng hỗ trợ 24/7.', icon: Eye },
]

export function AboutPage() {
  usePageTitle('Về AgriBridge')
  return (
    <div className="min-h-screen bg-[#F3F5F7] text-[#0F172A]">
      <Header variant="site" />

      <section className="relative h-[300px] overflow-hidden">
        <img src="/images/background4.jpg" alt="Về AgriBridge" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-emerald-900/35" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
          <h1 className="text-6xl font-extrabold">Về AgriBridge</h1>
          <p className="mt-2 text-xl">Kết nối giao thương nông hải sản minh bạch và hiệu quả</p>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="grid gap-8 lg:grid-cols-2">
          <article>
            <h2 className="text-5xl font-extrabold">Câu chuyện của chúng tôi</h2>
            <div className="mt-4 space-y-3 text-[15px] leading-7 text-[#475467]">
              <p>AgriBridge ra đời từ mong muốn giải quyết những khó khăn trong giao thương nông hải sản tại Việt Nam.</p>
              <p>Chúng tôi nhìn thấy rằng nhà cung cấp và nhà buôn thường gặp khó khăn trong việc tìm kiếm đối tác uy tín, quản lý đơn hàng, công nợ và theo dõi vận chuyển.</p>
              <p>Với nền tảng công nghệ hiện đại, AgriBridge mang đến giải pháp toàn diện giúp kết nối trực tiếp nhà cung cấp và nhà buôn.</p>
              <p>Sau 3 năm hoạt động, chúng tôi đã kết nối hơn 2,500 nhà cung cấp với 5,800 nhà buôn trên toàn quốc.</p>
            </div>
          </article>

          <div className="overflow-hidden rounded-2xl border border-[#D9E1EA] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <img src="/images/seafood-market.jpg" alt="Đội ngũ AgriBridge" className="h-full w-full object-cover" />
          </div>
        </section>
      </main>

      <section className="bg-[#10B981] py-10 text-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 md:grid-cols-4">
          {highlights.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.label} className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-5xl font-extrabold">{item.value}</p>
                <p className="mt-1 text-base">{item.label}</p>
              </article>
            )
          })}
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl bg-[#E7F8F0] p-6">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#10B981] text-white"><Eye className="h-5 w-5" /></div>
            <h3 className="text-3xl font-extrabold">Tầm nhìn</h3>
            <p className="mt-3 text-[15px] leading-7 text-[#475467]">Trở thành nền tảng kết nối giao thương nông hải sản hàng đầu Việt Nam, góp phần hiện đại hóa ngành nông nghiệp và thủy sản.</p>
          </article>
          <article className="rounded-2xl bg-[#EEF2FF] p-6">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#3B82F6] text-white"><Flag className="h-5 w-5" /></div>
            <h3 className="text-3xl font-extrabold">Sứ mệnh</h3>
            <p className="mt-3 text-[15px] leading-7 text-[#475467]">Xây dựng hệ sinh thái giao thương minh bạch, hiệu quả và bền vững, ứng dụng công nghệ để tối ưu hóa chuỗi cung ứng.</p>
          </article>
        </section>

        <section className="mt-10">
          <h3 className="text-center text-5xl font-extrabold">Giá trị cốt lõi</h3>
          <p className="mt-2 text-center text-[#667085]">Những giá trị định hướng mọi hoạt động của chúng tôi</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {coreValues.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className="rounded-2xl border border-[#D9E1EA] bg-white p-5 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Icon className="h-5 w-5" /></div>
                  <h4 className="text-2xl font-bold">{item.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-[#667085]">{item.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="mt-10">
          <h3 className="text-center text-5xl font-extrabold">Đội ngũ lãnh đạo</h3>
          <p className="mt-2 text-center text-[#667085]">Những người dẫn dắt AgriBridge phát triển</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {aboutLeadership.map((member) => (
              <article key={member.id} className="text-center">
                <img src={member.image} alt={member.name} className="h-60 w-full rounded-2xl object-cover" />
                <p className="mt-3 text-xl font-bold">{member.name}</p>
                <p className="text-sm text-[#667085]">{member.role}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <section className="bg-[#10B981] py-12 text-center text-white">
        <h3 className="text-5xl font-extrabold">Sẵn sàng tham gia AgriBridge?</h3>
        <p className="mt-2 text-lg">Hãy để chúng tôi giúp bạn kết nối với hàng nghìn đối tác uy tín trên toàn quốc</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link to="/onboarding/supplier/business-info" className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#10B981]">Đăng ký ngay</Link>
          <Link to="/support" className="rounded-lg bg-emerald-700 px-6 py-3 text-sm font-semibold text-white">Liên hệ tư vấn</Link>
        </div>
      </section>
    </div>
  )
}
