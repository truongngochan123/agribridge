import { ProfileContent } from '../../components/profile/ProfileContent'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { usePageTitle } from '../../hooks/usePageTitle'

export function SupplierProfilePage() {
  usePageTitle('Hồ sơ nhà cung cấp')
  return (
    <SupplierShell activeKey="overview" title="Thông tin cá nhân" subtitle="Quản lý hồ sơ, thông tin doanh nghiệp, hình ảnh và bảo mật">
      <ProfileContent shellType="supplier" />
    </SupplierShell>
  )
}
