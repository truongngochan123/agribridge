import type {
  AdminActivityItem,
  AdminDisputeItem,
  AdminMenuItem,
  AdminOverviewPayload,
  AdminQuickStat,
  AdminRegistrationProfile,
  AdminStat,
  AdminTimeFilter,
  AdminUserRow,
} from '../types/admin'

export const adminMenuItems: AdminMenuItem[] = [
  { key: 'overview', label: 'Tổng quan', path: '/admin/overview' },
  { key: 'users', label: 'Người dùng', path: '/admin/users' },
  { key: 'registrations', label: 'Duyệt hồ sơ', path: '/admin/registrations' },
  { key: 'disputes', label: 'Tranh chấp', path: '/admin/disputes' },
]

export const adminTimeFilters: Array<{ label: string; value: AdminTimeFilter }> = [
  { label: '7 ngày', value: '7d' },
  { label: '30 ngày', value: '30d' },
  { label: '3 tháng', value: '3m' },
  { label: '12 tháng', value: '12m' },
]

const overviewKpiByFilter: Record<AdminTimeFilter, AdminStat[]> = {
  '7d': [
    { title: 'Tổng GMV', value: '92 tỷ', change: '+4.1% so với 7 ngày trước', changeTone: 'up', color: 'emerald' },
    { title: 'Tổng đơn hàng', value: '2.981', change: '+3.5% so với 7 ngày trước', changeTone: 'up', color: 'blue' },
    { title: 'Người dùng mới', value: '68', change: '+9.2% so với 7 ngày trước', changeTone: 'up', color: 'violet' },
    { title: 'Tỷ lệ tranh chấp', value: '2.8%', change: '-0.2% so với 7 ngày trước', changeTone: 'down', color: 'amber' },
  ],
  '30d': [
    { title: 'Tổng GMV', value: '450 tỷ', change: '+12.5% so với tháng trước', changeTone: 'up', color: 'emerald' },
    { title: 'Tổng đơn hàng', value: '15.234', change: '+8.3% so với tháng trước', changeTone: 'up', color: 'blue' },
    { title: 'Người dùng mới', value: '342', change: '+15.2% so với tháng trước', changeTone: 'up', color: 'violet' },
    { title: 'Tỷ lệ tranh chấp', value: '2.3%', change: '-0.5% so với tháng trước', changeTone: 'down', color: 'amber' },
  ],
  '3m': [
    { title: 'Tổng GMV', value: '1.2 nghìn tỷ', change: '+10.3% so với quý trước', changeTone: 'up', color: 'emerald' },
    { title: 'Tổng đơn hàng', value: '43.780', change: '+7.4% so với quý trước', changeTone: 'up', color: 'blue' },
    { title: 'Người dùng mới', value: '901', change: '+13.1% so với quý trước', changeTone: 'up', color: 'violet' },
    { title: 'Tỷ lệ tranh chấp', value: '2.1%', change: '-0.3% so với quý trước', changeTone: 'down', color: 'amber' },
  ],
  '12m': [
    { title: 'Tổng GMV', value: '4.8 nghìn tỷ', change: '+18.8% so với năm trước', changeTone: 'up', color: 'emerald' },
    { title: 'Tổng đơn hàng', value: '173.400', change: '+12.7% so với năm trước', changeTone: 'up', color: 'blue' },
    { title: 'Người dùng mới', value: '3.954', change: '+16.9% so với năm trước', changeTone: 'up', color: 'violet' },
    { title: 'Tỷ lệ tranh chấp', value: '1.9%', change: '-0.6% so với năm trước', changeTone: 'down', color: 'amber' },
  ],
}

const gmvByFilter = {
  '7d': [
    { label: 'T2', value: 11 },
    { label: 'T3', value: 13 },
    { label: 'T4', value: 12 },
    { label: 'T5', value: 14 },
    { label: 'T6', value: 16 },
    { label: 'T7', value: 15 },
    { label: 'CN', value: 18 },
  ],
  '30d': [
    { label: 'Tuần 1', value: 88 },
    { label: 'Tuần 2', value: 104 },
    { label: 'Tuần 3', value: 112 },
    { label: 'Tuần 4', value: 126 },
  ],
  '3m': [
    { label: 'T1', value: 345 },
    { label: 'T2', value: 398 },
    { label: 'T3', value: 456 },
  ],
  '12m': [
    { label: 'Q2/23', value: 810 },
    { label: 'Q3/23', value: 930 },
    { label: 'Q4/23', value: 1120 },
    { label: 'Q1/24', value: 1280 },
    { label: 'Q2/24', value: 1460 },
  ],
} satisfies Record<AdminTimeFilter, Array<{ label: string; value: number }>>

const adminRecentActivities: AdminActivityItem[] = [
  { title: 'Người dùng mới đăng ký', description: 'Hợp tác xã Nông sản Đà Lạt', time: '5 phút trước', color: 'emerald' },
  { title: 'Lô hàng mới chờ duyệt', description: 'Tôm sú size 20 - 5.000 kg', time: '15 phút trước', color: 'blue' },
  { title: 'Tranh chấp mới', description: 'ORD-2024-001234 - Chất lượng không đúng', time: '1 giờ trước', color: 'red' },
  { title: 'Đơn hàng lớn', description: 'Chuỗi siêu thị VinMart - 125 triệu đ', time: '2 giờ trước', color: 'violet' },
]

const adminQuickStats: AdminQuickStat[] = [
  { label: 'Nhà cung cấp', subLabel: 'Đang hoạt động', value: '2,543', color: 'emerald' },
  { label: 'Nhà buôn', subLabel: 'Đang hoạt động', value: '5,821', color: 'blue' },
  { label: 'Lô hàng', subLabel: 'Đang bán', value: '8,456', color: 'violet' },
  { label: 'Chờ xử lý', subLabel: 'Cần chú ý', value: '23', color: 'amber' },
]

