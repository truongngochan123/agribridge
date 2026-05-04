import { ProfileContent } from '../../components/profile/ProfileContent'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useCurrentUserProfile } from '../../hooks/useCurrentUserProfile'
import { usePageTitle } from '../../hooks/usePageTitle'
import { clearCurrentUserProfileCache } from '../../services/currentUserService'
import {
  addCertificate,
  addFarmImage,
  deleteCompanyLogo,
  deleteCompanyMedia,
  fetchCompanyProfileAssets,
  type CompanyProfileAssets,
  saveCompanyLogo,
  updateLegalProfile,
  updatePersonalProfile,
} from '../../services/supplierProfileService'
import { resolveUploadedFileUrl, uploadRegistrationFile, uploadSupplierDocument } from '../../services/uploadService'

type SupplierProfileTab = 'personal' | 'business' | 'security' | 'notifications'

const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024
const MAX_CERTIFICATE_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024

export function SupplierProfilePage() {
  usePageTitle('Hồ sơ nhà cung cấp')
  return (
    <SupplierShell activeKey="overview" title="Thông tin cá nhân" subtitle="Quản lý hồ sơ, thông tin doanh nghiệp, hình ảnh và bảo mật">
      <ProfileContent shellType="supplier" />
    </SupplierShell>
  )
}
