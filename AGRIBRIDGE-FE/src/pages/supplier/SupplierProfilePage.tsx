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
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useCurrentUserProfile } from '../../hooks/useCurrentUserProfile'

type SupplierProfileTab = 'personal' | 'business' | 'security' | 'notifications'

export function SupplierProfilePage() {
  const [tab, setTab] = useState<SupplierProfileTab>('personal')
  const { profile, loading } = useCurrentUserProfile()

  return (
    <SupplierShell activeKey="overview" title="Thông tin cá nhân" subtitle="Quản lý hồ sơ, thông tin doanh nghiệp, hình ảnh và bảo mật">
      <div className="grid gap-4 lg:grid-cols-[170px_1fr]">
        <aside className="space-y-3">
          <div className="rounded-xl border border-emerald-100 bg-white p-2">
            <TabButton icon={User} label="Hồ sơ cá nhân" active={tab === 'personal'} onClick={() => setTab('personal')} />
            <TabButton icon={Building2} label="Doanh nghiệp & Trang trại" active={tab === 'business'} onClick={() => setTab('business')} />
            <TabButton icon={Shield} label="Bảo mật" active={tab === 'security'} onClick={() => setTab('security')} />
            <TabButton icon={Bell} label="Thông báo" active={tab === 'notifications'} onClick={() => setTab('notifications')} />
          </div>

          <div className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 p-3 text-white">
            <p className="text-sm font-bold">Premium Supplier</p>
            <p className="text-xs text-emerald-100">Gói dịch vụ</p>
            <div className="mt-3 space-y-1 text-xs">
              <p className="flex justify-between"><span>Rating</span><span className="font-bold">4.9/5.0</span></p>
              <p className="flex justify-between"><span>Đơn hàng</span><span className="font-bold">1,234</span></p>
              <p className="flex justify-between"><span>Phản hồi RFQ</span><span className="font-bold">98%</span></p>
              <p className="flex justify-between"><span>Chứng nhận</span><span className="font-bold">5 chứng chỉ</span></p>
            </div>
            <p className="mt-3 border-t border-emerald-400 pt-2 text-[11px]">Gia hạn đến: 10/01/2027</p>
          </div>
        </aside>

        <section className="space-y-4">
          {tab === 'personal' ? <SupplierPersonalPanel profile={profile} loading={loading} /> : null}
          {tab === 'business' ? <SupplierBusinessPanel profile={profile} loading={loading} /> : null}
          {tab === 'security' ? <SupplierSecurityPanel /> : null}
          {tab === 'notifications' ? <SupplierNotificationPanel /> : null}
        </section>
      </div>
    </SupplierShell>
  )
}

function SupplierPersonalPanel({
  profile,
  loading,
}: {
  profile: ReturnType<typeof useCurrentUserProfile>['profile']
  loading: boolean
}) {
  const fullName = profile?.fullName ?? 'N/A'
  const email = profile?.email ?? 'N/A'
  const phone = profile?.phone ?? 'N/A'
  const accountCode = profile?.accountCode ?? 'N/A'
  const companyTypeLabel = profile?.companyTypeLabel ?? 'N/A'
  const joinedAt = profile?.joinedAt ?? 'N/A'
  const statusLabel = profile?.statusLabel ?? 'N/A'
  const initials = profile?.initials ?? 'U'

  return (
    <>
      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        <h3 className="mb-2 text-lg font-bold">Ảnh đại diện</h3>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 text-lg font-extrabold text-emerald-700">{initials}</div>
            <button className="absolute -bottom-1 -right-1 rounded-full bg-emerald-500 p-1 text-white"><Camera className="h-3 w-3" /></button>
          </div>
          <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Tải ảnh lên</button>
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Xóa ảnh</button>
          <p className="text-xs text-slate-500">JPG, PNG hoặc GIF. Tối đa 2MB.</p>
        </div>
        {loading ? <p className="mt-2 text-xs font-semibold text-emerald-700">Đang tải thông tin người dùng...</p> : null}
      </div>

      <Card title="Thông tin cá nhân" action="Chỉnh sửa">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Họ và tên" value={fullName} />
          <Field label="Email" value={email} />
          <Field label="Số điện thoại" value={phone} />
          <Field label="Chức vụ" value={profile?.roleLabel ?? 'Nhà cung cấp'} />
        </div>
      </Card>

      <Card title="Thông tin tài khoản">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Mã tài khoản" value={accountCode} />
          <Field label="Loại tài khoản" value={companyTypeLabel} />
          <Field label="Ngày đăng ký" value={joinedAt} />
          <Field label="Trạng thái" value={statusLabel} />
        </div>
      </Card>
    </>
  )
}

