import axios from 'axios'
import type {
  AdminActivityItem,
  AdminActivityUpsertRequest,
  AdminDisputeItem,
  AdminDisputeRefundRequest,
  AdminDisputeStatus,
  AdminDisputeStatusUpdateRequest,
  AdminDisputeUpsertRequest,
  AdminOverviewPayload,
  AdminQuickStat,
  AdminQuickStatUpsertRequest,
  AdminRegistrationActionRequest,
  AdminRegistrationProfile,
  AdminRegistrationStatus,
  AdminTimeFilter,
  AdminUserRow,
} from '../types/admin'
import { apiClient } from './apiClient'
import { dispatchStateSync } from './stateSyncService'

export async function fetchAdminOverview(filter: AdminTimeFilter): Promise<AdminOverviewPayload> {
  try {
    const response = await apiClient.get<AdminOverviewPayload>('/api/admin/overview', {
      params: { filter },
      timeout: 20000,
    })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không tải được dữ liệu tổng quan hệ thống.'))
  }
}

export async function fetchAdminUsers(search?: string): Promise<AdminUserRow[]> {
  try {
    const response = await apiClient.get<AdminUserRow[]>('/api/admin/users', {
      params: search?.trim() ? { search: search.trim() } : undefined,
    })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không tải được danh sách người dùng đã được phê duyệt.'))
  }
}

export async function lockAdminUser(userId: number): Promise<AdminUserRow> {
  try {
    const response = await apiClient.patch<AdminUserRow>(`/api/admin/users/${userId}/lock`, {})
    dispatchStateSync(['ADMIN', 'PROFILE', 'DASHBOARD'], { source: 'admin-user:lock', entityId: userId })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không khóa được tài khoản người dùng.'))
  }
}

export async function unlockAdminUser(userId: number): Promise<AdminUserRow> {
  try {
    const response = await apiClient.patch<AdminUserRow>(`/api/admin/users/${userId}/unlock`, {})
    dispatchStateSync(['ADMIN', 'PROFILE', 'DASHBOARD'], { source: 'admin-user:unlock', entityId: userId })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không mở khóa được tài khoản người dùng.'))
  }
}

export async function fetchRegistrationProfiles(
  status?: AdminRegistrationStatus,
  search?: string,
): Promise<AdminRegistrationProfile[]> {
  try {
    const response = await apiClient.get<AdminRegistrationProfile[]>('/api/admin/registrations', {
      params: {
        ...(status ? { status } : {}),
        ...(search?.trim() ? { search: search.trim() } : {}),
      },
    })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không tải được danh sách hồ sơ đăng ký.'))
  }
}

export async function approveRegistrationProfile(
  companyId: number,
  payload: AdminRegistrationActionRequest = {},
): Promise<AdminRegistrationProfile> {
  try {
    const response = await apiClient.post<AdminRegistrationProfile>(
      `/api/admin/registrations/${companyId}/approve`,
      sanitizeActionPayload(payload),
    )
    dispatchStateSync(['ADMIN', 'PROFILE', 'DASHBOARD', 'NOTIFICATION'], { source: 'admin-registration:approve', entityId: companyId })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không phê duyệt được hồ sơ đăng ký.'))
  }
}

export async function requestMoreInfoForRegistration(
  companyId: number,
  payload: AdminRegistrationActionRequest,
): Promise<AdminRegistrationProfile> {
  try {
    const response = await apiClient.post<AdminRegistrationProfile>(
      `/api/admin/registrations/${companyId}/request-more-info`,
      sanitizeActionPayload(payload),
    )
    dispatchStateSync(['ADMIN', 'PROFILE', 'DASHBOARD', 'NOTIFICATION'], { source: 'admin-registration:request-more-info', entityId: companyId })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không gửi được yêu cầu bổ sung hồ sơ.'))
  }
}

export async function rejectRegistrationProfile(
  companyId: number,
  payload: AdminRegistrationActionRequest,
): Promise<AdminRegistrationProfile> {
  try {
    const response = await apiClient.post<AdminRegistrationProfile>(
      `/api/admin/registrations/${companyId}/reject`,
      sanitizeActionPayload(payload),
    )
    dispatchStateSync(['ADMIN', 'PROFILE', 'DASHBOARD', 'NOTIFICATION'], { source: 'admin-registration:reject', entityId: companyId })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không từ chối được hồ sơ đăng ký.'))
  }
}

