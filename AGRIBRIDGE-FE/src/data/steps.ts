import type { StepItem } from '../types/home'

export const fallbackSteps: StepItem[] = [
  {
    stepNumber: '01',
    title: 'Tạo RFQ',
    description: 'Đăng nhu cầu thu mua theo lô, quy cách, số lượng và khu vực giao nhận.',
    icon: 'FileText',
  },
  {
    stepNumber: '02',
    title: 'Nhận báo giá',
    description: 'Nhận nhiều báo giá từ nhà cung cấp và so sánh theo giá, chất lượng, tiến độ.',
    icon: 'MessagesSquare',
  },
  {
    stepNumber: '03',
    title: 'Đặt hàng sỉ',
    description: 'Xác nhận lô hàng phù hợp, chốt đơn và thống nhất điều khoản giao dịch.',
    icon: 'ShoppingCart',
  },
  {
    stepNumber: '04',
    title: 'Theo dõi vận chuyển',
    description: 'Theo dõi trạng thái giao hàng theo chặng và xử lý sự cố kịp thời.',
    icon: 'MapPinned',
  },
  {
    stepNumber: '05',
    title: 'Quản lý thanh toán',
    description: 'Theo dõi công nợ, hạn thanh toán và đối soát theo từng nhà cung cấp.',
    icon: 'ReceiptText',
  },
]
