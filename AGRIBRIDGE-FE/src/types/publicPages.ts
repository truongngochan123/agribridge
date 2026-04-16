export interface SupplierDirectoryItem {
  id: string
  name: string
  logoText: string
  location: string
  category: string
  description: string
  rating: number
  productCount: number
  certifications: string[]
}

export interface SupplierMetric {
  label: string
  value: string
  hint: string
}

export interface SupplierCapability {
  seafood: string
  output: string
  moq: string
  port: string
  readyTime: string
  logistics: string
}

export interface SupplierBusinessInfo {
  legalName: string
  model: string
  address: string
  phone: string
  email: string
  website: string
}

export interface SupplierOfferItem {
  id: string
  name: string
  lot: string
  grade: string
  size: string
  stock: string
  status: string
  price: string
  total: string
  certs: string[]
}

export interface FaqItem {
  id: string
  question: string
}

export interface AboutStat {
  label: string
  value: string
}

export interface AboutValueItem {
  title: string
  description: string
}

export interface LeadershipItem {
  name: string
  role: string
  image: string
}
