import { PackageCheck, Truck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { resolveUploadedFileUrl } from '../../services/uploadService'
import type { BuyerQuickOrderFormData, BuyerQuickOrderTarget } from './buyerQuickOrderTypes'

type BuyerQuickOrderModalProps = {
  target: BuyerQuickOrderTarget
  defaultProvince?: string
  submitting?: boolean
  onClose: () => void
  onSubmit: (form: BuyerQuickOrderFormData) => void
}

const placeholderImage = '/images/seafood-market.jpg'

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatQuantity(value?: number | null, unit?: string | null) {
  if (value == null || value <= 0) return '--'
  return `${formatNumber(value)}${unit ? ` ${unit}` : ''}`
}

function dateInputAfterDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function BuyerQuickOrderModal({
  target,
  defaultProvince,
  submitting = false,
  onClose,
  onSubmit,
}: BuyerQuickOrderModalProps) {
  const [form, setForm] = useState<BuyerQuickOrderFormData>({
    quantity: '',
    unit: target.unit || 'kg',
    deliveryDate: '',
    province: defaultProvince || '',
    note: target.batchCode ? `Ưu tiên lô ${target.batchCode}` : '',
  })

  useEffect(() => {
    setForm({
      quantity: '',
      unit: target.unit || 'kg',
      deliveryDate: '',
      province: defaultProvince || '',
      note: target.batchCode ? `Ưu tiên lô ${target.batchCode}` : '',
    })
  }, [defaultProvince, target])

  const quantityNumber = Number(form.quantity)
  const showMoqWarning = target.minMoq != null && quantityNumber > 0 && quantityNumber < target.minMoq
  const showStockWarning =
    target.availableQuantity != null &&
    target.availableQuantity > 0 &&
    quantityNumber > 0 &&
    quantityNumber > target.availableQuantity

  const heroImage = useMemo(() => {
    if (!target.imageUrl) return placeholderImage
    return resolveUploadedFileUrl(target.imageUrl) || target.imageUrl
  }, [target.imageUrl])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h3 className="text-xl font-extrabold text-emerald-950">Đặt hàng ngay</h3>
            <p className="text-sm text-emerald-700/70">
              {target.productName}
              {target.batchCode ? ` · ${target.batchCode}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-50" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-start gap-3">
              <img src={heroImage} alt={target.productName} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-base font-black text-slate-900">{target.productName}</h4>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">{target.supplierName || 'Nhà cung cấp'}</p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                  <MiniInfo label="Mã lô" value={target.batchCode || '--'} />
                  <MiniInfo label="MOQ" value={formatQuantity(target.minMoq, target.unit)} />
                  <MiniInfo label="Tồn kho" value={formatQuantity(target.availableQuantity, target.unit)} />
                  <MiniInfo label="Danh mục" value={target.categoryName || '--'} />
                  <MiniInfo label="Xuất xứ" value={target.originRegion || '--'} />
                  <MiniInfo label="Đơn vị" value={target.unit || '--'} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Số lượng *</label>
              <input
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                type="number"
                min="0"
                className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"
                placeholder={target.minMoq != null ? `Tối thiểu ${formatQuantity(target.minMoq, target.unit)}` : 'Nhập số lượng'}
              />
              {showMoqWarning ? (
                <p className="mt-1 text-xs font-semibold text-amber-600">
                  Số lượng đang thấp hơn MOQ {formatQuantity(target.minMoq, target.unit)}.
                </p>
              ) : null}
              {showStockWarning ? (
                <p className="mt-1 text-xs font-semibold text-rose-600">Số lượng đang vượt tồn kho khả dụng.</p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Đơn vị *</label>
              <input
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
                className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"
                placeholder="kg, thùng, tấn..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Ngày giao dự kiến *</label>
              <input
                value={form.deliveryDate}
                onChange={(event) => setForm({ ...form, deliveryDate: event.target.value })}
                type="date"
                className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[3, 7, 14].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setForm({ ...form, deliveryDate: dateInputAfterDays(days) })}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    {days} ngày
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Tỉnh/khu vực giao hàng *</label>
              <input
                value={form.province}
                onChange={(event) => setForm({ ...form, province: event.target.value })}
                className="h-11 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 text-sm"
                placeholder="Nhập tỉnh/khu vực nhận hàng"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-emerald-950">Ghi chú đơn hàng</label>
              <textarea
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                className="h-24 w-full rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 py-2 text-sm"
                placeholder="Ví dụ: giao buổi sáng, đóng thùng xốp, cần chứng từ QC..."
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 text-sm text-emerald-900">
            <p className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
              <Truck className="h-4 w-4" />
              Tóm tắt yêu cầu giao hàng
            </p>
            <p className="mt-1.5">
              Cần mua <span className="font-bold">{form.quantity || '--'} {form.unit || target.unit || ''}</span> {target.productName}
              {target.batchCode ? <> (lô <span className="font-bold">{target.batchCode}</span>)</> : null}, giao tại{' '}
              <span className="font-bold">{form.province || '--'}</span> vào ngày <span className="font-bold">{form.deliveryDate || '--'}</span>.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">
            Hủy
          </button>
          <button
            disabled={submitting}
            onClick={() => onSubmit(form)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:bg-emerald-300"
          >
            <PackageCheck className="h-4 w-4" />
            {submitting ? 'Đang xử lý...' : 'Xác nhận đặt hàng'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-xs font-bold text-slate-800">{value}</p>
    </div>
  )
}
