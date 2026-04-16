import type { CtaSummary, HeroStats } from '../types/home'

export const fallbackStats: HeroStats = {
  supplierCount: '2,500+',
  buyerCount: '8,000+',
  transactionValue: '50 tỷ',
  rfqCount: '15,000+',
}

export const fallbackCtaSummary: CtaSummary = {
  supplier: {
    title: 'Mở rộng Thị trường Ngay hôm nay',
    subtitle:
      'Kết nối với thương lái, đại lý và chuỗi cửa hàng trên toàn quốc. Tăng doanh thu và mở rộng thị trường đầu ra.',
    ctaText: 'Đăng ký Miễn phí',
    stats: ['2,500+ Nhà cung cấp', '50 tỷ Giao dịch', '15K+ Cơ hội bán hàng'],
  },
  buyer: {
    title: 'Tìm nguồn hàng Chất lượng Giá tốt nhất',
    subtitle:
      'Thu mua đa dạng nguồn hàng theo lô, so sánh giá nhanh và chốt đơn với nhà cung cấp uy tín.',
    ctaText: 'Bắt đầu Mua hàng',
    stats: ['8,000+ Nhà buôn', '100% Minh bạch lô', '24/7 Hỗ trợ'],
  },
}
