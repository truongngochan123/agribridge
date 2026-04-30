import { apiClient } from './apiClient'

export type MarketPriceRow = {
  id: number
  productTypeId?: number | null
  productTypeName: string
  normalizedProductName: string
  categoryId?: number | null
  categoryName?: string | null
  grade?: string | null
  size?: string | null
  gradeSize: string
  unit?: string | null
  region?: string | null
  currentPrice: number
  avgPrice: number
  minPrice: number
  maxPrice: number
  changePercent: number
  changeType: 'UP' | 'DOWN' | 'FLAT'
  sourceType: 'INTERNAL_SUPPLIER_LISTING' | 'INTERNAL_TRANSACTION'
  sourceName: string
  sampleCount: number
  supplierCount: number
  priceDate: string
  updatedAt?: string | null
  isAbnormal: boolean
}

export type MarketPriceFilters = {
  categories: Array<{ value: string; label: string }>
  productTypes: Array<{ value: string; label: string }>
  regions: string[]
  grades: string[]
  sizes: string[]
  sourceTypes: Array<{ value: string; label: string }>
  dateRanges: Array<{ value: string; label: string }>
}

export type MarketPriceQuery = {
  keyword?: string
  categoryId?: string
  productType?: string
  region?: string
  grade?: string
  size?: string
  sourceType?: string
  range?: string
}

export type MarketPriceHistory = {
  summary: {
    currentPrice: number
    avgPrice: number
    minPrice: number
    maxPrice: number
    changePercent: number
    sampleCount: number
    supplierCount: number
  }
  points: Array<{
    date: string
    avgPrice: number
    minPrice: number
    maxPrice: number
    sampleCount: number
  }>
}

export type MarketPriceSupplier = {
  supplierName: string
  productId?: number | null
  batchId?: number | null
  price: number
  availableQuantity?: number | null
  grade?: string | null
  size?: string | null
  unit?: string | null
  originRegion?: string | null
  updatedAt?: string | null
}

function cleanParams(params: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value && value !== 'all'))
}

export async function fetchBuyerMarketPrices(query: MarketPriceQuery): Promise<MarketPriceRow[]> {
  const response = await apiClient.get('/api/buyer/market-prices', { params: cleanParams(query) })
  return response.data?.data ?? response.data
}

export async function fetchBuyerMarketPriceFilters(): Promise<MarketPriceFilters> {
  const response = await apiClient.get('/api/buyer/market-prices/filters')
  return response.data?.data ?? response.data
}

export async function fetchBuyerMarketPriceHistory(row: MarketPriceRow, range: string): Promise<MarketPriceHistory> {
  const response = await apiClient.get(`/api/buyer/market-prices/${encodeURIComponent(row.normalizedProductName)}/history`, {
    params: cleanParams({
      region: row.region || undefined,
      grade: row.grade || undefined,
      size: row.size || undefined,
      unit: row.unit || undefined,
      sourceType: row.sourceType,
      range,
    }),
  })
  return response.data?.data ?? response.data
}

export async function fetchBuyerMarketPriceSuppliers(row: MarketPriceRow): Promise<MarketPriceSupplier[]> {
  const response = await apiClient.get(`/api/buyer/market-prices/${encodeURIComponent(row.normalizedProductName)}/suppliers`, {
    params: cleanParams({
      region: row.region || undefined,
      grade: row.grade || undefined,
      size: row.size || undefined,
      unit: row.unit || undefined,
    }),
  })
  return response.data?.data ?? response.data
}
