import {
  Bell,
  Building2,
  Camera,
  Eye,
  Lock,
  Pencil,
  Save,
  Shield,
  User,
} from 'lucide-react'
import { useState } from 'react'
import { BuyerShell } from '../../components/buyer/BuyerShell'

type BuyerProfileTab = 'personal' | 'business' | 'security' | 'notifications'

export function BuyerProfilePage() {
  const [tab, setTab] = useState<BuyerProfileTab>('personal')

  return (
    <BuyerShell activeKey="overview" title="Thông tin cá nhân" subtitle="Quản lý thông tin tài khoản và cài đặt bảo mật">
      <div className="grid gap-4 lg:grid-cols-[170px_1fr]">
        <aside className="space-y-3">
          <div className="rounded-xl border border-emerald-100 bg-white p-2">
            <TabButton icon={User} label="Hồ sơ cá nhân" active={tab === 'personal'} onClick={() => setTab('personal')} />
            <TabButton icon={Building2} label="Thông tin doanh nghiệp" active={tab === 'business'} onClick={() => setTab('business')} />
            <TabButton icon={Shield} label="Bảo mật" active={tab === 'security'} onClick={() => setTab('security')} />
            <TabButton icon={Bell} label="Thông báo" active={tab === 'notifications'} onClick={() => setTab('notifications')} />
          </div>

          <div className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 p-3 text-white">
            <p className="text-sm font-bold">Premium Buyer</p>
            <p className="text-xs text-emerald-100">Gói dịch vụ</p>
            <div className="mt-3 space-y-1 text-xs">
              <p className="flex justify-between"><span>Hạn mức công nợ</span><span className="font-bold">5 tỷ VND</span></p>
              <p className="flex justify-between"><span>Đã sử dụng</span><span className="font-bold">1.5 tỷ VND</span></p>
            </div>
            <p className="mt-3 border-t border-emerald-400 pt-2 text-[11px]">Gia hạn đến: 15/03/2027</p>
          </div>
        </aside>

        <section className="space-y-4">
          {tab === 'personal' ? <BuyerPersonalPanel /> : null}
          {tab === 'business' ? <BuyerBusinessPanel /> : null}
          {tab === 'security' ? <BuyerSecurityPanel /> : null}
          {tab === 'notifications' ? <BuyerNotificationPanel /> : null}
        </section>
      </div>
    </BuyerShell>
  )
}

function BuyerPersonalPanel() {
  return (
    <>
      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        <h3 className="mb-2 text-lg font-bold">Ảnh đại diện</h3>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><User className="h-7 w-7" /></div>
            <button className="absolute -bottom-1 -right-1 rounded-full bg-emerald-500 p-1 text-white"><Camera className="h-3 w-3" /></button>
          </div>
          <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Tải ảnh lên</button>
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Xóa ảnh</button>
          <p className="text-xs text-slate-500">JPG, PNG hoặc GIF. Tối đa 2MB.</p>
        </div>
      </div>

      <Card title="Thông tin cá nhân" action="Chỉnh sửa">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Họ và tên" value="Trần Thị B" />
          <Field label="Email" value="buyer@agribridge.vn" />
          <Field label="Số điện thoại" value="0912 345 678" />
          <Field label="Chức vụ" value="Giám đốc mua hàng" />
        </div>
      </Card>

      <Card title="Thông tin tài khoản">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Mã tài khoản" value="BUY-2024-001" />
          <Field label="Loại tài khoản" value="Nhà buôn/Buyer" />
          <Field label="Ngày đăng ký" value="15/03/2024" />
          <Field label="Trạng thái" value="Đã xác minh" />
        </div>
      </Card>
    </>
  )
}

