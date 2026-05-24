import {
  CheckCircle2,
  Edit3,
  FolderOpen,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingBag,
  Tags,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AdminShell } from '../../components/admin/AdminShell'
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
  type AdminCategoryItem,
} from '../../services/adminCategoryService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

/* ─── helpers ───────────────────────────────────────────────── */
type FormState = { id?: number; name: string; description: string }
const emptyForm: FormState = { name: '', description: '' }

function formatDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('vi-VN')
}

function resolveError(error: unknown) {
  const msg = readApiErrorMessage(error)
  if (msg === 'CATEGORY_NAME_EXISTS')    return 'Tên danh mục đã tồn tại.'
  if (msg === 'CATEGORY_IN_USE')         return 'Danh mục đang có sản phẩm, không thể xóa.'
  if (msg === 'CATEGORY_NAME_REQUIRED')  return 'Vui lòng nhập tên danh mục.'
  return msg || 'Không thể xử lý danh mục.'
}

/* color palette for category cards (by id mod) */
const cardPalette = [
  { bg: 'from-emerald-50 to-teal-50', icon: 'from-emerald-500 to-teal-600', ring: 'ring-emerald-200' },
  { bg: 'from-violet-50 to-purple-50', icon: 'from-violet-500 to-purple-600', ring: 'ring-violet-200' },
  { bg: 'from-sky-50 to-blue-50',     icon: 'from-sky-500 to-blue-600',     ring: 'ring-sky-200'     },
  { bg: 'from-amber-50 to-orange-50', icon: 'from-amber-500 to-orange-500', ring: 'ring-amber-200'   },
  { bg: 'from-rose-50 to-pink-50',    icon: 'from-rose-500 to-pink-600',    ring: 'ring-rose-200'    },
  { bg: 'from-indigo-50 to-blue-50',  icon: 'from-indigo-500 to-violet-600', ring: 'ring-indigo-200' },
]

function paletteFor(id: number) { return cardPalette[id % cardPalette.length] }

/* ─── skeleton ───────────────────────────────────────────────── */
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

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Pulse className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Pulse className="h-4 w-28" />
          <Pulse className="h-3 w-16" />
        </div>
      </div>
      <Pulse className="h-3 w-full" />
      <Pulse className="h-3 w-4/5" />
      <div className="flex justify-between">
        <Pulse className="h-5 w-16 rounded-full" />
        <div className="flex gap-2">
          <Pulse className="h-7 w-14 rounded-lg" />
          <Pulse className="h-7 w-14 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/* ─── toast ─────────────────────────────────────────────────── */
