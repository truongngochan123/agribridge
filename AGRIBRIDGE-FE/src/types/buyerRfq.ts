export type BuyerRfqListItem = {
  id: number
  code?: string | null
  title?: string | null
  type?: 'DIRECT' | 'MARKETPLACE' | string | null
  status?: string | null
  quoteCount?: number | null
  createdAt?: string | null
  deadline?: string | null
  expiredAt?: string | null
  product?: string | null
  productName?: string | null
  productId?: number | null
  supplierId?: number | null
  supplierName?: string | null
  categoryId?: number | null
  quantity?: number | null
  unit?: string | null
  targetPrice?: number | null
  deliveryDate?: string | null
  province?: string | null
  branchId?: number | null
}

export type BuyerRfqPageResponse = {
  content: BuyerRfqListItem[]
  totalElements?: number
  totalPages?: number
  number?: number
  size?: number
}

export type BuyerRfqDetail = BuyerRfqListItem & {
  description?: string | null
  category?: string | null
  branch?: {
    id?: number | null
    name?: string | null
    address?: string | null
    deliveryAddress?: string | null
    province?: string | null
    phone?: string | null
  } | null
}

export type BuyerRfqCompareInfo = {
  id: number
  code?: string | null
  title?: string | null
  productId?: number | null
  categoryId?: number | null
  product?: string | null
  productName?: string | null
  quantity?: number | null
  unit?: string | null
  targetPrice?: number | null
  deadline?: string | null
  deliveryDate?: string | null
  province?: string | null
  deliveryAddress?: string | null
}

export type BuyerQuoteCompareItem = {
  id: number
  productId?: number | null
  supplierId?: number | null
  supplierName?: string | null
  supplierProvince?: string | null
  supplierRating?: number | null
  supplierOrderCount?: number | null
  tags?: string[]
  price?: number | null
  quantity?: number | null
  unit?: string | null
  total?: number | null
  batchId?: number | null
  batchCode?: string | null
  gradeSize?: string | null
  harvestDate?: string | null
  expiryDate?: string | null
  deliveryDays?: number | null
  estimatedDeliveryDate?: string | null
  shippingFee?: number | null
  paymentTerm?: string | null
  note?: string | null
  status?: string | null
}

export type BuyerRfqCompareResponse = {
  rfq: BuyerRfqCompareInfo
  quotes: BuyerQuoteCompareItem[]
}

export type CreateBuyerRfqRequest = {
  title: string
  type?: 'DIRECT' | 'MARKETPLACE' | string
  productName?: string | null
  supplierId?: number | null
  supplierCompanyId?: number | null
  productId?: number | null
  categoryId?: number | null
  branchId?: number | null
  quantity: number
  unit: string
  province?: string | null
  deliveryDate?: string | null
  expiredAt: string
  description?: string | null
}

export type UpdateBuyerRfqRequest = {
  title?: string
  quantity?: number
  unit?: string
  province?: string | null
  deliveryDate?: string | null
  expiredAt?: string | null
  description?: string | null
  branchId?: number | null
}

export type ConvertQuoteToOrderRequest = {
  deliveryAddress?: string
  deliveryProvince?: string
  note?: string
  createInvoice?: boolean
}

export type ConvertQuoteToOrderResponse = {
  orderId: number
  invoiceId?: number | null
  quoteId?: number | null
  rfqId?: number | null
  totalAmount?: number | null
  orderStatus?: string | null
  invoiceStatus?: string | null
  supplierName?: string | null
  createdAt?: string | null
}

export type BuyerRfqOrderItem = ConvertQuoteToOrderResponse
