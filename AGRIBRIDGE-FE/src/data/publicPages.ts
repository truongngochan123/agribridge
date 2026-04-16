import type {
  AboutStat,
  AboutValueItem,
  FaqItem,
  LeadershipItem,
  SupplierBusinessInfo,
  SupplierCapability,
  SupplierDirectoryItem,
  SupplierMetric,
  SupplierOfferItem,
} from '../types/publicPages'

export const supplierDirectoryItems: SupplierDirectoryItem[] = [
  {
    id: 'mien-tay-seafood',
    name: 'Công ty TNHH Thủy sản Miền Tây',
    logoText: 'MARINE',
    location: 'Cà Mau',
    category: 'Thủy sản',
    description: 'Chuyên cung cấp tôm sú, tôm thẻ chân trắng chất lượng cao từ vùng nuôi Cà Mau.',
    rating: 4.8,
    productCount: 45,
    certifications: ['ASC', 'GlobalGAP', 'HACCP'],
  },
  {
    id: 'an-giang-aqua',
    name: 'HTX Nuôi trồng Thủy sản An Giang',
    logoText: 'Blue Farm',
    location: 'An Giang',
    category: 'Thủy sản',
    description: 'Hợp tác xã nuôi cá tra, cá basa quy mô lớn. Sản phẩm đạt tiêu chuẩn xuất khẩu.',
    rating: 4.6,
    productCount: 32,
    certifications: ['GlobalGAP', 'BAP', 'ISO 22000'],
  },
  {
    id: 'soc-trang-rice',
    name: 'Hợp tác xã Nông nghiệp Sóc Trăng',
    logoText: 'Rice',
    location: 'Sóc Trăng',
    category: 'Ngũ cốc',
    description: 'Chuyên canh lúa ST25, lúa Jasmine chất lượng cao. Đạt chứng nhận VietGAP, hữu cơ.',
    rating: 4.9,
    productCount: 28,
    certifications: ['VietGAP', 'Organic', 'ISO 9001'],
  },
  {
    id: 'binh-thuan-fruit',
    name: 'Trang trại Trái cây Bình Thuận',
    logoText: 'Fruit Farm',
    location: 'Bình Thuận',
    category: 'Trái cây',
    description: 'Trang trại thanh long ruột đỏ, thanh long ruột trắng quy mô 50ha. Xuất khẩu.',
    rating: 4.7,
    productCount: 18,
    certifications: ['VietGAP', 'GlobalGAP'],
  },
  {
    id: 'organic-da-lat',
    name: 'Nông trại Organic Đà Lạt',
    logoText: 'Organic',
    location: 'Lâm Đồng',
    category: 'Rau củ',
    description: 'Nông trại rau củ hữu cơ theo tiêu chuẩn châu Âu. Không sử dụng hóa chất.',
    rating: 4.8,
    productCount: 65,
    certifications: ['EU Organic', 'USDA Organic', 'VietGAP'],
  },
  {
    id: 'tien-giang-fruit',
    name: 'HTX Trái cây Tiền Giang',
    logoText: 'Mango',
    location: 'Tiền Giang',
    category: 'Trái cây',
    description: 'Chuyên cung cấp xoài cát Hòa Lộc, xoài Úc chất lượng xuất khẩu. Vùng trồng đạt chuẩn.',
    rating: 4.9,
    productCount: 42,
    certifications: ['VietGAP', 'GlobalGAP', 'ISO 9001'],
  },
]

export const supplierMetrics: SupplierMetric[] = [
  { label: 'Tỷ lệ phản hồi', value: '95%', hint: 'Trung bình: 2 giờ' },
  { label: 'Giao đúng hẹn', value: '92%', hint: 'Thời gian giao: 1-2 ngày' },
  { label: 'Điểm chất lượng', value: '4.7/5', hint: 'Khảo sát: 1' },
  { label: 'Khách quay lại', value: '78%', hint: 'Tổng đơn: 567' },
]

