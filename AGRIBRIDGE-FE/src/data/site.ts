import type { FaqItem, LeadershipMember, SupplierCard, SupplierMetric, SupplierProduct } from '../types/site'

export const trustedSuppliers: SupplierCard[] = [
  {
    id: 'mien-tay-seafood',
    name: 'Công ty TNHH Thủy sản Miền Tây',
    location: 'Cà Mau',
    category: 'Thủy sản',
    description: 'Chuyên cung cấp tôm sú, tôm thẻ chân trắng chất lượng cao từ vùng nuôi Cà Mau.',
    rating: 4.8,
    productsCount: 45,
    certifications: ['ASC', 'GlobalGAP', 'HACCP'],
    logoText: 'MT',
  },
  {
    id: 'an-giang-fish',
    name: 'HTX Nuôi trồng Thủy sản An Giang',
    location: 'An Giang',
    category: 'Thủy sản',
    description: 'Hợp tác xã nuôi cá tra, cá basa quy mô lớn. Sản phẩm xuất khẩu đạt tiêu chuẩn quốc tế.',
    rating: 4.6,
    productsCount: 32,
    certifications: ['GlobalGAP', 'BAP', 'ISO 22000'],
    logoText: 'AG',
  },
  {
    id: 'soc-trang-rice',
    name: 'Hợp tác xã Nông nghiệp Sóc Trăng',
    location: 'Sóc Trăng',
    category: 'Ngũ cốc',
    description: 'Chuyên canh tác lúa ST25, lúa Jasmine chất lượng cao. Đạt chứng nhận VietGAP.',
    rating: 4.9,
    productsCount: 28,
    certifications: ['VietGAP', 'Organic', 'ISO 9001'],
    logoText: 'R',
  },
  {
    id: 'binh-thuan-fruit',
    name: 'Trang trại Trái cây Bình Thuận',
    location: 'Bình Thuận',
    category: 'Trái cây',
    description: 'Trang trại thanh long ruột đỏ, thanh long ruột trắng quy mô 50ha. Xuất khẩu sang Trung Quốc, Nhật Bản.',
    rating: 4.7,
    productsCount: 18,
    certifications: ['VietGAP', 'GlobalGAP'],
    logoText: 'BT',
  },
  {
    id: 'dalat-organic',
    name: 'Nông trại Organic Đà Lạt',
    location: 'Lâm Đồng',
    category: 'Rau củ',
    description: 'Nông trại rau củ hữu cơ theo tiêu chuẩn châu Âu. Không sử dụng hóa chất, thuốc trừ sâu.',
    rating: 4.8,
    productsCount: 55,
    certifications: ['EU Organic', 'USDA Organic', 'VietGAP'],
    logoText: 'DL',
  },
  {
    id: 'tien-giang-mango',
    name: 'HTX Trái cây Tiền Giang',
    location: 'Tiền Giang',
    category: 'Trái cây',
    description: 'Chuyên cung cấp xoài cát Hòa Lộc, xoài Úc chất lượng xuất khẩu. Vùng trồng đạt chứng nhận VietGAP.',
    rating: 4.9,
    productsCount: 42,
    certifications: ['VietGAP', 'GlobalGAP', 'ISO 9001'],
    logoText: 'TG',
  },
]

export const supplierMetrics: SupplierMetric[] = [
  { label: 'Tỷ lệ phản hồi', value: '95%', subLabel: 'Trung bình 2 giờ' },
  { label: 'Giao đúng hẹn', value: '92%', subLabel: 'Thời gian giao 1-2 ngày' },
  { label: 'Điểm chất lượng', value: '4.7/5', subLabel: 'Nhiều năm ổn định' },
  { label: 'Khách quay lại', value: '78%', subLabel: 'Tổng đơn: 567' },
]

export const supplierProducts: SupplierProduct[] = [
  {
    id: 'tom-su-huu-co',
    name: 'Tôm sú hữu cơ',
    lotId: 'LS-52401115',
    spec: 'Size 16-20 con/kg',
    inventory: '2.500 kg',
    price: '385,000đ',
    certifications: ['ASC', 'VietGAP'],
  },
  {
    id: 'tom-the-chan-trang',
    name: 'Tôm thẻ chân trắng',
    lotId: 'LS-52401220',
    spec: 'Size 40-50 con/kg',
    inventory: '1.800 kg',
    price: '245,000đ',
    certifications: ['BAP', 'VietGAP'],
  },
]

export const supportFaqs: FaqItem[] = [
  { id: 'faq-1', question: 'AgriBridge là gì?' },
  { id: 'faq-2', question: 'Làm thế nào để đăng ký tài khoản?' },
  { id: 'faq-3', question: 'Chi phí sử dụng nền tảng như thế nào?' },
  { id: 'faq-4', question: 'Làm thế nào để gửi yêu cầu báo giá (RFQ)?' },
  { id: 'faq-5', question: 'Hệ thống quản lý công nợ hoạt động như thế nào?' },
  { id: 'faq-6', question: 'Tôi có thể theo dõi vận chuyển như thế nào?' },
  { id: 'faq-7', question: 'Làm thế nào để đánh giá chất lượng sản phẩm?' },
  { id: 'faq-8', question: 'Tôi cần hỗ trợ, liên hệ ai?' },
]

export const aboutLeadership: LeadershipMember[] = [
  { id: 'ld-1', name: 'Nguyễn Văn An', role: 'CEO & Founder', image: '/images/avatar-1.jpg' },
  { id: 'ld-2', name: 'Trần Thị Bình', role: 'CTO', image: '/images/avatar-2.jpg' },
  { id: 'ld-3', name: 'Lê Minh Cường', role: 'Head of Operations', image: '/images/avatar-3.jpg' },
  { id: 'ld-4', name: 'Phạm Thu Hà', role: 'Head of Sales', image: '/images/avatar-2.jpg' },
]