function BuyerBusinessPanel() {
  return (
    <>
      <Card title="Thông tin doanh nghiệp" action="Chỉnh sửa">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Tên doanh nghiệp" value="Công ty TNHH Thực Phẩm Sạch Việt" full />
          <Field label="Mã số thuế" value="0312345678" />
          <Field label="Loại hình kinh doanh" value="Nhà buôn/Phân phối" />
          <Field label="Năm thành lập" value="2018" />
          <Field label="Website" value="www.thucphamsach.vn" />
        </div>
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold">Mô tả doanh nghiệp</p>
          <textarea className="h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs" defaultValue="Công ty chuyên phân phối thực phẩm sạch cho các nhà hàng, siêu thị và đại lý trên toàn quốc." />
        </div>
      </Card>

      <Card title="Địa chỉ trụ sở">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Tỉnh/Thành phố" value="TP. Hồ Chí Minh" />
          <Field label="Quận/Huyện" value="Quận 1" />
          <Field label="Phường/Xã" value="Phường Bến Nghé" />
          <Field label="Địa chỉ chi tiết" value="123 Lê Lợi, Quận 1, TP.HCM" full />
        </div>
      </Card>
    </>
  )
}

function BuyerSecurityPanel() {
  return (
    <>
      <Card title="Đổi mật khẩu">
        <div className="max-w-md space-y-2">
          <PasswordField label="Mật khẩu hiện tại" />
          <PasswordField label="Mật khẩu mới" />
          <p className="text-[11px] text-slate-500">Ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số</p>
          <PasswordField label="Xác nhận mật khẩu mới" />
          <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><Lock className="h-3.5 w-3.5" /> Đổi mật khẩu</button>
        </div>
      </Card>

      <Card title="Xác thực hai yếu tố (2FA)">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Thêm lớp bảo vệ cho tài khoản của bạn</p>
          <button className="h-5 w-9 rounded-full bg-emerald-500 p-0.5"><span className="block h-4 w-4 rounded-full bg-white translate-x-4" /></button>
        </div>
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">2FA đã được bật — Mã xác thực sẽ được gửi qua SMS khi đăng nhập</div>
      </Card>

      <Card title="Lịch sử đăng nhập">
        <div className="space-y-2">
          {[
            ['Chrome - Windows', 'TP. Hồ Chí Minh, VN - Hôm nay, 09:30', 'Hiện tại'],
            ['Safari - iPhone', 'TP. Hồ Chí Minh, VN - Hôm qua, 14:20', 'Đăng xuất'],
          ].map(([device, meta, action]) => (
            <div key={device + meta} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <div>
                <p className="text-sm font-semibold">{device}</p>
                <p className="text-xs text-slate-500">{meta}</p>
              </div>
              <button className={`text-xs font-semibold ${action === 'Hiện tại' ? 'text-emerald-600' : 'text-red-500'}`}>{action}</button>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

function BuyerNotificationPanel() {
  return (
    <Card title="Cài đặt thông báo">
      <div className="space-y-3">
        {[
          ['Cập nhật đơn hàng', 'Thông báo khi đơn hàng có thay đổi trạng thái'],
          ['Phản hồi RFQ', 'Thông báo khi nhà cung cấp phản hồi báo giá'],
          ['Cảnh báo giá', 'Thông báo khi giá sản phẩm theo dõi thay đổi'],
          ['Tin tức hệ thống', 'Cập nhật tính năng mới và thông báo từ AgriBridge'],
        ].map(([title, desc], idx) => (
          <div key={title} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 pb-2 last:border-none">
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <label><input type="checkbox" defaultChecked /> Email</label>
              <label><input type="checkbox" defaultChecked={idx !== 1} /> SMS</label>
              <label><input type="checkbox" defaultChecked /> Push</label>
            </div>
          </div>
        ))}
      </div>
      <button className="mt-3 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><Save className="h-3.5 w-3.5" /> Lưu cài đặt</button>
    </Card>
  )
}

function TabButton({ icon: Icon, label, active, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'}`}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function Card({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold">{title}</h3>
        {action ? (
          <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"><Pencil className="h-3.5 w-3.5" /> {action}</button>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <label className={full ? 'md:col-span-2' : ''}>
      <p className="mb-1 text-xs font-semibold text-slate-700">{label}</p>
      <input className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-600" defaultValue={value} />
    </label>
  )
}

function PasswordField({ label }: { label: string }) {
  return (
    <label className="block">
      <p className="mb-1 text-xs font-semibold text-slate-700">{label}</p>
      <div className="relative">
        <input type="password" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 pr-8 text-xs" defaultValue="12345678" />
        <Eye className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  )
}
