export type RfqMessageSenderRole = 'BUYER' | 'SUPPLIER' | 'ADMIN'

export interface RfqMessage {
  id: number
  rfqId: number
  supplierCompanyId: number
  senderUserId: number
  senderCompanyId: number
  senderRole: RfqMessageSenderRole
  message: string
  createdAt: string
}

export interface SendRfqMessagePayload {
  supplierCompanyId?: number | null
  message: string
}
