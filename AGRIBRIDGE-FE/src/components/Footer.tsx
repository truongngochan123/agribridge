import { Building2, Globe, Mail, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export function Footer() {
  return (
    <footer className="bg-slate-950 py-14 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
          <div>
            <h3 className="text-2xl font-bold text-white">AgriBridge</h3>
            <p className="mt-4 max-w-xs">Kết nối Nguồn hàng - Phát triển bền vững</p>
            <div className="mt-4 flex max-w-sm overflow-hidden rounded-full border border-slate-700">
              <input
                type="email"
                className="w-full bg-transparent px-4 py-2 text-sm outline-none"
                placeholder="Email của bạn"
              />
              <button className="bg-emerald-500 px-4 text-sm font-semibold text-white">Gửi</button>
            </div>
          </div>

          <FooterColumn title="Sản phẩm" items={['Đặt mua sỉ', 'Đăng bán theo lô', 'RFQ', 'Theo dõi logistics']} />
          <FooterColumn title="Giải pháp" items={['Nhà buôn', 'Nhà cung cấp', 'Chuỗi cửa hàng']} />
          <FooterColumn title="Tài nguyên" items={['Blog', 'Hướng dẫn', 'API']} />
          <FooterColumn title="Công ty" items={['Về chúng tôi', 'Liên hệ', 'Tuyển dụng']} />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-6 text-sm">
          <p>© 2026 AgriBridge. All rights reserved.</p>
          <div className="flex gap-3">
            <SocialButton icon={<Building2 size={15} />} />
            <SocialButton icon={<Globe size={15} />} />
            <SocialButton icon={<MessageCircle size={15} />} />
            <SocialButton icon={<Mail size={15} />} />
          </div>
        </div>
      </div>
    </footer>
  )
}

type FooterColumnProps = {
  title: string
  items: string[]
}

function FooterColumn({ title, items }: FooterColumnProps) {
  return (
    <div>
      <h4 className="font-semibold text-white">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item}>
            <a href="#" className="transition hover:text-emerald-300">
              {item}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

type SocialButtonProps = {
  icon: ReactNode
}

function SocialButton({ icon }: SocialButtonProps) {
  return <button className="rounded-full border border-slate-700 p-2 transition hover:border-emerald-400">{icon}</button>
}
