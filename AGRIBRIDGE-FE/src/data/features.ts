import type { FeatureItem } from '../types/home'

export const fallbackFeatures: FeatureItem[] = [
  {
    id: 1,
    icon: 'FileSearch',
    title: 'Tạo RFQ & Báo giá thông minh',
    description:
      'Tạo yêu cầu báo giá nhanh cho từng lô hàng, nhận phản hồi từ nhiều nhà cung cấp trong một quy trình.',
  },
  {
    id: 2,
    icon: 'Wallet',
    title: 'Quản lý công nợ B2B',
    description:
      'Theo dõi hạn thanh toán, đối soát đơn hàng và cảnh báo công nợ cho từng đối tác mua sỉ.',
  },
  {
    id: 3,
    icon: 'Store',
    title: 'Quản lý nhiều chi nhánh',
    description:
      'Đồng bộ tồn kho, giá bán và trạng thái giao dịch giữa hệ thống chi nhánh và kho trung tâm.',
  },
  {
    id: 4,
    icon: 'Truck',
    title: 'Theo dõi vận chuyển realtime',
    description:
      'Cập nhật hành trình giao hàng và mốc giao nhận theo thời gian thực để giảm trễ hẹn.',
  },
]
