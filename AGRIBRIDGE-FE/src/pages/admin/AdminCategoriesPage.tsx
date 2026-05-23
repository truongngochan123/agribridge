import { Edit3, Loader2, Plus, RefreshCw, Save, Search, Tags, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AdminShell } from '../../components/admin/AdminShell'
import { createAdminCategory, deleteAdminCategory, fetchAdminCategories, updateAdminCategory, type AdminCategoryItem } from '../../services/adminCategoryService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

type FormState = {
  id?: number
  name: string
  description: string
}

const emptyForm: FormState = { name: '', description: '' }

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

function errorMessage(error: unknown) {
  const message = readApiErrorMessage(error)
  if (message === 'CATEGORY_NAME_EXISTS') return 'Tên danh mục đã tồn tại.'
  if (message === 'CATEGORY_IN_USE') return 'Danh mục đang được sản phẩm sử dụng, không thể xóa.'
  if (message === 'CATEGORY_NAME_REQUIRED') return 'Vui lòng nhập tên danh mục.'
  return message || 'Không thể xử lý danh mục.'
}

export function AdminCategoriesPage() {
  const [items, setItems] = useState<AdminCategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [keyword, setKeyword] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const filteredItems = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    if (!text) return items
    return items.filter((item) => {
      return item.name.toLowerCase().includes(text)
        || String(item.description || '').toLowerCase().includes(text)
        || String(item.scopeLabel || '').toLowerCase().includes(text)
    })
  }, [items, keyword])

  const totalProducts = useMemo(() => items.reduce((sum, item) => sum + Number(item.productCount || 0), 0), [items])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setItems(await fetchAdminCategories())
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function startEdit(item: AdminCategoryItem) {
    setForm({ id: item.id, name: item.name, description: item.description || '' })
    setMessage('')
    setError('')
  }

  function resetForm() {
    setForm(emptyForm)
    setMessage('')
    setError('')
  }

  async function submitForm() {
    const payload = { name: form.name.trim(), description: form.description.trim() }
    if (!payload.name) {
      setError('Vui lòng nhập tên danh mục.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      if (form.id) {
        await updateAdminCategory(form.id, payload)
        setMessage('Đã cập nhật danh mục.')
      } else {
        await createAdminCategory(payload)
        setMessage('Đã thêm danh mục mới.')
      }
      setForm(emptyForm)
      await load()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function removeItem(item: AdminCategoryItem) {
    const ok = window.confirm(`Xóa danh mục "${item.name}"?`)
    if (!ok) return
    setDeletingId(item.id)
    setError('')
    setMessage('')
    try {
      await deleteAdminCategory(item.id)
      setMessage('Đã xóa danh mục.')
      await load()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AdminShell activeKey="categories" title="Quản lý danh mục" subtitle="Thêm, chỉnh sửa và xóa danh mục sản phẩm trên nền tảng">
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-3">
          <Stat label="Tổng danh mục" value={String(items.length)} hint="Đang có trên hệ thống" />
          <Stat label="Danh mục mặc định" value={String(items.filter((item) => !item.userId).length)} hint="Hiển thị cho nhà cung cấp" />
          <Stat label="Sản phẩm liên kết" value={String(totalProducts)} hint="Dùng để chặn xóa nhầm" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                {form.id ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">{form.id ? 'Sửa danh mục' : 'Thêm danh mục'}</h2>
                <p className="text-xs text-slate-500">Tên danh mục không được trùng.</p>
              </div>
            </div>

            <label className="block text-xs font-bold uppercase text-slate-500">Tên danh mục</label>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-400"
              placeholder="Ví dụ: Trái cây"
            />

            <label className="mt-4 block text-xs font-bold uppercase text-slate-500">Mô tả</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={4}
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              placeholder="Mô tả ngắn về nhóm sản phẩm"
            />

            {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p> : null}
            {message ? <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{message}</p> : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void submitForm()}
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {form.id ? 'Lưu thay đổi' : 'Thêm danh mục'}
              </button>
              {form.id ? (
                <button type="button" onClick={resetForm} className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Danh sách danh mục</h2>
                <p className="text-sm text-slate-500">Có thể sửa tên, mô tả hoặc xóa danh mục chưa có sản phẩm.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    className="w-64 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400"
                    placeholder="Tìm danh mục..."
                  />
                </div>
                <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <RefreshCw className="h-4 w-4" />
                  Làm mới
                </button>
              </div>
            </div>

            {loading ? <p className="p-5 text-sm font-semibold text-slate-500">Đang tải danh mục...</p> : null}
            {!loading && filteredItems.length === 0 ? <p className="p-5 text-sm font-semibold text-slate-500">Chưa có danh mục phù hợp.</p> : null}

            {filteredItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Danh mục</th>
                      <th>Phạm vi</th>
                      <th>Sản phẩm</th>
                      <th>Ngày tạo</th>
                      <th className="pr-5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const deleting = deletingId === item.id
                      return (
                        <tr key={item.id} className="border-t border-slate-100 align-top">
                          <td className="px-5 py-4">
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                <Tags className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="font-extrabold text-slate-900">{item.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{item.description || 'Chưa có mô tả'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{item.scopeLabel}</span>
                          </td>
                          <td className="py-4 font-bold text-slate-900">{item.productCount}</td>
                          <td className="py-4 text-slate-500">{formatDate(item.createdAt)}</td>
                          <td className="py-4 pr-5">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => startEdit(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                                <Edit3 className="h-3.5 w-3.5" />
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => void removeItem(item)}
                                disabled={deleting || item.productCount > 0}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                title={item.productCount > 0 ? 'Danh mục đang có sản phẩm' : 'Xóa danh mục'}
                              >
                                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AdminShell>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p>
    </div>
  )
}