function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div
      className={`fixed bottom-6 right-6 z-[300] flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-2xl ${
        type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
      style={{ animation: 'slideInUp 0.35s cubic-bezier(.34,1.56,.64,1) both' }}
    >
      {type === 'success'
        ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        : <X className="h-5 w-5 text-red-500 shrink-0" />}
      <p className="text-sm font-bold">{message}</p>
      <button onClick={onDone} className="ml-2 text-current opacity-50 hover:opacity-80">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/* ─── delete confirm modal ──────────────────────────────────── */
function DeleteModal({
  item,
  loading,
  onConfirm,
  onCancel,
}: {
  item: AdminCategoryItem
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
        style={{ animation: 'modalIn 0.25s cubic-bezier(.34,1.56,.64,1) both' }}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-red-400 to-rose-500" />
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100">
              <Trash2 className="h-5 w-5 text-red-600" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Xóa danh mục?</h3>
              <p className="mt-1 text-sm text-slate-500">
                Xóa <span className="font-bold text-slate-800">"{item.name}"</span>? Hành động này không thể hoàn tác.
              </p>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {loading ? 'Đang xóa...' : 'Xóa ngay'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── main page ─────────────────────────────────────────────── */
export function AdminCategoriesPage() {
  const [items, setItems]           = useState<AdminCategoryItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminCategoryItem | null>(null)
  const [keyword, setKeyword]       = useState('')
  const [form, setForm]             = useState<FormState>(emptyForm)
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const filteredItems = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    if (!text) return items
    return items.filter((item) =>
      item.name.toLowerCase().includes(text) ||
      String(item.description || '').toLowerCase().includes(text) ||
      String(item.scopeLabel || '').toLowerCase().includes(text)
    )
  }, [items, keyword])

  const totalProducts = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.productCount || 0), 0),
    [items]
  )

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      setItems(await fetchAdminCategories())
    } catch (e) {
      notify(resolveError(e), 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load() }, [])

  function notify(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
  }

  function startEdit(item: AdminCategoryItem) {
    setForm({ id: item.id, name: item.name, description: item.description || '' })
  }

  function resetForm() { setForm(emptyForm) }

  async function submitForm() {
    const payload = { name: form.name.trim(), description: form.description.trim() }
    if (!payload.name) { notify('Vui lòng nhập tên danh mục.', 'error'); return }

    setSaving(true)
    try {
      if (form.id) {
        await updateAdminCategory(form.id, payload)
        notify('Đã cập nhật danh mục.', 'success')
      } else {
        await createAdminCategory(payload)
        notify('Đã thêm danh mục mới.', 'success')
      }
      setForm(emptyForm)
      await load(true)
    } catch (e) {
      notify(resolveError(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete(item: AdminCategoryItem) {
    setDeletingId(item.id)
    try {
      await deleteAdminCategory(item.id)
      notify(`Đã xóa "${item.name}".`, 'success')
      setDeleteTarget(null)
      await load(true)
    } catch (e) {
      notify(resolveError(e), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const statCards = [
    {
      label: 'Tổng danh mục',
      value: items.length,
      hint: 'Đang có trên hệ thống',
      gradient: 'from-emerald-500 to-teal-600',
      icon: <Layers className="h-5 w-5 text-white" />,
    },
    {
      label: 'Danh mục mặc định',
      value: items.filter((i) => !i.userId).length,
      hint: 'Hiển thị cho nhà cung cấp',
      gradient: 'from-violet-500 to-purple-600',
      icon: <FolderOpen className="h-5 w-5 text-white" />,
    },
    {
      label: 'Tùy chỉnh',
      value: items.filter((i) => !!i.userId).length,
      hint: 'Do người dùng tạo',
      gradient: 'from-sky-500 to-blue-600',
      icon: <Tags className="h-5 w-5 text-white" />,
    },
    {
      label: 'Sản phẩm liên kết',
      value: totalProducts,
      hint: 'Dùng để chặn xóa nhầm',
      gradient: 'from-amber-500 to-orange-500',
      icon: <ShoppingBag className="h-5 w-5 text-white" />,
    },
  ]

  return (
    <AdminShell
      activeKey="categories"
      title="Quản lý danh mục"
      subtitle="Thêm, chỉnh sửa và xóa danh mục sản phẩm trên nền tảng"
    >
      <style>{`
        @keyframes shimmer { 100% { transform: translateX(200%); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.93) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="space-y-5">
        {/* ── Stat cards ──────────────────────────────────────────── */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card, i) => (
            <div
              key={card.label}
              className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:shadow-md"
              style={{ animation: `fadeInUp 0.35s ease ${i * 55}ms both` }}
            >
              <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow`}>
                {card.icon}
              </span>
              <div>
                <p className="text-xl font-extrabold text-slate-900">{card.value}</p>
                <p className="text-xs font-medium text-slate-400">{card.label}</p>
                <p className="text-[10px] text-slate-400">{card.hint}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ── Main section ────────────────────────────────────────── */}
        <section className="grid gap-5 xl:grid-cols-[340px_1fr]" style={{ animation: 'fadeInUp 0.4s ease 220ms both' }}>

          {/* Form panel */}
          <div className="h-fit rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Form header */}
            <div className={`flex items-center gap-3 border-b border-slate-100 px-5 py-4 bg-gradient-to-r ${
              form.id ? 'from-violet-50 to-purple-50' : 'from-emerald-50 to-teal-50'
            }`}>
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl shadow-sm bg-gradient-to-br ${
                form.id ? 'from-violet-500 to-purple-600' : 'from-emerald-500 to-teal-600'
              }`}>
                {form.id ? <Edit3 className="h-4 w-4 text-white" /> : <Plus className="h-4 w-4 text-white" />}
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  {form.id ? 'Sửa danh mục' : 'Thêm danh mục mới'}
                </h2>
                <p className="text-[11px] text-slate-400">Tên danh mục không được trùng</p>
              </div>
              {form.id && (
                <button
                  onClick={resetForm}
                  className="ml-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Tên danh mục *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') void submitForm() }}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
                  placeholder="Ví dụ: Trái cây, Thủy sản..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Mô tả
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
                  placeholder="Mô tả ngắn về nhóm sản phẩm này..."
                />
              </div>

              <button
                type="button"
                onClick={() => void submitForm()}
                disabled={saving}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60 ${
                  form.id
                    ? 'bg-gradient-to-r from-violet-500 to-purple-600'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600'
                }`}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Đang lưu...' : form.id ? 'Lưu thay đổi' : 'Thêm danh mục'}
              </button>
            </div>
          </div>

          {/* List panel */}
          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* List header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Danh sách danh mục</h2>
                <p className="text-xs text-slate-400">Chỉnh sửa hoặc xóa danh mục chưa có sản phẩm</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="h-9 w-56 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Tìm danh mục..."
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void load(true)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:shadow-md disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>
            </div>

            {/* Cards grid */}
            <div className="p-5">
              {/* Loading */}
              {loading && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[0,1,2,3,4,5].map((i) => <CardSkeleton key={i} />)}
                </div>
              )}

              {/* Empty */}
              {!loading && filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200">
                    <Package className="h-7 w-7 text-slate-400" />
                  </span>
                  <p className="mt-4 font-bold text-slate-600">
                    {keyword ? 'Không tìm thấy danh mục nào' : 'Chưa có danh mục nào'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {keyword ? 'Thử từ khóa khác' : 'Thêm danh mục mới bằng form bên trái'}
                  </p>
                </div>
              )}

              {/* Category cards */}
              {!loading && filteredItems.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredItems.map((item, idx) => {
                    const pal     = paletteFor(item.id)
                    const isEdit  = form.id === item.id
                    const deleting= deletingId === item.id
                    const canDelete = item.productCount === 0

                    return (
                      <div
                        key={item.id}
                        className={`group relative rounded-2xl border-2 bg-gradient-to-br ${pal.bg} p-4 transition-all duration-200 hover:shadow-lg ${
                          isEdit ? `${pal.ring} ring-2 shadow-md` : 'border-slate-200 hover:border-slate-300'
                        }`}
                        style={{ animation: `fadeInUp 0.3s ease ${idx * 40}ms both` }}
                      >
                        {/* Header */}
                        <div className="flex items-start gap-3">
                          <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${pal.icon} shadow-md`}>
                            <Tags className="h-5 w-5 text-white" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-extrabold text-slate-900" title={item.name}>{item.name}</p>
                            <span className="mt-0.5 inline-flex rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm">
                              {item.scopeLabel}
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="mt-2.5 line-clamp-2 text-xs text-slate-500 leading-relaxed">
                          {item.description || <span className="italic text-slate-300">Chưa có mô tả</span>}
                        </p>

                        {/* Footer */}
                        <div className="mt-3.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs font-bold text-slate-600">{item.productCount} sản phẩm</span>
                            <span className="text-[10px] text-slate-400">· {formatDate(item.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                              <Edit3 className="h-3 w-3" /> Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => canDelete && setDeleteTarget(item)}
                              disabled={!canDelete || deleting}
                              title={!canDelete ? 'Danh mục đang có sản phẩm' : 'Xóa danh mục'}
                              className="inline-flex h-7 items-center gap-1 rounded-lg border border-red-200 bg-white px-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              Xóa
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {!loading && items.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
                Hiển thị <span className="font-bold text-slate-700">{filteredItems.length}</span> /{' '}
                <span className="font-bold text-slate-700">{items.length}</span> danh mục
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Delete confirm modal ─────────────────────────────────── */}
      {deleteTarget && (
        <DeleteModal
          item={deleteTarget}
          loading={deletingId === deleteTarget.id}
          onConfirm={() => void confirmDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────── */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </AdminShell>
  )
}
