// ─── Target (what we're ordering) ────────────────────────────────────────────

export type BuyerQuickOrderTarget = {
  productId: number
  categoryId?: number | null
  productName: string
  categoryName?: string | null
  supplierName?: string | null
  supplierId?: number | null
  supplierCompanyId?: number | null
  originRegion?: string | null
  unit?: string | null
  price?: number | null
  minMoq?: number | null
  availableQuantity?: number | null
  imageUrl?: string | null
  batchId?: number | null
  batchCode?: string | null
  grade?: string | null
  size?: string | null
  expiryDate?: string | null
  buyerCompanyId?: number | null
}

// ─── Buyer session info ───────────────────────────────────────────────────────

export type BuyerQuickOrderBuyerInfo = {
  fullName?: string | null
  companyName?: string | null
  phone?: string | null
  province?: string | null
  address?: string | null
}

// ─── Credit limit (from supplier to this buyer) ───────────────────────────────

export type BuyerCreditLimit = {
  paymentTermDays: number
  creditLimit?: number | null
  isBlocked?: boolean
  blockedReason?: string | null
}

// ─── Payload sent on submit ───────────────────────────────────────────────────

export type BuyerQuickOrderPayload = {
  buyerCompanyId?: number | null
  supplierId?: number | null
  productId: number
  batchId?: number | null
  quantity: number
  unit: string
  unitPrice?: number | null
  subtotal?: number | null
  deliveryName: string
  deliveryPhone: string
  deliveryProvince: string
  deliveryAddress: string
  paymentMethod: 'BANK_TRANSFER' | 'CREDIT'
  creditTermDays?: number | null
  shippingFee: null
  shippingStatus: 'PENDING_QUOTE'
  orderStatus: 'PENDING_SUPPLIER_CONFIRMATION'
  note?: string | null
}

// ─── Legacy form data (kept for backward compat) ─────────────────────────────

export type BuyerQuickOrderFormData = {
  quantity: string
  unit: string
  deliveryDate: string
  province: string
  note: string
}
