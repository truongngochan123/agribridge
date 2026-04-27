export type RfqMessageSenderRole = 'BUYER' | 'SUPPLIER' | 'ADMIN'

export interface RfqMessage {
  id: number
  rfqId: number
  senderUserId: number
  senderCompanyId: number
  senderRole: RfqMessageSenderRole
  message: string
  createdAt: string
}

export interface SendRfqMessagePayload {
  rfqId: number
  senderUserId: number
  senderCompanyId: number
  senderRole: RfqMessageSenderRole
  message: string
}
