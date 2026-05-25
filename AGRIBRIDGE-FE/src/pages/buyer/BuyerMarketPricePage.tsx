import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { BuyerPanel, SearchInput } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { useToast } from '../../hooks/useToast'
import {
  fetchBuyerMarketPriceFilters,
  fetchBuyerMarketPriceHistory,
  fetchBuyerMarketPrices,
  fetchBuyerMarketPriceSuppliers,
  type MarketPriceFilters,
  type MarketPriceHistory,
  type MarketPriceRow,
  type MarketPriceSupplier,
} from '../../services/buyerMarketPriceApi'
import { fetchVietnamProvinces } from '../../services/vietnamAddressService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'
import { MarketPriceSkeletonLoader } from '../../components/buyer/BuyerSkeletons'

const emptyFilters: MarketPriceFilters = {
  categories: [],
  productTypes: [],
  regions: [],
  grades: [],
  sizes: [],
  sourceTypes: [],
  dateRanges: [],
}

function formatMoney(value?: number | null, unit?: string | null) {
  return `${Number(value ?? 0).toLocaleString('vi-VN')}đ${unit ? `/${unit}` : ''}`
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

function sourceLabel(sourceType?: string) {
  if (sourceType === 'INTERNAL_SUPPLIER_LISTING') return 'Giá chào bán'
  if (sourceType === 'INTERNAL_TRANSACTION') return 'Giao dịch hoàn tất'
  return sourceType || 'N/A'
}
import { usePageTitle } from '../../hooks/usePageTitle'

export function BuyerMarketPricePage() {
  usePageTitle('Giá thị trường')
  const { showToast } = useToast()
  const [rows, setRows] = useState<MarketPriceRow[]>([])
  const [filters, setFilters] = useState(emptyFilters)
  const [query, setQuery] = useState({
    keyword: '',
    categoryId: '',
    productType: '',
    region: '',
    grade: '',
    size: '',
    sourceType: 'all',
    range: '30d',
  })
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [provinceRegions, setProvinceRegions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<{ row: MarketPriceRow; data: MarketPriceHistory } | null>(null)
  const [suppliers, setSuppliers] = useState<{ row: MarketPriceRow; data: MarketPriceSupplier[] } | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(query.keyword), 300)
    return () => window.clearTimeout(timer)
  }, [query.keyword])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const filterData = filters.dateRanges.length ? filters : await fetchBuyerMarketPriceFilters()
      const priceData = await fetchBuyerMarketPrices({ ...query, keyword: debouncedKeyword })
      setFilters(filterData)
      setRows(priceData)
    } catch (requestError) {
      setRows([])
      setError(readApiErrorMessage(requestError) || 'Không thể tải giá tham khảo nội bộ.')
    } finally {
      setLoading(false)
    }
  }, [debouncedKeyword, filters, query])

  useEffect(() => {
    if (provinceRegions.length) return

    let ignore = false
    fetchVietnamProvinces()
      .then((provinces) => {
        if (!ignore) setProvinceRegions(provinces.map((province) => province.name))
      })
      .catch(() => {
        if (!ignore) setProvinceRegions([])
      })

    return () => {
      ignore = true
    }
  }, [provinceRegions.length])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const dateRanges = useMemo(() => filters.dateRanges.length ? filters.dateRanges : [
    { value: '7d', label: '7 ngày qua' },
    { value: '30d', label: '30 ngày qua' },
    { value: '90d', label: '90 ngày qua' },
    { value: 'all', label: 'Tất cả' },
  ], [filters.dateRanges])

  const regionOptions = useMemo(
    () => Array.from(new Set([...filters.regions, ...provinceRegions])).sort((a, b) => a.localeCompare(b, 'vi')),
    [filters.regions, provinceRegions],
  )

  const openHistory = async (row: MarketPriceRow) => {
    try {
      setHistory({ row, data: await fetchBuyerMarketPriceHistory(row, query.range) })
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải lịch sử giá.', 'error')
    }
  }

  const openSuppliers = async (row: MarketPriceRow) => {
    try {
      setSuppliers({ row, data: await fetchBuyerMarketPriceSuppliers(row) })
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || 'Không thể tải danh sách nhà cung cấp.', 'error')
    }
  }

  return (
    <>
      <BuyerShell
        activeKey="market"
        title="Giá thị trường"
        subtitle="Giá tham khảo nội bộ theo loại sản phẩm"
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query.keyword}
              onChange={(v) => setQuery((c) => ({ ...c, keyword: v }))}
              placeholder="Tìm sản phẩm / loại..."
              className="min-w-[200px] max-w-xs"
            />
            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm"
              value={query.categoryId}
              onChange={(e) => setQuery((c) => ({ ...c, categoryId: e.target.value }))}
            >
              <option value="">Tất cả nhóm hàng</option>
              {filters.categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm"
              value={query.region}
              onChange={(e) => setQuery((c) => ({ ...c, region: e.target.value }))}
            >
              <option value="">Tất cả khu vực</option>
              {regionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm"
              value={query.range}
              onChange={(e) => setQuery((c) => ({ ...c, range: e.target.value }))}
            >
              {dateRanges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm"
              value={query.sourceType}
              onChange={(e) => setQuery((c) => ({ ...c, sourceType: e.target.value }))}
            >
              {filters.sourceTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        }
      >
        <BuyerPanel title="Giá tham khảo theo loại sản phẩm">
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Nguồn dữ liệu: Giá được tổng hợp từ giá chào bán của nhiều nhà cung cấp và giao dịch hoàn tất trên AgriBridge. Giá áp dụng theo loại sản phẩm + khu vực + grade + size.
          </div>
          {loading ? (
            <MarketPriceSkeletonLoader />
          ) : null}
          {!loading && error && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
              Chưa có dữ liệu giá nội bộ phù hợp.
            </p>
          )}
          {!loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <article
                  key={row.id}
                  className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md"
                >
                {/* Top accent */}
                <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />

                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{row.categoryName || 'Chung'}</p>
                      <h4 className="mt-0.5 text-sm font-extrabold text-slate-900 leading-tight">{row.productTypeName}</h4>
                      <p className="mt-0.5 text-xs text-slate-500">{row.gradeSize || 'N/A'}</p>
                    </div>
                    <ChangeBadge row={row} />
                  </div>

                  {/* Price highlight */}
                  <div className="mt-3 flex items-end gap-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/60 px-3 py-2.5">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Giá hiện tại</p>
                      <p className="text-lg font-extrabold text-slate-900">{formatMoney(row.currentPrice, row.unit)}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[10px] text-slate-400">Trung bình</p>
                      <p className="text-sm font-bold text-slate-700">{formatMoney(row.avgPrice, row.unit)}</p>
                    </div>
                  </div>

                  {/* Min-Max bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-400 mb-1">
                      <span>Min: {formatMoney(row.minPrice, row.unit)}</span>
                      <span>Max: {formatMoney(row.maxPrice, row.unit)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                        style={{
                          width: row.maxPrice && row.minPrice && row.maxPrice !== row.minPrice
                            ? `${Math.round(((row.currentPrice ?? row.avgPrice ?? 0) - row.minPrice) / (row.maxPrice - row.minPrice) * 100)}%`
                            : '50%',
                        }}
                      />
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px]">
                    <span className="flex items-center gap-1 text-slate-500">
                      <span className="font-semibold text-slate-700">{row.region || 'Chung'}</span> khu vực
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <span className="font-semibold text-slate-700">{row.supplierCount || 0}</span> NCC ·
                      <span className="font-semibold text-slate-700">{row.sampleCount || 0}</span> mẫu
                    </span>
                    <span className="text-slate-400">{sourceLabel(row.sourceType)}</span>
                    <span className="text-slate-400">{formatDate(row.updatedAt || row.priceDate)}</span>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex gap-1.5">
                    <button
                      className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-2 text-xs font-bold text-white hover:opacity-90 active:scale-95 transition-all"
                      onClick={() => void openHistory(row)}
                    >
                      Lịch sử giá
                    </button>
                    {row.sourceType === 'INTERNAL_SUPPLIER_LISTING' && (
                      <button
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => void openSuppliers(row)}
                      >
                        NCC
                      </button>
                    )}
                  </div>
                </div>
                </article>
              ))}
            </div>
          ) : null}
        </BuyerPanel>
      </BuyerShell>
      {history ? <HistoryModal payload={history} onClose={() => setHistory(null)} /> : null}
      {suppliers ? <SupplierModal payload={suppliers} onClose={() => setSuppliers(null)} /> : null}
    </>
  )
}

function ChangeBadge({ row }: { row: MarketPriceRow }) {
  const isUp = row.changeType === 'UP'
  const isDown = row.changeType === 'DOWN'
  const cls = isUp ? 'bg-emerald-100 text-emerald-700' : isDown ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
  const dot = isUp ? 'bg-emerald-500' : isDown ? 'bg-red-400' : 'bg-slate-400'
  const sign = isUp ? '▲ +' : isDown ? '▼ ' : ''
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {sign}{Number(row.changePercent || 0).toFixed(2)}%
    </span>
  )
}

function HistoryModal({ payload, onClose }: { payload: { row: MarketPriceRow; data: MarketPriceHistory }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={onClose}>
      <div className="mx-auto mt-10 max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <ModalHeader title={`Lịch sử giá - ${payload.row.productTypeName}`} onClose={onClose} />
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Info label="Thấp nhất" value={formatMoney(payload.data.summary.minPrice, payload.row.unit)} />
          <Info label="Trung bình" value={formatMoney(payload.data.summary.avgPrice, payload.row.unit)} />
          <Info label="Cao nhất" value={formatMoney(payload.data.summary.maxPrice, payload.row.unit)} />
          <Info label="Số NCC / mẫu" value={`${payload.data.summary.supplierCount || 0} / ${payload.data.summary.sampleCount || 0}`} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Ngày</th><th className="px-3 py-2">Avg</th><th className="px-3 py-2">Min</th><th className="px-3 py-2">Max</th><th className="px-3 py-2">Số mẫu</th></tr></thead>
            <tbody>
              {payload.data.points.map((point) => (
                <tr key={point.date} className="border-t border-slate-100">
                  <td className="px-3 py-2">{formatDate(point.date)}</td>
                  <td className="px-3 py-2">{formatMoney(point.avgPrice, payload.row.unit)}</td>
                  <td className="px-3 py-2">{formatMoney(point.minPrice, payload.row.unit)}</td>
                  <td className="px-3 py-2">{formatMoney(point.maxPrice, payload.row.unit)}</td>
                  <td className="px-3 py-2">{point.sampleCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SupplierModal({ payload, onClose }: { payload: { row: MarketPriceRow; data: MarketPriceSupplier[] }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={onClose}>
      <div className="mx-auto mt-10 max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <ModalHeader title={`Nhà cung cấp - ${payload.row.productTypeName}`} onClose={onClose} />
        <div className="mt-4 space-y-2">
          {payload.data.length ? payload.data.map((item) => (
            <div key={`${item.productId}-${item.batchId}`} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-slate-900">{item.supplierName}</p>
                <p className="font-bold text-emerald-700">{formatMoney(item.price, item.unit)}</p>
              </div>
              <p className="mt-1 text-slate-600">Batch {item.batchId} · {item.availableQuantity ?? 0} {item.unit} · {item.grade || 'N/A'} / {item.size || 'N/A'} · {item.originRegion || 'Không xác định'}</p>
            </div>
          )) : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Không có nhà cung cấp phù hợp.</p>}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="font-bold text-slate-900">{value}</p></div>
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return <div className="flex items-start justify-between gap-3"><h3 className="text-xl font-extrabold text-slate-900">{title}</h3><button className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}><X className="h-4 w-4" /></button></div>
}
