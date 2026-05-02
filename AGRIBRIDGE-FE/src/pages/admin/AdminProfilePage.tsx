import { Building2, CalendarDays, IdCard, Mail, MapPin, Phone, ShieldCheck, User } from 'lucide-react'
import { AdminShell } from '../../components/admin/AdminShell'
import { useCurrentUserProfile } from '../../hooks/useCurrentUserProfile'
import { usePageTitle } from '../../hooks/usePageTitle'

export function AdminProfilePage() {
  usePageTitle('Thông tin cá nhân')
  const { profile, loading, reloadProfile } = useCurrentUserProfile()

  return (
    <AdminShell
      activeKey="profile"
      title="Thông tin cá nhân"
      subtitle="Xem thông tin tài khoản quản trị và doanh nghiệp đang đăng nhập"
    >
      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Đang tải thông tin cá nhân...
        </section>
      ) : profile ? (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-extrabold text-emerald-700">
                  {profile.initials}
                </span>
                <div>
                  <p className="text-2xl font-extrabold text-slate-900">{profile.fullName}</p>
                  <p className="mt-1 text-sm text-slate-500">{profile.roleLabel}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {profile.statusLabel}
                    </span>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {profile.accountCode}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => reloadProfile()}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Làm mới dữ liệu
              </button>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <InfoCard title="Thông tin cá nhân">
              <InfoRow icon={<User className="h-4 w-4" />} label="Họ tên" value={profile.fullName} />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Số điện thoại" value={profile.phone} />
              <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Ngày tham gia" value={profile.joinedAt} />
            </InfoCard>

            <InfoCard title="Thông tin doanh nghiệp">
              <InfoRow icon={<Building2 className="h-4 w-4" />} label="Tên doanh nghiệp" value={profile.companyName} />
              <InfoRow icon={<IdCard className="h-4 w-4" />} label="Mã số thuế" value={profile.taxCode} />
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Địa chỉ" value={profile.address} />
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Tỉnh / Thành" value={profile.province} />
            </InfoCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <MetricCard label="Loại tài khoản" value={profile.companyTypeLabel} />
            <MetricCard label="Loại kinh doanh" value={profile.businessTypeLabel} />
            <MetricCard label="Người đại diện" value={profile.ownerName} />
          </section>
        </div>
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Không tải được thông tin cá nhân. Vui lòng thử lại.
        </section>
      )}
    </AdminShell>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <div className="mt-0.5 shrink-0 text-slate-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-extrabold text-slate-900">{value}</p>
    </section>
  )
}