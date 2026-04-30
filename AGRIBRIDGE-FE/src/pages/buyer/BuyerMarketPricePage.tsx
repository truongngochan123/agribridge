import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { BuyerPanel } from '../../components/buyer/BuyerCommon'
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

export function BuyerMarketPricePage() {
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
      const [priceData, provinces] = await Promise.all([
        fetchBuyerMarketPrices({ ...query, keyword: debouncedKeyword }),
        provinceRegions.length ? Promise.resolve(null) : fetchVietnamProvinces(),
      ])
      setFilters(filterData)
      setRows(priceData)
      if (provinces) {
        setProvinceRegions(provinces.map((province) => province.name))
      }
    } catch (requestError) {
      setRows([])
      setError(readApiErrorMessage(requestError) || 'Không thể tải giá tham khảo nội bộ.')
    } finally {
      setLoading(false)
    }
  }, [debouncedKeyword, filters, provinceRegions.length, query])

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
      <BuyerShell activeKey="market" title="Giá thị trường" subtitle="Giá tham khảo nội bộ theo loại sản phẩm">
        <BuyerPanel
          title="Giá tham khảo theo loại sản phẩm"
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <input
                className="h-10 min-w-[220px] rounded-lg border border-emerald-200 bg-white px-3 text-sm"
                placeholder="Tìm sản phẩm/loại sản phẩm"
                value={query.keyword}
                onChange={(event) => setQuery((current) => ({ ...current, keyword: event.target.value }))}
              />
              <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm" value={query.categoryId} onChange={(event) => setQuery((current) => ({ ...current, categoryId: event.target.value }))}>
                <option value="">Tất cả nhóm hàng</option>
                {filters.categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm" value={query.productType} onChange={(event) => setQuery((current) => ({ ...current, productType: event.target.value }))}>
                <option value="">Tất cả loại sản phẩm</option>
                {filters.productTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm" value={query.region} onChange={(event) => setQuery((current) => ({ ...current, region: event.target.value }))}>
                <option value="">Tất cả khu vực</option>
                {regionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm" value={query.range} onChange={(event) => setQuery((current) => ({ ...current, range: event.target.value }))}>
                {dateRanges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm" value={query.grade} onChange={(event) => setQuery((current) => ({ ...current, grade: event.target.value }))}>
                <option value="">Tất cả Grade</option>
                {filters.grades.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm" value={query.size} onChange={(event) => setQuery((current) => ({ ...current, size: event.target.value }))}>
                <option value="">Tất cả Size</option>
                {filters.sizes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className="h-10 rounded-lg border border-emerald-200 bg-white px-3 text-sm" value={query.sourceType} onChange={(event) => setQuery((current) => ({ ...current, sourceType: event.target.value }))}>
                {filters.sourceTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          }
        >
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Nguồn dữ liệu: Giá được tổng hợp từ giá chào bán của nhiều nhà cung cấp và giao dịch hoàn tất trên AgriBridge. Giá áp dụng theo loại sản phẩm + khu vực + grade + size.
          </div>
          {loading ? <p className="mb-3 text-sm font-semibold text-emerald-700">Đang tải giá tham khảo...</p> : null}
          {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
          {!loading && !error && rows.length === 0 ? (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm font-semibold text-emerald-800">Chưa có dữ liệu giá nội bộ phù hợp. Vui lòng chạy rebuild giá nội bộ.</p>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-emerald-100">
            <table className="min-w-[1320px] text-left text-sm">
              <thead className="bg-emerald-50 text-emerald-800">
                <tr>
                  <th className="px-4 py-3">Loại sản phẩm</th>
                  <th className="px-4 py-3">Nhóm hàng</th>
                  <th className="px-4 py-3">Grade/Size</th>
                  <th className="px-4 py-3">Giá hiện tại</th>
                  <th className="px-4 py-3">Giá trung bình</th>
                  <th className="px-4 py-3">Khoảng giá min-max</th>
                  <th className="px-4 py-3">Thay đổi</th>
                  <th className="px-4 py-3">Khu vực</th>
                  <th className="px-4 py-3">Số NCC / Số mẫu</th>
                  <th className="px-4 py-3">Nguồn</th>
                  <th className="px-4 py-3">Cập nhật</th>
                  <th className="px-4 py-3">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-emerald-100">
                    <td className="px-4 py-3 font-semibold text-emerald-900">{row.productTypeName}</td>
                    <td className="px-4 py-3 text-emerald-900">{row.categoryName || 'N/A'}</td>
                    <td className="px-4 py-3 text-emerald-900">{row.gradeSize}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-900">{formatMoney(row.currentPrice, row.unit)}</td>
                    <td className="px-4 py-3 text-emerald-900">{formatMoney(row.avgPrice, row.unit)}</td>
                    <td className="px-4 py-3 text-emerald-900">{formatMoney(row.minPrice, row.unit)} - {formatMoney(row.maxPrice, row.unit)}</td>
                    <td className="px-4 py-3"><ChangeBadge row={row} /></td>
                    <td className="px-4 py-3">{row.region || 'Không xác định'}</td>
                    <td className="px-4 py-3">{row.supplierCount || 0} / {row.sampleCount || 0}</td>
                    <td className="px-4 py-3">{sourceLabel(row.sourceType)}</td>
                    <td className="px-4 py-3">{formatDate(row.updatedAt || row.priceDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => void openHistory(row)}>Xem lịch sử giá</button>
                        {row.sourceType === 'INTERNAL_SUPPLIER_LISTING' ? (
                          <button className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700" onClick={() => void openSuppliers(row)}>Xem nhà cung cấp</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BuyerPanel>
      </BuyerShell>
      {history ? <HistoryModal payload={history} onClose={() => setHistory(null)} /> : null}
      {suppliers ? <SupplierModal payload={suppliers} onClose={() => setSuppliers(null)} /> : null}
    </>
  )
}

function ChangeBadge({ row }: { row: MarketPriceRow }) {
  const cls = row.changeType === 'UP' ? 'bg-emerald-100 text-emerald-700' : row.changeType === 'DOWN' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
  const sign = row.changeType === 'UP' ? '+' : ''
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${cls}`}>{sign}{Number(row.changePercent || 0).toFixed(2)}%</span>
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
