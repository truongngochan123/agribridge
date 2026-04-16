import {
  Building2,
  Calendar,
  Lock,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  Unlock,
  User,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AdminShell } from '../../components/admin/AdminShell'
import { fetchAdminUsers, lockAdminUser, unlockAdminUser } from '../../services/adminService'
import type { AdminUserRow } from '../../types/admin'

type UserFilterKey = 'ALL' | 'ACTIVE' | 'BLOCKED' | 'SUPPLIER' | 'BUYER'

const filterOptions: Array<{ key: UserFilterKey; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'ACTIVE', label: 'Hoạt động' },
  { key: 'BLOCKED', label: 'Bị khóa' },
  { key: 'SUPPLIER', label: 'Nhà cung cấp' },
  { key: 'BUYER', label: 'Nhà buôn' },
]

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function getAvatarColor(name: string | null | undefined): string {
  const colors = [
    'from-emerald-400 to-teal-500',
    'from-violet-400 to-purple-500',
    'from-sky-400 to-blue-500',
    'from-amber-400 to-orange-500',
    'from-rose-400 to-pink-500',
    'from-indigo-400 to-blue-500',
  ]
  if (!name) return colors[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function AdminUsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filter, setFilter] = useState<UserFilterKey>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null)
  const [actionUserId, setActionUserId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let active = true
    async function loadUsers() {
      try {
        setLoading(true)
        setError('')
        const payload = await fetchAdminUsers(debouncedQuery)
        if (!active) return
        setRows(payload)
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách người dùng.')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadUsers()
    return () => { active = false }
  }, [debouncedQuery])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filter === 'ALL') return true
      if (filter === 'ACTIVE') return row.userStatus === 'ACTIVE'
      if (filter === 'BLOCKED') return row.userStatus === 'BLOCKED' || row.userStatus === 'LOCKED'
      return row.companyType === filter
    })
  }, [filter, rows])

  async function handleStatusAction(user: AdminUserRow) {
    try {
      setActionUserId(user.userId)
      setError('')
      const updated =
        user.userStatus === 'ACTIVE' ? await lockAdminUser(user.userId) : await unlockAdminUser(user.userId)
      setRows((current) => current.map((item) => (item.userId === updated.userId ? updated : item)))
      setSelectedUser(updated)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Không cập nhật được trạng thái tài khoản.')
    } finally {
      setActionUserId(null)
    }
  }

  function openDetail(row: AdminUserRow) {
    setSelectedUser(row)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  return (
    <AdminShell
      activeKey="users"
      title="Quản lý người dùng"
      subtitle="Quản lý các tài khoản đã được duyệt hồ sơ và đang hoạt động trong hệ thống"
    >
      {/* ── MAIN CARD ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* Header */}
        <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Người dùng đã phê duyệt</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Chỉ hiển thị doanh nghiệp có hồ sơ đã được duyệt. Bạn có thể khóa hoặc mở khóa tài khoản tại đây.
              </p>
            </div>

            {/* Search */}
            <label className="relative block w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm kiếm doanh nghiệp, email..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          {/* Filter chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {filterOptions.map((opt) => {
              const active = filter === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setFilter(opt.key)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                  {opt.key !== 'ALL' && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {opt.key === 'ACTIVE' ? rows.filter(r => r.userStatus === 'ACTIVE').length
                        : opt.key === 'BLOCKED' ? rows.filter(r => r.userStatus !== 'ACTIVE').length
                        : rows.filter(r => r.companyType === opt.key).length}
                    </span>
                  )}
                  {opt.key === 'ALL' && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {rows.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </header>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-3.5 whitespace-nowrap">Doanh nghiệp</th>
                <th className="px-6 py-3.5 whitespace-nowrap">Liên hệ</th>
                <th className="px-6 py-3.5 whitespace-nowrap">Loại</th>
                <th className="px-6 py-3.5 whitespace-nowrap">Trạng thái</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-center">Đơn hàng</th>
                <th className="px-6 py-3.5 whitespace-nowrap">Ngày tham gia</th>
                <th className="px-6 py-3.5 whitespace-nowrap text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                      <span className="text-sm text-slate-400">Đang tải danh sách...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                      {error}
                    </div>
                  </td>
                </tr>
              )}

              {!loading && !error && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    <p className="font-medium">Không tìm thấy người dùng nào</p>
                    <p className="mt-1 text-xs">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                  </td>
                </tr>
              )}

              {!loading && !error && filteredRows.map((row) => {
                const isBlocked = row.userStatus !== 'ACTIVE'
                const isActioning = actionUserId === row.userId
                return (
                  <tr key={row.userId} className="group transition-colors hover:bg-emerald-50/40">
                    {/* Company */}
                    <td className="px-6 py-4 max-w-[220px]">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarColor(row.companyName)} text-xs font-bold text-white shadow-sm`}>
                          {getInitials(row.companyName)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate" title={row.companyName}>{row.companyName}</p>
                          <p className="text-xs text-slate-400 truncate">{row.ownerName || 'Chưa cập nhật'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-6 py-4 max-w-[200px]">
                      <p className="text-slate-700 truncate" title={row.email || ''}>{row.email || '—'}</p>
                      <p className="text-xs text-slate-400 whitespace-nowrap">{row.phone}</p>
                    </td>

                    {/* Type */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                        row.companyType === 'SUPPLIER'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-violet-100 text-violet-700'
                      }`}>
                        {row.companyTypeLabel}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isBlocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isBlocked ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        {row.userStatusLabel}
                      </span>
                    </td>

                    {/* Orders */}
                    <td className="px-6 py-4 text-center font-semibold text-slate-700">{row.orderCount}</td>

                    {/* Joined */}
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs">{row.joinedAt || 'N/A'}</td>

                    {/* Actions — 3-dot menu */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="relative flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === row.userId ? null : row.userId) }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {openMenuId === row.userId && (
                          <>
                            {/* backdrop to close on outside click */}
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 top-9 z-20 min-w-[160px] rounded-xl border border-slate-100 bg-white py-1 shadow-xl">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); openDetail(row) }}
                                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <User className="h-4 w-4 text-slate-400" />
                                Xem chi tiết
                              </button>
                              <div className="mx-3 my-1 border-t border-slate-100" />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); handleStatusAction(row) }}
                                disabled={isActioning}
                                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${
                                  isBlocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-red-600 hover:bg-red-50'
                                }`}
                              >
                                {isActioning
                                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                  : isBlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                {isActioning ? 'Đang xử lý...' : isBlocked ? 'Mở khóa' : 'Khóa tài khoản'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── DETAIL MODAL ───────────────────────────────────────── */}
      {modalOpen && selectedUser && (
        <UserDetailModal
          user={selectedUser}
          actionUserId={actionUserId}
          onClose={closeModal}
          onStatusAction={async (user) => {
            await handleStatusAction(user)
          }}
        />
      )}
    </AdminShell>
  )
}

/* ──────────────────────────────────────────────────────────────
   USER DETAIL MODAL
──────────────────────────────────────────────────────────────── */
interface UserDetailModalProps {
  user: AdminUserRow
  actionUserId: number | null
  onClose: () => void
  onStatusAction: (user: AdminUserRow) => Promise<void>
}

function UserDetailModal({ user, actionUserId, onClose, onStatusAction }: UserDetailModalProps) {
  const isBlocked = user.userStatus !== 'ACTIVE'
  const isActioning = actionUserId === user.userId

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={handleBackdrop}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl"
        style={{ animation: 'modalIn 0.25s cubic-bezier(.34,1.56,.64,1)' }}
      >
        {/* Gradient top strip */}
        <div className={`h-2 w-full rounded-t-3xl bg-gradient-to-r ${
          isBlocked ? 'from-red-400 to-rose-500' : 'from-emerald-400 to-teal-500'
        }`} />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-8 pb-8 pt-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${getAvatarColor(user.companyName)} text-xl font-extrabold text-white shadow-lg`}>
              {getInitials(user.companyName)}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-extrabold text-slate-900">{user.companyName}</h3>
              <p className="text-sm text-slate-500">
                {user.ownerName ? `Đại diện: ${user.ownerName}` : 'Chưa cập nhật người đại diện'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  isBlocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isBlocked ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  {user.userStatusLabel}
                </span>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  user.companyType === 'SUPPLIER' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
                }`}>
                  {user.companyTypeLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <hr className="my-5 border-slate-100" />

          {/* Stats row */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatPill
              icon={<ShoppingCart className="h-4 w-4 text-violet-500" />}
              label="Đơn hàng"
              value={String(user.orderCount)}
              bg="bg-violet-50"
            />
            <StatPill
              icon={<Star className="h-4 w-4 text-amber-500" />}
              label="Đánh giá"
              value={user.rating}
              bg="bg-amber-50"
            />
            <StatPill
              icon={<Calendar className="h-4 w-4 text-slate-400" />}
              label="Ngày tham gia"
              value={user.joinedAt || 'N/A'}
              bg="bg-slate-50"
            />
          </div>

          {/* Detail grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={<Mail className="h-4 w-4 text-slate-400" />} label="Email" value={user.email || 'Chưa cập nhật'} />
            <InfoRow icon={<Phone className="h-4 w-4 text-slate-400" />} label="Số điện thoại" value={user.phone} />
            <InfoRow icon={<Building2 className="h-4 w-4 text-slate-400" />} label="Mã số thuế" value={user.taxCode || 'Chưa cập nhật'} />
            <InfoRow icon={<MapPin className="h-4 w-4 text-slate-400" />} label="Tỉnh / Thành" value={user.province || 'Chưa cập nhật'} />
            {user.address && (
              <div className="sm:col-span-2">
                <InfoRow icon={<MapPin className="h-4 w-4 text-slate-400" />} label="Địa chỉ" value={user.address} />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Đóng
            </button>
            <button
              onClick={() => onStatusAction(user)}
              disabled={isActioning}
              className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isBlocked
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-200'
                  : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-200'
              }`}
            >
              {isActioning ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : isBlocked ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {isActioning ? 'Đang cập nhật...' : isBlocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

/* ── Sub-components ── */
function StatPill({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl ${bg} px-4 py-3`}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        <p className="truncate text-sm font-bold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  )
}
