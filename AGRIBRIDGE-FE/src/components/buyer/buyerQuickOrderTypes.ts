export type BuyerQuickOrderTarget = {
  productId: number
  categoryId?: number | null
  productName: string
  categoryName?: string | null
  supplierName?: string | null
  originRegion?: string | null
  unit?: string | null
  minMoq?: number | null
  availableQuantity?: number | null
  imageUrl?: string | null
  batchId?: number | null
  batchCode?: string | null
}

export type BuyerQuickOrderFormData = {
  quantity: string
  unit: string
  deliveryDate: string
  province: string
  note: string
}