const riskByFilter: Record<AdminTimeFilter, AdminOverviewPayload['risks']> = {
  '7d': [
    { key: 'outstandingDebt', label: 'Tổng công nợ chưa thanh toán', value: '126 tỷ', hint: 'Tăng 4.6% trong 7 ngày gần nhất', critical: true },
    { key: 'overdueInvoices', label: 'Số invoice quá hạn', value: '38', hint: '9 invoice mới quá hạn trong tuần', critical: true },
    { key: 'openDisputes', label: 'Số tranh chấp đang mở', value: '14', hint: '2 vụ việc mức độ cao', critical: true },
  ],
  '30d': [
    { key: 'outstandingDebt', label: 'Tổng công nợ chưa thanh toán', value: '512 tỷ', hint: 'Đã giảm nhẹ so với tháng trước', critical: true },
    { key: 'overdueInvoices', label: 'Số invoice quá hạn', value: '129', hint: 'Tập trung ở nhóm buyer mới', critical: true },
    { key: 'openDisputes', label: 'Số tranh chấp đang mở', value: '23', hint: '17 vụ đã có lịch xử lý', critical: true },
  ],
  '3m': [
    { key: 'outstandingDebt', label: 'Tổng công nợ chưa thanh toán', value: '1.4 nghìn tỷ', hint: 'Rủi ro trung bình, cần theo dõi', critical: true },
    { key: 'overdueInvoices', label: 'Số invoice quá hạn', value: '322', hint: 'Đỉnh rủi ro rơi vào cuối quý', critical: true },
    { key: 'openDisputes', label: 'Số tranh chấp đang mở', value: '61', hint: 'Đã đóng 80% tranh chấp cũ', critical: false },
  ],
  '12m': [
    { key: 'outstandingDebt', label: 'Tổng công nợ chưa thanh toán', value: '5.2 nghìn tỷ', hint: 'Cần tái đánh giá credit limit', critical: true },
    { key: 'overdueInvoices', label: 'Số invoice quá hạn', value: '1.041', hint: 'Tỷ trọng quá hạn > 60 ngày đang tăng', critical: true },
    { key: 'openDisputes', label: 'Số tranh chấp đang mở', value: '186', hint: 'Mức độ cao chiếm 14%', critical: true },
  ],
}

export const adminOverviewByFilter: Record<AdminTimeFilter, AdminOverviewPayload> = {
  '7d': {
    kpis: overviewKpiByFilter['7d'],
    gmvSeries: gmvByFilter['7d'],
    risks: riskByFilter['7d'],
    activities: adminRecentActivities,
    quickStats: adminQuickStats,
  },
  '30d': {
    kpis: overviewKpiByFilter['30d'],
    gmvSeries: gmvByFilter['30d'],
    risks: riskByFilter['30d'],
    activities: adminRecentActivities,
    quickStats: adminQuickStats,
  },
  '3m': {
    kpis: overviewKpiByFilter['3m'],
    gmvSeries: gmvByFilter['3m'],
    risks: riskByFilter['3m'],
    activities: adminRecentActivities,
    quickStats: adminQuickStats,
  },
  '12m': {
    kpis: overviewKpiByFilter['12m'],
    gmvSeries: gmvByFilter['12m'],
    risks: riskByFilter['12m'],
    activities: adminRecentActivities,
    quickStats: adminQuickStats,
  },
}

export function getAdminOverviewPayload(filter: AdminTimeFilter): AdminOverviewPayload {
  return adminOverviewByFilter[filter]
}

export const adminUsers: AdminUserRow[] = []

export const adminDisputes: AdminDisputeItem[] = [
  {
    id: 1234,
    disputeCode: 'DSP-1234',
    orderId: 1234,
    batchId: null,
    createdByUserId: 1,
    assignedToUserId: 2,
    status: 'INVESTIGATING',
    statusLabel: 'Đang điều tra',
    severity: 'HIGH',
    severityLabel: 'Cao',
    title: 'Chất lượng không đúng cam kết',
    description: 'Lô hàng nhận được có 15% tôm không đạt size 20 như đã đặt, nhiều con bị vỡ đầu',
    resolution: null,
    buyerName: 'Chuỗi siêu thị VinMart',
    supplierName: 'Công ty TNHH Thủy sản Minh Phú',
    product: 'Tôm sú size 20',
    amount: '45.000.000 đ',
    createdByName: 'Admin 1',
    assignedToName: 'Admin 2',
    createdAt: '2024-03-20',
    resolvedAt: null,
  },
  {
    id: 1189,
    disputeCode: 'DSP-1189',
    orderId: 1189,
    batchId: null,
    createdByUserId: 1,
    assignedToUserId: 2,
    status: 'RESOLVED',
    statusLabel: 'Đã giải quyết',
    severity: 'MEDIUM',
    severityLabel: 'Trung bình',
    title: 'Giao hàng chậm trễ',
    description: 'Đơn hàng giao chậm 3 ngày so với cam kết, gây ảnh hưởng đến kế hoạch kinh doanh',
    resolution: 'Đã hoàn tiền một phần cho bên mua.',
    buyerName: 'Công ty CP Thực phẩm Sài Gòn',
    supplierName: 'Hợp tác xã Nông sản Đà Lạt',
    product: 'Thanh long ruột đỏ',
    amount: '12.000.000 đ',
    createdByName: 'Admin 1',
    assignedToName: 'Admin 2',
    createdAt: '2024-03-15',
    resolvedAt: '2024-03-18',
  },
]

export const adminRegistrationProfiles: AdminRegistrationProfile[] = []