export const supplierCapability: SupplierCapability = {
  seafood: 'Tôm sú | Tôm thẻ chân trắng | Tôm càng xanh',
  output: '20-30 tấn/tháng',
  moq: '500 kg',
  port: 'Mỹ Thới | TP.HCM | Miền Trung',
  readyTime: 'Quanh năm',
  logistics: 'Container lạnh | Giao nhanh | Kho lạnh',
}

export const supplierBusinessInfo: SupplierBusinessInfo = {
  legalName: 'Công ty TNHH Thủy sản Miền Tây',
  model: 'Nông trại nuôi trồng',
  address: '123 Đường Nguyễn Văn Linh, TP. Cà Mau, Tỉnh Cà Mau',
  phone: '+84 290 3831 234',
  email: 'contact@thuysanvientay.vn',
  website: 'www.thuysanvientay.vn',
}

export const supplierOfferItems: SupplierOfferItem[] = [
  {
    id: 'sp-1',
    name: 'Tôm sú hữu cơ',
    lot: 'LS240115',
    grade: 'A+',
    size: '16-20 con/kg',
    stock: '2500 kg',
    status: 'Sẵn hàng',
    price: '385.000đ',
    total: 'Còn: 2.500 kg',
    certs: ['ASC', 'VietGAP', 'GlobalGAP', 'Xuất khẩu'],
  },
  {
    id: 'sp-2',
    name: 'Tôm thẻ chân trắng',
    lot: 'LS240120',
    grade: 'A',
    size: '40-50 con/kg',
    stock: '1800 kg',
    status: 'Sẵn hàng',
    price: '245.000đ',
    total: 'Còn: 1.800 kg',
    certs: ['VietGAP', 'GlobalGAP', 'Duy trì lạnh'],
  },
]

export const supportFaqItems: FaqItem[] = [
  { id: 'f1', question: 'AgriBridge là gì?' },
  { id: 'f2', question: 'Làm thế nào để đăng ký tài khoản?' },
  { id: 'f3', question: 'Chi phí sử dụng nền tảng như thế nào?' },
  { id: 'f4', question: 'Làm thế nào để gửi yêu cầu báo giá (RFQ)?' },
  { id: 'f5', question: 'Hệ thống quản lý công nợ hoạt động như thế nào?' },
  { id: 'f6', question: 'Tôi có thể theo dõi vận chuyển như thế nào?' },
  { id: 'f7', question: 'Làm thế nào để đánh giá chất lượng sản phẩm?' },
  { id: 'f8', question: 'Tôi cần hỗ trợ, liên hệ ai?' },
]

export const aboutStats: AboutStat[] = [
  { value: '2,500+', label: 'Nhà cung cấp' },
  { value: '5,800+', label: 'Nhà buôn' },
  { value: '15,000+', label: 'Giao dịch/tháng' },
  { value: '450 tỷ', label: 'GMV' },
]

export const aboutValues: AboutValueItem[] = [
  {
    title: 'Minh bạch',
    description: 'Mọi giao dịch đều được ghi nhận rõ ràng, công khai, đảm bảo quyền lợi cho cả hai bên.',
  },
  {
    title: 'Tin cậy',
    description: 'Xác minh nghiêm ngặt nhà cung cấp, đảm bảo chất lượng sản phẩm và uy tín giao dịch.',
  },
  {
    title: 'Hiệu quả',
    description: 'Tối ưu hóa quy trình từ tìm kiếm, đặt hàng đến thanh toán và vận chuyển.',
  },
  {
    title: 'Hỗ trợ tận tâm',
    description: 'Đội ngũ chăm sóc khách hàng chuyên nghiệp, sẵn sàng hỗ trợ 24/7.',
  },
]

export const aboutLeadership: LeadershipItem[] = [
  { name: 'Nguyễn Văn An', role: 'CEO & Founder', image: '/images/avatar-1.jpg' },
  { name: 'Trần Thị Bình', role: 'CTO', image: '/images/avatar-2.jpg' },
  { name: 'Lê Minh Cường', role: 'Head of Operations', image: '/images/avatar-3.jpg' },
  { name: 'Phạm Thu Hà', role: 'Head of Sales', image: '/images/avatar-1.jpg' },
]