function SupplierBusinessPanel({
  profile,
  loading,
}: {
  profile: ReturnType<typeof useCurrentUserProfile>['profile']
  loading: boolean
}) {
  const companyName = profile?.companyName ?? 'N/A'
  const taxCode = profile?.taxCode ?? 'N/A'
  const ownerName = profile?.ownerName ?? 'N/A'
  const address = profile?.address ?? 'N/A'

  return (
    <>
      <Card title="Thông tin pháp lý doanh nghiệp" action="Chỉnh sửa">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Tên pháp lý của doanh nghiệp" value={companyName} full />
          <Field label="Loại hình doanh nghiệp" value={profile?.companyTypeLabel ?? 'N/A'} />
          <Field label="Mã số thuế" value={taxCode} />
          <Field label="Số giấy đăng ký kinh doanh" value={taxCode} />
          <Field label="Năm thành lập" value="N/A" />
          <Field label="Website" value="N/A" full />
          <Field label="Thành phố / Tỉnh" value="N/A" />
          <Field label="Quận / Huyện" value="N/A" />
          <Field label="Địa chỉ chi tiết" value={address} full />
        </div>

        {loading ? <p className="mt-2 text-xs font-semibold text-emerald-700">Đang tải thông tin doanh nghiệp...</p> : null}

        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold">Logo công ty</p>
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500">Nhấp để tải lên hoặc kéo thả</div>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold">Mô tả doanh nghiệp</p>
          <textarea
            className="h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
            value={ownerName}
            readOnly
          />
        </div>
      </Card>

      <Card title="Hình ảnh cửa hàng / trang trại" action="Thêm ảnh">
        <div className="space-y-2">
          <img src="/images/background3.jpg" alt="farm" className="h-36 w-full rounded-lg object-cover" />
          <div className="grid grid-cols-6 gap-2">
            <img src="/images/seafood-market.jpg" alt="img1" className="h-16 w-full rounded-lg object-cover" />
            <img src="/images/packing-warehouse.jpg" alt="img2" className="h-16 w-full rounded-lg object-cover" />
            <img src="/images/shrimp.jpg" alt="img3" className="h-16 w-full rounded-lg object-cover" />
            <img src="/images/background4.jpg" alt="img4" className="h-16 w-full rounded-lg object-cover" />
            <img src="/images/background2.jpg" alt="img5" className="h-16 w-full rounded-lg object-cover" />
            <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500">Thêm ảnh</div>
          </div>
        </div>
      </Card>

      <Card title="Giấy chứng nhận & Chứng chỉ" action="Thêm chứng nhận">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {['ASC', 'GlobalGAP', 'HACCP', 'ISO 22000', 'VietGAP'].map((item) => (
            <div key={item} className="rounded-lg border border-emerald-100 p-2.5">
              <p className="text-sm font-bold">{item}</p>
              <p className="text-xs text-slate-500">Còn hiệu lực</p>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-emerald-700">
                <button>Xem</button>
                <button>Tải xuống</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Vị trí trang trại trên bản đồ">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="h-40 w-full bg-cover bg-center" style={{ backgroundImage: "url('/images/background.png')" }}>
            <button className="m-2 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-blue-600">Mở trong Maps</button>
          </div>
        </div>
      </Card>
    </>
  )
}

function SupplierSecurityPanel() {
  return (
    <>
      <Card title="Đổi mật khẩu">
        <div className="max-w-md space-y-2">
          <PasswordField label="Mật khẩu hiện tại" />
          <PasswordField label="Mật khẩu mới" />
          <PasswordField label="Xác nhận mật khẩu mới" />
          <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><Lock className="h-3.5 w-3.5" /> Đổi mật khẩu</button>
        </div>
      </Card>

      <Card title="Xác thực hai yếu tố (2FA)">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Thêm lớp bảo vệ cho tài khoản của bạn</p>
          <button className="h-5 w-9 rounded-full bg-emerald-500 p-0.5"><span className="block h-4 w-4 rounded-full bg-white translate-x-4" /></button>
        </div>
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">2FA đã được bật — Mã xác thực gửi qua SMS khi đăng nhập</div>
      </Card>

      <Card title="Lịch sử đăng nhập">
        <div className="space-y-2">
          {[
            ['Chrome - Windows', 'Cà Mau, VN - Hôm nay, 08:30', 'Hiện tại'],
            ['Safari - iPhone', 'Cà Mau, VN - Hôm qua, 19:45', 'Đăng xuất'],
            ['Chrome - Windows', 'TP. Hồ Chí Minh, VN - 03/04/2026, 14:20', 'Đăng xuất'],
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

function SupplierNotificationPanel() {
  return (
    <Card title="Cài đặt thông báo">
      <div className="space-y-3">
        {[
          ['Đơn hàng mới', 'Thông báo khi có đơn hàng mới từ buyer'],
          ['RFQ mới', 'Thông báo khi nhận được yêu cầu báo giá'],
          ['Thanh toán', 'Thông báo khi nhận được thanh toán'],
          ['Tin tức hệ thống', 'Cập nhật tính năng mới từ AgriBridge'],
        ].map(([title, desc], idx) => (
          <div key={title} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 pb-2 last:border-none">
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <label><input type="checkbox" defaultChecked /> EMAIL</label>
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
      <input className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-600" value={value} readOnly />
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
