export type SupplierCard = {
  id: string
  name: string
  location: string
  category: string
  description: string
  rating: number
  productsCount: number
  certifications: string[]
  logoText: string
}

export type SupplierMetric = {
  label: string
  value: string
  subLabel: string
}

export type SupplierProduct = {
  id: string
  name: string
  lotId: string
  spec: string
  inventory: string
  price: string
  certifications: string[]
}

export type FaqItem = {
  id: string
  question: string
}

export type LeadershipMember = {
  id: string
  name: string
  role: string
  image: string
}
