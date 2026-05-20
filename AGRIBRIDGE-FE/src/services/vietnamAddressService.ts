/**
 * vietnamAddressService.ts
 *
 * Fetches Vietnam administrative divisions using OpenAPI v1
 * (https://provinces.open-api.vn/api/v1) which supports the
 * 3-level hierarchy: Province → District → Ward.
 *
 * Endpoints used:
 *   GET /api/v1/p/              - list all provinces
 *   GET /api/v1/p/{code}?depth=2 - province + districts
 *   GET /api/v1/d/{code}?depth=2 - district + wards
 */

const API_BASE = '/province-api/api/v1'

// ─── Types ──────────────────────────────────────────────────────────────────

export type VietnamProvinceOption = {
  code: number
  name: string
  codename: string
  division_type: string
}

export type VietnamDistrictOption = {
  code: number
  name: string
  codename: string
  division_type: string
  province_code: number
}

export type VietnamWardOption = {
  code: number
  name: string
  codename: string
  division_type: string
  district_code: number
}

// ─── In-memory caches ────────────────────────────────────────────────────────

let provincesCache: VietnamProvinceOption[] | null = null

const districtCacheByProvinceCode = new Map<number, VietnamDistrictOption[]>()
const wardCacheByDistrictCode = new Map<number, VietnamWardOption[]>()

// ─── Province ────────────────────────────────────────────────────────────────

/**
 * Fetch all provinces/cities (63 tỉnh/thành).
 * Cached after first call.
 */
export async function fetchVietnamProvinces(): Promise<VietnamProvinceOption[]> {
  if (provincesCache) return provincesCache
  const response = await fetch(`${API_BASE}/p/`)
  if (!response.ok) throw new Error(`Failed to fetch provinces: ${response.status}`)
  const data = (await response.json()) as VietnamProvinceOption[]
  provincesCache = data
  return data
}

/**
 * Find a province by display name (fuzzy, trimmed).
 * Returns null if not found.
 */
export function findProvinceByName(
  provinces: VietnamProvinceOption[],
  name: string,
): VietnamProvinceOption | null {
  if (!name?.trim()) return null
  const normalized = normalizeVietnamText(name.trim())
  return (
    provinces.find(
      (p) =>
        normalizeVietnamText(p.name) === normalized ||
        normalizeVietnamText(p.codename) === normalized,
    ) ?? null
  )
}

// ─── District ────────────────────────────────────────────────────────────────

/**
 * Fetch districts for a given province code.
 * Uses GET /api/v1/p/{code}?depth=2 and extracts `.districts`.
 * Cached per province code.
 */
export async function fetchVietnamDistrictsByProvinceCode(
  provinceCode: number,
): Promise<VietnamDistrictOption[]> {
  const cached = districtCacheByProvinceCode.get(provinceCode)
  if (cached) return cached

  const response = await fetch(`${API_BASE}/p/${provinceCode}?depth=2`)
  if (!response.ok) throw new Error(`Failed to fetch districts for province ${provinceCode}: ${response.status}`)

  const data = (await response.json()) as {
    districts?: VietnamDistrictOption[]
  }
  const districts: VietnamDistrictOption[] = (data.districts ?? []).map((d) => ({
    ...d,
    province_code: provinceCode,
  }))
  districtCacheByProvinceCode.set(provinceCode, districts)
  return districts
}

/**
 * Find a district by display name within a list of districts.
 */
export function findDistrictByName(
  districts: VietnamDistrictOption[],
  name: string,
): VietnamDistrictOption | null {
  if (!name?.trim()) return null
  const normalized = normalizeVietnamText(name.trim())
  return (
    districts.find(
      (d) =>
        normalizeVietnamText(d.name) === normalized ||
        normalizeVietnamText(d.codename) === normalized,
    ) ?? null
  )
}

// ─── Ward ────────────────────────────────────────────────────────────────────

/**
 * Fetch wards for a given district code.
 * Uses GET /api/v1/d/{code}?depth=2 and extracts `.wards`.
 * Cached per district code.
 */
export async function fetchVietnamWardsByDistrictCode(
  districtCode: number,
): Promise<VietnamWardOption[]> {
  const cached = wardCacheByDistrictCode.get(districtCode)
  if (cached) return cached

  const response = await fetch(`${API_BASE}/d/${districtCode}?depth=2`)
  if (!response.ok) throw new Error(`Failed to fetch wards for district ${districtCode}: ${response.status}`)

  const data = (await response.json()) as {
    wards?: VietnamWardOption[]
  }
  const wards: VietnamWardOption[] = (data.wards ?? []).map((w) => ({
    ...w,
    district_code: districtCode,
  }))
  wardCacheByDistrictCode.set(districtCode, wards)
  return wards
}

/**
 * Find a ward by display name within a list of wards.
 */
export function findWardByName(
  wards: VietnamWardOption[],
  name: string,
): VietnamWardOption | null {
  if (!name?.trim()) return null
  const normalized = normalizeVietnamText(name.trim())
  return (
    wards.find(
      (w) =>
        normalizeVietnamText(w.name) === normalized ||
        normalizeVietnamText(w.codename) === normalized,
    ) ?? null
  )
}

// ─── Normalizer ──────────────────────────────────────────────────────────────

/**
 * Strip diacritics and convert to lowercase for fuzzy matching.
 */
export function normalizeVietnamText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Cache invalidation ──────────────────────────────────────────────────────

/** Clear all cached address data (useful for testing or forced refresh). */
export function clearVietnamAddressCache(): void {
  provincesCache = null
  districtCacheByProvinceCode.clear()
  wardCacheByDistrictCode.clear()
}