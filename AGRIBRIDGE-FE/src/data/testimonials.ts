import type { Testimonial } from '../types/home'

export const fallbackTestimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Nguyễn Văn Hải',
    role: 'Thu mua trưởng',
    company: 'Chuỗi nhà hàng Biển Sóng',
    avatar: '/images/avatar-1.jpg',
    rating: 5,
    comment:
      'AgriBridge giúp chúng tôi tìm nguồn tôm và cá ổn định hơn, đối chiếu báo giá nhanh và minh bạch theo từng lô.',
  },
  {
    id: 2,
    name: 'Trần Thị Lan',
    role: 'Giám đốc vận hành',
    company: 'Hệ thống chợ đầu mối Mekong',
    avatar: '/images/avatar-2.jpg',
    rating: 5,
    comment:
      'Phân hệ công nợ rất rõ ràng, dễ theo dõi giao hàng theo chặng, giảm rõ rệt tình trạng giao chậm.',
  },
  {
    id: 3,
    name: 'Lê Minh Tuấn',
    role: 'Chủ vườn và đại lý',
    company: 'Nông trại Thành Phú',
    avatar: '/images/avatar-3.jpg',
    rating: 5,
    comment:
      'Nhờ RFQ mà có thêm nhiều đơn sỉ, giá bán theo mùa vụ được cập nhật nhanh và dễ ra quyết định hơn.',
  },
]
