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
  { key: 'categories', label: 'Danh mục', path: '/admin/categories' },
  { key: 'disputes', label: 'Tranh chấp', path: '/admin/disputes' },
  { key: 'profile', label: 'Hồ sơ cá nhân', path: '/admin/profile' },
  { key: 'withdrawals', label: 'Rút tiền', path: '/admin/withdrawals' },
]

export const adminTimeFilters: Array<{ label: string; value: AdminTimeFilter }> = [
  { label: '7 ngày', value: '7d' },
  { label: '30 ngày', value: '30d' },
  { label: '3 tháng', value: '3m' },
  { label: '12 tháng', value: '12m' },
]

const overviewKpiByFilter: Record<AdminTimeFilter, AdminStat[]> = {
  '7d': [
    { title: 'Tá»•ng GMV', value: '92 tá»·', change: '+4.1% so vá»›i 7 ngÃ y trÆ°á»›c', changeTone: 'up', color: 'emerald' },
    { title: 'Tá»•ng Ä‘Æ¡n hÃ ng', value: '2.981', change: '+3.5% so vá»›i 7 ngÃ y trÆ°á»›c', changeTone: 'up', color: 'blue' },
    { title: 'NgÆ°á»i dÃ¹ng má»›i', value: '68', change: '+9.2% so vá»›i 7 ngÃ y trÆ°á»›c', changeTone: 'up', color: 'violet' },
    { title: 'Tá»· lá»‡ tranh cháº¥p', value: '2.8%', change: '-0.2% so vá»›i 7 ngÃ y trÆ°á»›c', changeTone: 'down', color: 'amber' },
  ],
  '30d': [
    { title: 'Tá»•ng GMV', value: '450 tá»·', change: '+12.5% so vá»›i thÃ¡ng trÆ°á»›c', changeTone: 'up', color: 'emerald' },
    { title: 'Tá»•ng Ä‘Æ¡n hÃ ng', value: '15.234', change: '+8.3% so vá»›i thÃ¡ng trÆ°á»›c', changeTone: 'up', color: 'blue' },
    { title: 'NgÆ°á»i dÃ¹ng má»›i', value: '342', change: '+15.2% so vá»›i thÃ¡ng trÆ°á»›c', changeTone: 'up', color: 'violet' },
    { title: 'Tá»· lá»‡ tranh cháº¥p', value: '2.3%', change: '-0.5% so vá»›i thÃ¡ng trÆ°á»›c', changeTone: 'down', color: 'amber' },
  ],
  '3m': [
    { title: 'Tá»•ng GMV', value: '1.2 nghÃ¬n tá»·', change: '+10.3% so vá»›i quÃ½ trÆ°á»›c', changeTone: 'up', color: 'emerald' },
    { title: 'Tá»•ng Ä‘Æ¡n hÃ ng', value: '43.780', change: '+7.4% so vá»›i quÃ½ trÆ°á»›c', changeTone: 'up', color: 'blue' },
    { title: 'NgÆ°á»i dÃ¹ng má»›i', value: '901', change: '+13.1% so vá»›i quÃ½ trÆ°á»›c', changeTone: 'up', color: 'violet' },
    { title: 'Tá»· lá»‡ tranh cháº¥p', value: '2.1%', change: '-0.3% so vá»›i quÃ½ trÆ°á»›c', changeTone: 'down', color: 'amber' },
  ],
  '12m': [
    { title: 'Tá»•ng GMV', value: '4.8 nghÃ¬n tá»·', change: '+18.8% so vá»›i nÄƒm trÆ°á»›c', changeTone: 'up', color: 'emerald' },
    { title: 'Tá»•ng Ä‘Æ¡n hÃ ng', value: '173.400', change: '+12.7% so vá»›i nÄƒm trÆ°á»›c', changeTone: 'up', color: 'blue' },
    { title: 'NgÆ°á»i dÃ¹ng má»›i', value: '3.954', change: '+16.9% so vá»›i nÄƒm trÆ°á»›c', changeTone: 'up', color: 'violet' },
    { title: 'Tá»· lá»‡ tranh cháº¥p', value: '1.9%', change: '-0.6% so vá»›i nÄƒm trÆ°á»›c', changeTone: 'down', color: 'amber' },
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
    { label: 'Tuáº§n 1', value: 88 },
    { label: 'Tuáº§n 2', value: 104 },
    { label: 'Tuáº§n 3', value: 112 },
    { label: 'Tuáº§n 4', value: 126 },
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
  { title: 'NgÆ°á»i dÃ¹ng má»›i Ä‘Äƒng kÃ½', description: 'Há»£p tÃ¡c xÃ£ NÃ´ng sáº£n ÄÃ  Láº¡t', time: '5 phÃºt trÆ°á»›c', color: 'emerald' },
  { title: 'LÃ´ hÃ ng má»›i chá» duyá»‡t', description: 'TÃ´m sÃº size 20 - 5.000 kg', time: '15 phÃºt trÆ°á»›c', color: 'blue' },
  { title: 'Tranh cháº¥p má»›i', description: 'ORD-2024-001234 - Cháº¥t lÆ°á»£ng khÃ´ng Ä‘Ãºng', time: '1 giá» trÆ°á»›c', color: 'red' },
  { title: 'ÄÆ¡n hÃ ng lá»›n', description: 'Chuá»—i siÃªu thá»‹ VinMart - 125 triá»‡u Ä‘', time: '2 giá» trÆ°á»›c', color: 'violet' },
]

const adminQuickStats: AdminQuickStat[] = [
  { label: 'NhÃ  cung cáº¥p', subLabel: 'Äang hoáº¡t Ä‘á»™ng', value: '2,543', color: 'emerald' },
  { label: 'NhÃ  buÃ´n', subLabel: 'Äang hoáº¡t Ä‘á»™ng', value: '5,821', color: 'blue' },
  { label: 'LÃ´ hÃ ng', subLabel: 'Äang bÃ¡n', value: '8,456', color: 'violet' },
  { label: 'Chá» xá»­ lÃ½', subLabel: 'Cáº§n chÃº Ã½', value: '23', color: 'amber' },
]

const riskByFilter: Record<AdminTimeFilter, AdminOverviewPayload['risks']> = {
  '7d': [
    { key: 'outstandingDebt', label: 'Tá»•ng cÃ´ng ná»£ chÆ°a thanh toÃ¡n', value: '126 tá»·', hint: 'TÄƒng 4.6% trong 7 ngÃ y gáº§n nháº¥t', critical: true },
    { key: 'overdueInvoices', label: 'Sá»‘ invoice quÃ¡ háº¡n', value: '38', hint: '9 invoice má»›i quÃ¡ háº¡n trong tuáº§n', critical: true },
    { key: 'openDisputes', label: 'Sá»‘ tranh cháº¥p Ä‘ang má»Ÿ', value: '14', hint: '2 vá»¥ viá»‡c má»©c Ä‘á»™ cao', critical: true },
  ],
  '30d': [
    { key: 'outstandingDebt', label: 'Tá»•ng cÃ´ng ná»£ chÆ°a thanh toÃ¡n', value: '512 tá»·', hint: 'ÄÃ£ giáº£m nháº¹ so vá»›i thÃ¡ng trÆ°á»›c', critical: true },
    { key: 'overdueInvoices', label: 'Sá»‘ invoice quÃ¡ háº¡n', value: '129', hint: 'Táº­p trung á»Ÿ nhÃ³m buyer má»›i', critical: true },
    { key: 'openDisputes', label: 'Sá»‘ tranh cháº¥p Ä‘ang má»Ÿ', value: '23', hint: '17 vá»¥ Ä‘Ã£ cÃ³ lá»‹ch xá»­ lÃ½', critical: true },
  ],
  '3m': [
    { key: 'outstandingDebt', label: 'Tá»•ng cÃ´ng ná»£ chÆ°a thanh toÃ¡n', value: '1.4 nghÃ¬n tá»·', hint: 'Rá»§i ro trung bÃ¬nh, cáº§n theo dÃµi', critical: true },
    { key: 'overdueInvoices', label: 'Sá»‘ invoice quÃ¡ háº¡n', value: '322', hint: 'Äá»‰nh rá»§i ro rÆ¡i vÃ o cuá»‘i quÃ½', critical: true },
    { key: 'openDisputes', label: 'Sá»‘ tranh cháº¥p Ä‘ang má»Ÿ', value: '61', hint: 'ÄÃ£ Ä‘Ã³ng 80% tranh cháº¥p cÅ©', critical: false },
  ],
  '12m': [
    { key: 'outstandingDebt', label: 'Tá»•ng cÃ´ng ná»£ chÆ°a thanh toÃ¡n', value: '5.2 nghÃ¬n tá»·', hint: 'Cáº§n tÃ¡i Ä‘Ã¡nh giÃ¡ credit limit', critical: true },
    { key: 'overdueInvoices', label: 'Sá»‘ invoice quÃ¡ háº¡n', value: '1.041', hint: 'Tá»· trá»ng quÃ¡ háº¡n > 60 ngÃ y Ä‘ang tÄƒng', critical: true },
    { key: 'openDisputes', label: 'Sá»‘ tranh cháº¥p Ä‘ang má»Ÿ', value: '186', hint: 'Má»©c Ä‘á»™ cao chiáº¿m 14%', critical: true },
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
    statusLabel: 'Äang Ä‘iá»u tra',
    severity: 'HIGH',
    severityLabel: 'Cao',
    title: 'Cháº¥t lÆ°á»£ng khÃ´ng Ä‘Ãºng cam káº¿t',
    description: 'LÃ´ hÃ ng nháº­n Ä‘Æ°á»£c cÃ³ 15% tÃ´m khÃ´ng Ä‘áº¡t size 20 nhÆ° Ä‘Ã£ Ä‘áº·t, nhiá»u con bá»‹ vá»¡ Ä‘áº§u',
    resolution: null,
    buyerName: 'Chuá»—i siÃªu thá»‹ VinMart',
    supplierName: 'CÃ´ng ty TNHH Thá»§y sáº£n Minh PhÃº',
    product: 'TÃ´m sÃº size 20',
    amount: '45.000.000 Ä‘',
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
    statusLabel: 'ÄÃ£ giáº£i quyáº¿t',
    severity: 'MEDIUM',
    severityLabel: 'Trung bÃ¬nh',
    title: 'Giao hÃ ng cháº­m trá»…',
    description: 'ÄÆ¡n hÃ ng giao cháº­m 3 ngÃ y so vá»›i cam káº¿t, gÃ¢y áº£nh hÆ°á»Ÿng Ä‘áº¿n káº¿ hoáº¡ch kinh doanh',
    resolution: 'ÄÃ£ hoÃ n tiá»n má»™t pháº§n cho bÃªn mua.',
    buyerName: 'CÃ´ng ty CP Thá»±c pháº©m SÃ i GÃ²n',
    supplierName: 'Há»£p tÃ¡c xÃ£ NÃ´ng sáº£n ÄÃ  Láº¡t',
    product: 'Thanh long ruá»™t Ä‘á»',
    amount: '12.000.000 Ä‘',
    createdByName: 'Admin 1',
    assignedToName: 'Admin 2',
    createdAt: '2024-03-15',
    resolvedAt: '2024-03-18',
  },
]

export const adminRegistrationProfiles: AdminRegistrationProfile[] = []
