import { ProfileContent } from '../../components/profile/ProfileContent'
import { SupplierShell } from '../../components/supplier/SupplierShell'

export function SupplierProfilePage() {
  return (
    <SupplierShell activeKey="overview" title="Thông tin cá nhân" subtitle="Quản lý hồ sơ, thông tin doanh nghiệp, hình ảnh và bảo mật">
      <ProfileContent shellType="supplier" />
    </SupplierShell>
  )
}