export async function reopenRegistrationProfile(
  companyId: number,
  payload: AdminRegistrationActionRequest,
): Promise<AdminRegistrationProfile> {
  try {
    const response = await apiClient.post<AdminRegistrationProfile>(
      `/api/admin/registrations/${companyId}/reopen`,
      sanitizeActionPayload(payload),
    )
    dispatchStateSync(['ADMIN', 'PROFILE', 'DASHBOARD', 'NOTIFICATION'], { source: 'admin-registration:reopen', entityId: companyId })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không mở lại được hồ sơ đăng ký.'))
  }
}

export async function fetchAdminDisputes(search?: string, status?: AdminDisputeStatus): Promise<AdminDisputeItem[]> {
  try {
    const response = await apiClient.get<AdminDisputeItem[]>('/api/admin/disputes', {
      params: {
        ...(search?.trim() ? { search: search.trim() } : {}),
        ...(status ? { status } : {}),
      },
    })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không tải được danh sách tranh chấp.'))
  }
}

export async function fetchAdminDisputeById(disputeId: number): Promise<AdminDisputeItem> {
  try {
    const response = await apiClient.get<AdminDisputeItem>(`/api/admin/disputes/${disputeId}`)
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không tải được chi tiết tranh chấp.'))
  }
}

export async function createAdminDispute(payload: AdminDisputeUpsertRequest): Promise<AdminDisputeItem> {
  try {
    const response = await apiClient.post<AdminDisputeItem>('/api/admin/disputes', sanitizeDisputePayload(payload))
    dispatchStateSync(['ADMIN', 'COMPLAINT', 'ORDER', 'DELIVERY', 'DASHBOARD', 'NOTIFICATION'], { source: 'admin-dispute:create', entityId: response.data?.id })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không tạo được tranh chấp.'))
  }
}

export async function updateAdminDispute(disputeId: number, payload: AdminDisputeUpsertRequest): Promise<AdminDisputeItem> {
  try {
    const response = await apiClient.put<AdminDisputeItem>(`/api/admin/disputes/${disputeId}`, sanitizeDisputePayload(payload))
    dispatchStateSync(['ADMIN', 'COMPLAINT', 'ORDER', 'DELIVERY', 'DASHBOARD', 'NOTIFICATION'], { source: 'admin-dispute:update', entityId: disputeId })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không cập nhật được tranh chấp.'))
  }
}

export async function updateAdminDisputeStatus(
  disputeId: number,
  payload: AdminDisputeStatusUpdateRequest,
): Promise<AdminDisputeItem> {
  try {
    const response = await apiClient.patch<AdminDisputeItem>(
      `/api/admin/disputes/${disputeId}/status`,
      sanitizeDisputeStatusPayload(payload),
    )
    dispatchStateSync(['ADMIN', 'COMPLAINT', 'ORDER', 'DELIVERY', 'DASHBOARD', 'NOTIFICATION'], { source: 'admin-dispute:update-status', entityId: disputeId })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không cập nhật được trạng thái tranh chấp.'))
  }
}

