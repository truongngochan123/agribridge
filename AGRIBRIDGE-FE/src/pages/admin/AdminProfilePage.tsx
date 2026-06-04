import {
  Building2,
  CalendarDays,
  Globe,
  IdCard,
  Info,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  Upload,
  Save,
  KeyRound,
} from 'lucide-react'
import { AdminShell } from '../../components/admin/AdminShell'
import { useCurrentUserProfile } from '../../hooks/useCurrentUserProfile'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useEffect, useState } from 'react'
import { apiClient } from '../../services/apiClient'
import { clearCurrentUserProfileCache } from '../../services/currentUserService'
import { uploadRegistrationFile } from '../../services/uploadService'

/* ── avatar gradient by initials hash ──────────────────────── */
function avatarGradient(initials: string): string {
  const gradients = [
    'from-emerald-400 to-teal-500',
    'from-violet-400 to-purple-500',
    'from-sky-400 to-blue-500',
    'from-amber-400 to-orange-500',
    'from-rose-400 to-pink-500',
    'from-indigo-400 to-violet-500',
  ]
  let hash = 0
  for (let i = 0; i < initials.length; i++) hash = initials.charCodeAt(i) + ((hash << 5) - hash)
  return gradients[Math.abs(hash) % gradients.length]
}

/* ── skeleton ───────────────────────────────────────────────── */
function Pulse({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-100 ${className ?? ''}`}>
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent)',
          animation: 'shimmer 1.6s infinite',
        }}
      />
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      {/* hero skeleton */}
      <div className="flex items-center gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Pulse className="h-20 w-20 shrink-0 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <Pulse className="h-6 w-52" />
          <Pulse className="h-4 w-36" />
          <div className="flex gap-2">
            <Pulse className="h-6 w-28 rounded-full" />
            <Pulse className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>
      {/* cards skeleton */}
      <div className="grid gap-5 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <Pulse className="h-5 w-40 mb-2" />
            {[...Array(4)].map((_, j) => <Pulse key={j} className="h-14" />)}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminProfilePage() {
  usePageTitle('Hồ sơ cá nhân')
  const { profile, loading, reloadProfile } = useCurrentUserProfile()
  const [refreshing, setRefreshing] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  async function handleRefresh() {
    setRefreshing(true)
    await reloadProfile()
    setRefreshing(false)
    hydrateEditableFields()
  }

  function hydrateEditableFields() {
    if (!profile) return
    setFullName(profile.fullName === 'N/A' ? '' : profile.fullName)
    setEmail(profile.email === 'N/A' ? '' : profile.email)
    setPhone(profile.phone === 'N/A' ? '' : profile.phone)
    setAvatarUrl(profile.userId ? localStorage.getItem(`agribridge.admin.avatar.${profile.userId}`) ?? '' : '')
  }

  async function handleSaveProfile() {
    if (!profile?.userId) return
    setSavingProfile(true)
    setMessage('')
    try {
      await apiClient.put(`/api/users/${profile.userId}/personal-profile`, {
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
      })
      clearCurrentUserProfileCache()
      await reloadProfile()
      setMessage('Đã cập nhật thông tin Admin.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không cập nhật được hồ sơ.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword() {
    if (!profile?.userId) return
    setSavingPassword(true)
    setMessage('')
    try {
      await apiClient.put(`/api/users/${profile.userId}/password`, { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setMessage('Đã đổi mật khẩu.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không đổi được mật khẩu.')
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleAvatarFile(file?: File | null) {
    if (!file || !profile?.userId) return
    setUploadingAvatar(true)
    setMessage('')
    try {
      const uploaded = await uploadRegistrationFile(file)
      localStorage.setItem(`agribridge.admin.avatar.${profile.userId}`, uploaded.url)
      setAvatarUrl(uploaded.url)
      setMessage('Đã upload avatar.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không upload được avatar.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  useEffect(() => {
    hydrateEditableFields()
  }, [profile?.userId])

  const isAdmin = (profile?.companyType ?? '').toLowerCase() === 'admin' ||
                  (profile?.companyType ?? '').toLowerCase() === 'system'

  return (
    <AdminShell
      activeKey="profile"
      title="Hồ sơ cá nhân"
      subtitle="Thông tin tài khoản quản trị và doanh nghiệp đang đăng nhập"
    >
      <style>{`
        @keyframes shimmer { 100% { transform: translateX(200%); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin360 { to { transform: rotate(360deg); } }
        .profile-enter { animation: fadeInUp 0.4s ease both; }
      `}</style>

      {loading ? (
        <ProfileSkeleton />
      ) : profile ? (
        <div className="space-y-5">

          {/* ── Hero card ──────────────────────────────────────────── */}
          <section
            className="profile-enter relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            style={{ animationDelay: '0ms' }}
          >
            {/* Background decoration */}
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-10"
              style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }}
            />
            <div
              className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full opacity-5"
              style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
            />

            <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
              {/* Avatar + info */}
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={profile.fullName} className="h-20 w-20 rounded-2xl object-cover shadow-xl" />
                  ) : (
                    <div
                      className={`flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarGradient(profile.initials)} text-2xl font-extrabold text-white shadow-xl`}
                    >
                      {profile.initials}
                    </div>
                  )}
                  {/* Online dot */}
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
                    <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" />
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">{profile.fullName}</h2>
                  <p className="mt-0.5 text-sm text-slate-400">{profile.roleLabel}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {profile.statusLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      <IdCard className="h-3.5 w-3.5 text-slate-400" />
                      {profile.accountCode}
                    </span>
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                        <Shield className="h-3.5 w-3.5" />
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Refresh button */}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow-md disabled:opacity-60"
              >
                <RefreshCw
                  className="h-4 w-4"
                  style={refreshing ? { animation: 'spin360 0.8s linear infinite' } : undefined}
                />
                {refreshing ? 'Đang làm mới...' : 'Làm mới dữ liệu'}
              </button>
            </div>

            {/* Bottom stat strip */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100">
              <StatStrip label="Loại tài khoản" value={profile.companyTypeLabel} />
              <StatStrip label="Loại kinh doanh" value={profile.businessTypeLabel} />
              <StatStrip label="Người đại diện"  value={profile.ownerName} />
            </div>
          </section>

          {/* ── Info cards ─────────────────────────────────────────── */}
          <section className="profile-enter rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" style={{ animationDelay: '60ms' }}>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_auto]">
              <div className="grid gap-3 sm:grid-cols-3">
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Họ và tên" />
                <input value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Email" />
                <input value={phone} onChange={(event) => setPhone(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Số điện thoại" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Mật khẩu hiện tại" />
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Mật khẩu mới" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleSaveProfile} disabled={savingProfile} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60">
                  <Save className="h-4 w-4" /> {savingProfile ? 'Đang lưu' : 'Lưu'}
                </button>
                <button type="button" onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-60">
                  <KeyRound className="h-4 w-4" /> Đổi mật khẩu
                </button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                  <Upload className="h-4 w-4" /> {uploadingAvatar ? 'Đang upload' : 'Avatar'}
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleAvatarFile(event.target.files?.[0])} />
                </label>
              </div>
            </div>
            {message ? <p className="mt-3 text-sm font-semibold text-slate-600">{message}</p> : null}
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            {/* Personal info */}
            <section
              className="profile-enter rounded-2xl border border-slate-200 bg-white shadow-sm"
              style={{ animationDelay: '80ms' }}
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
                  <User className="h-4 w-4 text-white" />
                </span>
                <h3 className="text-sm font-extrabold text-slate-900">Thông tin cá nhân</h3>
              </div>
              <div className="space-y-2.5 p-5">
                <InfoRow icon={<User className="h-4 w-4" />}         label="Họ và tên"     value={profile.fullName}  />
                <InfoRow icon={<Mail className="h-4 w-4" />}         label="Email"          value={profile.email}     />
                <InfoRow icon={<Phone className="h-4 w-4" />}        label="Số điện thoại"  value={profile.phone}     />
                <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Ngày tham gia"  value={profile.joinedAt}  />
              </div>
            </section>

            {/* Company info */}
            <section
              className="profile-enter rounded-2xl border border-slate-200 bg-white shadow-sm"
              style={{ animationDelay: '130ms' }}
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                  <Building2 className="h-4 w-4 text-white" />
                </span>
                <h3 className="text-sm font-extrabold text-slate-900">Thông tin doanh nghiệp</h3>
              </div>
              <div className="space-y-2.5 p-5">
                <InfoRow icon={<Building2 className="h-4 w-4" />} label="Tên doanh nghiệp"    value={profile.companyName} />
                <InfoRow icon={<IdCard className="h-4 w-4" />}    label="Mã số thuế"           value={profile.taxCode}     />
                <InfoRow icon={<MapPin className="h-4 w-4" />}    label="Địa chỉ"              value={profile.address}     />
                <InfoRow icon={<MapPin className="h-4 w-4" />}    label="Tỉnh / Thành"         value={profile.province}    />
              </div>
            </section>
          </div>

          {/* ── Extended info ──────────────────────────────────────── */}
          <section
            className="profile-enter rounded-2xl border border-slate-200 bg-white shadow-sm"
            style={{ animationDelay: '180ms' }}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-sm">
                <Info className="h-4 w-4 text-white" />
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">Thông tin bổ sung</h3>
            </div>
            <div className="grid gap-2.5 p-5 sm:grid-cols-2 xl:grid-cols-3">
              <InfoChip label="Mã đăng ký"        value={profile.registrationNumber} />
              <InfoChip label="Năm thành lập"      value={profile.establishedYear}    />
              <InfoChip label="Website"            value={profile.website}            isLink />
              <InfoChip label="Quận / Huyện"       value={profile.district}           />
              <InfoChip label="Phường / Xã"        value={profile.ward || 'N/A'}      />
              {profile.description && profile.description !== 'N/A' && (
                <div className="sm:col-span-2 xl:col-span-3">
                  <InfoChip label="Mô tả" value={profile.description} />
                </div>
              )}
            </div>
          </section>

          {/* ── Security note ──────────────────────────────────────── */}
          <section
            className="profile-enter flex items-start gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-5"
            style={{ animationDelay: '230ms' }}
          >
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <div>
              <p className="text-sm font-bold text-emerald-900">Tài khoản quản trị hệ thống</p>
              <p className="mt-0.5 text-xs text-emerald-700">
                Tài khoản này có quyền quản lý toàn hệ thống AgriBridge. Không chia sẻ thông tin đăng nhập với bất kỳ ai.
                Nếu phát hiện hoạt động bất thường, hãy đổi mật khẩu ngay lập tức.
              </p>
            </div>
          </section>
        </div>
      ) : (
        <section className="profile-enter rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-bold text-red-700">Không tải được thông tin cá nhân</p>
          <p className="mt-1 text-sm text-red-500">Vui lòng thử lại hoặc đăng nhập lại.</p>
          <button
            onClick={handleRefresh}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" /> Thử lại
          </button>
        </section>
      )}
    </AdminShell>
  )
}

/* ── Sub-components ──────────────────────────────────────────── */
function StatStrip({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-extrabold text-slate-800">{value}</p>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50/70 px-4 py-3 transition hover:bg-slate-100/80">
      <div className="mt-0.5 shrink-0 text-slate-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

function InfoChip({
  label,
  value,
  isLink = false,
}: {
  label: string
  value: string
  isLink?: boolean
}) {
  const isNA = value === 'N/A' || !value

  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 transition hover:bg-slate-100/80">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      {isLink && !isNA ? (
        <a
          href={value.startsWith('http') ? value : `https://${value}`}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:underline"
        >
          <Globe className="h-3.5 w-3.5" /> {value}
        </a>
      ) : (
        <p className={`mt-0.5 break-words text-sm font-semibold ${isNA ? 'text-slate-300 italic' : 'text-slate-800'}`}>
          {value}
        </p>
      )}
    </div>
  )
}
