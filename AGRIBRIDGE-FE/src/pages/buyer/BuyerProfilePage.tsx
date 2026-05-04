import { BuyerShell } from '../../components/buyer/BuyerShell'
import { usePageTitle } from '../../hooks/usePageTitle'
import { ProfileContent } from '../../components/profile/ProfileContent'

export function BuyerProfilePage() {
  usePageTitle('Thông tin cá nhân')
  return (
    <BuyerShell activeKey="overview" title="Thông tin cá nhân" subtitle="Quản lý thông tin tài khoản và cài đặt bảo mật">
      <ProfileContent shellType="buyer" />
    </BuyerShell>
  )
}
