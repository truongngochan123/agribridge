export type NotificationItem = {
  id: string
  title: string
  description: string
  time: string
  color: 'blue' | 'green' | 'amber' | 'teal'
}

export const notificationItems: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Đơn hàng ORD-2024-101 đang được giao',
    description: 'Tài xế Nguyễn Văn C đang trên đường giao hàng đến Chi nhánh Cầu Giấy',
    time: '5 phút trước',
    color: 'blue',
  },
  {
    id: 'n2',
    title: 'Nhận được 3 báo giá mới',
    description: 'RFQ-2024-025 đã nhận thêm 3 báo giá từ các nhà cung cấp',
    time: '1 giờ trước',
    color: 'green',
  },
  {
    id: 'n3',
    title: 'Hóa đơn sắp đến hạn',
    description: 'Hóa đơn INV-2024-089 cần thanh toán trước ngày 18/01/2024',
    time: '2 giờ trước',
    color: 'amber',
  },
  {
    id: 'n4',
    title: 'Giá Tôm Sú tăng 5.2%',
    description: 'Giá tham khảo thị trường cho Tôm Sú Size 1 đã tăng',
    time: '5 giờ trước',
    color: 'teal',
  },
  {
    id: 'n5',
    title: 'RFQ sắp hết hạn',
    description: 'RFQ-2024-027 sẽ hết hạn trong 2 ngày nữa',
    time: '1 ngày trước',
    color: 'amber',
  },
]

export const notificationTotalCount = notificationItems.length
export const notificationUnreadCount = 3
