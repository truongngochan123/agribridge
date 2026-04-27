import { CheckCircle2, PackageSearch, X } from 'lucide-react'
import type { BuyerBatchPreview } from '../../services/buyerSourcingService'

type BuyerSelectBatchModalProps = {
  productName: string
  unit?: string | null
  batches: BuyerBatchPreview[]
  onClose: () => void
  onSelect: (batch: BuyerBatchPreview) => void
}

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatQuantity(value?: number | null, unit?: string | null) {
  if (value == null || value <= 0) return '--'
  return `${formatNumber(value)}${unit ? ` ${unit}` : ''}`
}

function compactCurrency(value: number): string {
  if (value >= 1000) {
    const compact = value / 1000
    if (Number.isInteger(compact)) return `${compact}k`
    return `${compact.toFixed(1).replace(/\.0$/, '')}k`
  }
  return value.toLocaleString('vi-VN')
}

function isUrl(value?: string | null) {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^https?:\/\//i.test(trimmed)) return true
  return /^\/public\/batch\/\d+/i.test(trimmed)
}

function getBatchCode(batch: BuyerBatchPreview, index = 0) {
  const candidate = [batch.batchCode, batch.batchNo, batch.lotCode, batch.code]
    .map((value) => value?.trim())
    .find((value) => value && !isUrl(value))

  if (candidate) return candidate
  return `BATCH-${String(batch.id ?? index + 1).padStart(6, '0')}`
}

function getBatchQuantity(batch: BuyerBatchPreview) {
  return batch.availableQuantity ?? batch.quantity
}

function getBatchMoq(batch: BuyerBatchPreview) {
  return batch.moq ?? batch.minMoq
}

function deriveBatchStatus(batch: BuyerBatchPreview): 'available' | 'out-of-stock' {
  const normalized = (batch.status || '').toUpperCase()
  if (normalized.includes('OUT') || normalized.includes('SOLD') || normalized.includes('HET')) return 'out-of-stock'
  const quantity = getBatchQuantity(batch)
  if (quantity != null && quantity <= 0) return 'out-of-stock'
  return 'available'
}

export function BuyerSelectBatchModal({ productName, unit, batches, onClose, onSelect }: BuyerSelectBatchModalProps) {
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center overflow-hidden bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h3 className="text-xl font-extrabold text-emerald-950">Chọn lô trước khi đặt hàng</h3>
            <p className="text-sm text-emerald-700/70">{productName} · {batches.length} lô khả dụng</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-50" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {batches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              <PackageSearch className="mx-auto mb-2 h-6 w-6 text-slate-400" />
              Chưa có lô hàng để chọn.
            </div>
          ) : (
            <div className="grid gap-2.5">
              {batches.map((batch, index) => {
                const status = deriveBatchStatus(batch)
                const batchCode = getBatchCode(batch, index)
                const price = batch.price != null ? `${compactCurrency(batch.price)} /${unit || ''}` : '--'
                const stock = formatQuantity(getBatchQuantity(batch), unit)
                const moq = formatQuantity(getBatchMoq(batch), unit)

                return (
                  <button
                    key={`${batch.id ?? index}-${batchCode}`}
                    onClick={() => onSelect(batch)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{batchCode}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Grade {batch.grade || '--'} · Size {batch.size || '--'}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                          status === 'available'
                            ? 'border border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border border-rose-300 bg-rose-50 text-rose-700'
                        }`}
                      >
                        {status === 'available' ? 'Còn hàng' : 'Hết hàng'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <Info label="Giá" value={price} />
                      <Info label="MOQ" value={moq} />
                      <Info label="Tồn kho" value={stock} />
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Chọn lô này
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate font-bold text-slate-700">{value}</p>
    </div>
  )
}