export async function refundAdminDispute(disputeId: number, payload: AdminDisputeRefundRequest): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/api/admin/disputes/${disputeId}/refund`,
      {
        refundAmount: payload.refundAmount,
        reason: payload.reason?.trim(),
      },
    )
    dispatchStateSync(['ADMIN', 'COMPLAINT', 'ORDER', 'DELIVERY', 'DASHBOARD', 'PAYMENT'], { source: 'admin-dispute:refund', entityId: disputeId })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không hoàn tiền được tranh chấp.'))
  }
}

export async function deleteAdminDispute(disputeId: number): Promise<void> {
  try {
    await apiClient.delete(`/api/admin/disputes/${disputeId}`)
    dispatchStateSync(['ADMIN', 'COMPLAINT', 'ORDER', 'DELIVERY', 'DASHBOARD', 'NOTIFICATION'], { source: 'admin-dispute:delete', entityId: disputeId })
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không xóa được tranh chấp.'))
  }
}

export async function createAdminOverviewActivity(payload: AdminActivityUpsertRequest): Promise<AdminActivityItem> {
  try {
    const response = await apiClient.post<AdminActivityItem>('/api/admin/overview/activities', sanitizeOverviewActivityPayload(payload))
    dispatchStateSync(['ADMIN', 'DASHBOARD'], { source: 'admin-overview:create-activity', entityId: response.data?.id })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không tạo được hoạt động dashboard.'))
  }
}

export async function updateAdminOverviewActivity(activityId: number, payload: AdminActivityUpsertRequest): Promise<AdminActivityItem> {
  try {
    const response = await apiClient.put<AdminActivityItem>(
      `/api/admin/overview/activities/${activityId}`,
      sanitizeOverviewActivityPayload(payload),
    )
    dispatchStateSync(['ADMIN', 'DASHBOARD'], { source: 'admin-overview:update-activity', entityId: activityId })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không cập nhật được hoạt động dashboard.'))
  }
}

export async function deleteAdminOverviewActivity(activityId: number): Promise<void> {
  try {
    await apiClient.delete(`/api/admin/overview/activities/${activityId}`)
    dispatchStateSync(['ADMIN', 'DASHBOARD'], { source: 'admin-overview:delete-activity', entityId: activityId })
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không xóa được hoạt động dashboard.'))
  }
}

export async function createAdminQuickStat(payload: AdminQuickStatUpsertRequest): Promise<AdminQuickStat> {
  try {
    const response = await apiClient.post<AdminQuickStat>('/api/admin/overview/quick-stats', sanitizeQuickStatPayload(payload))
    dispatchStateSync(['ADMIN', 'DASHBOARD'], { source: 'admin-overview:create-quick-stat', entityId: response.data?.id })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không tạo được thống kê nhanh.'))
  }
}

export async function updateAdminQuickStat(statId: number, payload: AdminQuickStatUpsertRequest): Promise<AdminQuickStat> {
  try {
    const response = await apiClient.put<AdminQuickStat>(
      `/api/admin/overview/quick-stats/${statId}`,
      sanitizeQuickStatPayload(payload),
    )
    dispatchStateSync(['ADMIN', 'DASHBOARD'], { source: 'admin-overview:update-quick-stat', entityId: statId })
    return response.data
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không cập nhật được thống kê nhanh.'))
  }
}

export async function deleteAdminQuickStat(statId: number): Promise<void> {
  try {
    await apiClient.delete(`/api/admin/overview/quick-stats/${statId}`)
    dispatchStateSync(['ADMIN', 'DASHBOARD'], { source: 'admin-overview:delete-quick-stat', entityId: statId })
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, 'Không xóa được thống kê nhanh.'))
  }
}

function sanitizeActionPayload(payload: AdminRegistrationActionRequest): AdminRegistrationActionRequest {
  return {
    adminUserId: payload.adminUserId,
    reasonCodes: payload.reasonCodes?.filter(Boolean) ?? [],
    note: payload.note?.trim() || undefined,
    sendEmail: Boolean(payload.sendEmail),
    sendNotification: Boolean(payload.sendNotification),
  }
}

function sanitizeDisputePayload(payload: AdminDisputeUpsertRequest): AdminDisputeUpsertRequest {
  return {
    orderId: Number(payload.orderId),
    batchId: payload.batchId ?? undefined,
    createdByUserId: payload.createdByUserId ?? undefined,
    assignedToUserId: payload.assignedToUserId ?? undefined,
    status: payload.status,
    severity: payload.severity,
    title: payload.title.trim(),
    description: payload.description.trim(),
    resolution: payload.resolution?.trim() || undefined,
  }
}

function sanitizeDisputeStatusPayload(payload: AdminDisputeStatusUpdateRequest): AdminDisputeStatusUpdateRequest {
  return {
    assignedToUserId: payload.assignedToUserId ?? undefined,
    status: payload.status,
    resolution: payload.resolution?.trim() || undefined,
  }
}

function sanitizeOverviewActivityPayload(payload: AdminActivityUpsertRequest): AdminActivityUpsertRequest {
  return {
    title: payload.title.trim(),
    description: payload.description.trim(),
    time: payload.time.trim(),
    color: payload.color,
  }
}

function sanitizeQuickStatPayload(payload: AdminQuickStatUpsertRequest): AdminQuickStatUpsertRequest {
  return {
    label: payload.label.trim(),
    subLabel: payload.subLabel.trim(),
    value: payload.value.trim(),
    color: payload.color,
  }
}

function resolveApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) {
    return fallback
  }

  const payload = error.response?.data as { message?: string } | string | undefined
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }
  if (payload && typeof payload === 'object' && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message
  }
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message
  }

  return fallback
}
