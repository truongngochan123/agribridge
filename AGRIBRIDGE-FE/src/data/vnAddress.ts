export type AddressOption = {
  province: string
  districts: string[]
}

export const VN_ADDRESS_OPTIONS: AddressOption[] = [
  {
    province: 'TP. Ho Chi Minh',
    districts: ['Quan 1', 'Quan 3', 'Quan 7', 'Thu Duc', 'Binh Thanh'],
  },
  {
    province: 'Ha Noi',
    districts: ['Ba Dinh', 'Dong Da', 'Cau Giay', 'Nam Tu Liem', 'Ha Dong'],
  },
  {
    province: 'Da Nang',
    districts: ['Hai Chau', 'Thanh Khe', 'Son Tra', 'Ngu Hanh Son', 'Lien Chieu'],
  },
  {
    province: 'Can Tho',
    districts: ['Ninh Kieu', 'Binh Thuy', 'Cai Rang', 'O Mon', 'Thot Not'],
  },
]
