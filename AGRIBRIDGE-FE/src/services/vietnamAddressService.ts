type VietnamProvinceApiItem = {
  code: number
  name: string
  wards?: VietnamWardApiItem[]
}

type VietnamWardApiItem = {
  code: number
  name: string
}

export type VietnamProvinceOption = {
  code: number
  name: string
}

export type VietnamWardOption = {
  code: number
  name: string
}

const DEFAULT_VN_ADDRESS_API_BASE_URL = '/province-api/api/v2'
const VN_ADDRESS_API_BASE_URL =
  import.meta.env.VITE_VN_ADDRESS_API_BASE_URL ?? DEFAULT_VN_ADDRESS_API_BASE_URL

let cachedProvinces: VietnamProvinceOption[] | null = null
const wardCacheByProvinceCode = new Map<number, VietnamWardOption[]>()

function normalizeVietnamText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(thanh pho|tp\.?|tinh)\s+/i, '')
    .replace(/[.\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findProvinceByName(
  provinces: VietnamProvinceOption[],
  provinceName?: string | null,
): VietnamProvinceOption | undefined {
  if (!provinceName) return undefined

  const target = normalizeVietnamText(provinceName)
  if (!target) return undefined

  return provinces.find((province) => normalizeVietnamText(province.name) === target)
}

export async function fetchVietnamProvinces(): Promise<VietnamProvinceOption[]> {
  if (cachedProvinces) return cachedProvinces

  const response = await fetch(`${VN_ADDRESS_API_BASE_URL}/p/?limit=100`)
  if (!response.ok) {
    throw new Error('Không thể tải danh sách tỉnh/thành.')
  }

  const payload = (await response.json()) as VietnamProvinceApiItem[]

  cachedProvinces = payload
    .map((item) => ({ code: item.code, name: item.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

  return cachedProvinces
}

export async function fetchVietnamWardsByProvinceCode(
  provinceCode: number,
): Promise<VietnamWardOption[]> {
  if (wardCacheByProvinceCode.has(provinceCode)) {
    return wardCacheByProvinceCode.get(provinceCode) ?? []
  }

  const response = await fetch(`${VN_ADDRESS_API_BASE_URL}/p/${provinceCode}?depth=2`)
  if (!response.ok) {
    throw new Error('Không thể tải danh sách xã/phường.')
  }

  const payload = (await response.json()) as VietnamProvinceApiItem

  const wards = (payload.wards ?? []).map((ward) => ({
    code: ward.code,
    name: ward.name,
  }))

  wardCacheByProvinceCode.set(
    provinceCode,
    wards.sort((a, b) => a.name.localeCompare(b.name, 'vi')),
  )

  return wardCacheByProvinceCode.get(provinceCode) ?? []
}