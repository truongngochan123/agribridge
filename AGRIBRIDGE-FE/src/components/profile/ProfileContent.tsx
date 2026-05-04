import {
  Bell,
  Building2,
  Camera,
  Eye,
  Lock,
  Pencil,
  Save,
  Shield,
  Trash2,
  UploadCloud,
  User,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCurrentUserProfile } from '../../hooks/useCurrentUserProfile'
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
type ProfileShellType = 'supplier' | 'buyer'

const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024
const MAX_CERTIFICATE_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024

export function ProfileContent({ shellType }: { shellType: ProfileShellType }) {
  const [tab, setTab] = useState<SupplierProfileTab>('personal')
  const { profile, loading, reloadProfile } = useCurrentUserProfile()
  const [assets, setAssets] = useState<CompanyProfileAssets>({ farmImages: [], certificates: [] })
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [personalEditing, setPersonalEditing] = useState(false)
  const [businessEditing, setBusinessEditing] = useState(false)

  const [fullNameInput, setFullNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')

  const [companyNameInput, setCompanyNameInput] = useState('')
  const [taxCodeInput, setTaxCodeInput] = useState('')
  const [registrationNumberInput, setRegistrationNumberInput] = useState('')
  const [establishedYearInput, setEstablishedYearInput] = useState('')
  const [websiteInput, setWebsiteInput] = useState('')
  const [provinceInput, setProvinceInput] = useState('')
  const [districtInput, setDistrictInput] = useState('')
  const [addressInput, setAddressInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')
  const [pendingCertificateFile, setPendingCertificateFile] = useState<File | null>(null)
  const [certificateNameInput, setCertificateNameInput] = useState('')

  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const farmImageInputRef = useRef<HTMLInputElement | null>(null)
  const certificateInputRef = useRef<HTMLInputElement | null>(null)

  const isSupplier = shellType === 'supplier' || profile?.companyType === 'SUPPLIER'
  const isBuyer = shellType === 'buyer' || profile?.companyType === 'BUYER'

  useEffect(() => {
    if (!profile) {
      return
    }

    setFullNameInput(profile.fullName)
    setEmailInput(profile.email === 'N/A' ? '' : profile.email)
    setPhoneInput(profile.phone === 'N/A' ? '' : profile.phone)

    setCompanyNameInput(profile.companyName === 'N/A' ? '' : profile.companyName)
    setTaxCodeInput(profile.taxCode === 'N/A' ? '' : profile.taxCode)
    setRegistrationNumberInput(profile.registrationNumber === 'N/A' ? '' : profile.registrationNumber)
    setEstablishedYearInput(profile.establishedYear === 'N/A' ? '' : profile.establishedYear)
    setWebsiteInput(profile.website === 'N/A' ? '' : profile.website)
    setProvinceInput(profile.province === 'N/A' ? '' : profile.province)
    setDistrictInput(profile.district === 'N/A' ? '' : profile.district)
    setAddressInput(profile.address === 'N/A' ? '' : profile.address)
    setDescriptionInput(profile.description === 'N/A' ? '' : profile.description)
  }, [profile])

  useEffect(() => {
    if (!profile?.companyId) {
      return
    }

    let active = true
    const loadAssets = async () => {
      try {
        setAssetsLoading(true)
        setErrorMessage('')
        const value = await fetchCompanyProfileAssets(profile.companyId as number)
        if (active) {
          setAssets(value)
        }
      } catch (error) {
        if (active) {
          setAssets({ farmImages: [], certificates: [] })
          if (isSupplier) {
            setErrorMessage(readErrorMessage(error, 'Không tải được dữ liệu hồ sơ doanh nghiệp.'))
          }
        }
      } finally {
        if (active) {
          setAssetsLoading(false)
        }
      }
    }

    loadAssets()
    return () => {
      active = false
    }
  }, [isSupplier, profile?.companyId])

  const displayedLogoUrl = useMemo(() => resolveUploadedFileUrl(assets.logoUrl), [assets.logoUrl])

  const withCompanyId = profile?.companyId
  const withUserId = profile?.userId

  async function handleSavePersonal() {
    if (!withUserId) {
      return
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const phonePattern = /^(0|\+84|84)(\d{8,10})$/
    if (!fullNameInput.trim()) {
      setErrorMessage('Họ và tên không được để trống.')
      return
    }
    if (emailInput.trim() && !emailPattern.test(emailInput.trim())) {
      setErrorMessage('Email không đúng định dạng.')
      return
    }
    if (phoneInput.trim() && !phonePattern.test(phoneInput.trim().replace(/\s/g, ''))) {
      setErrorMessage('Số điện thoại không đúng định dạng Việt Nam.')
      return
    }
    setSubmitting(true)
    try {
      setErrorMessage('')
      await updatePersonalProfile(withUserId, {
        fullName: fullNameInput,
        phone: phoneInput,
        email: emailInput || undefined,
      })
      clearCurrentUserProfileCache()
      await reloadProfile()
      setPersonalEditing(false)
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Không lưu được thông tin cá nhân.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveBusiness() {
    if (!withCompanyId) {
      return
    }
    const websitePattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/i
    if (!companyNameInput.trim()) {
      setErrorMessage('Tên doanh nghiệp không được để trống.')
      return
    }
    if (establishedYearInput.trim() && !Number.isFinite(Number(establishedYearInput))) {
      setErrorMessage('Năm thành lập phải là số hợp lệ.')
      return
    }
    if (websiteInput.trim() && !websitePattern.test(websiteInput.trim())) {
      setErrorMessage('Website không đúng định dạng.')
      return
    }
    if (!provinceInput.trim() || !addressInput.trim()) {
      setErrorMessage('Tỉnh/thành phố và địa chỉ không được để trống.')
      return
    }
    setSubmitting(true)
    try {
      setErrorMessage('')
      await updateLegalProfile(withCompanyId, {
        name: companyNameInput,
        taxCode: taxCodeInput || undefined,
        registrationNumber: registrationNumberInput || undefined,
        establishedYear: establishedYearInput ? Number(establishedYearInput) : undefined,
        website: websiteInput || undefined,
        province: provinceInput,
        district: districtInput || undefined,
        address: addressInput,
        description: descriptionInput || undefined,
      })
      clearCurrentUserProfileCache()
      await reloadProfile()
      setBusinessEditing(false)
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Không lưu được thông tin pháp lý doanh nghiệp.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUploadLogo(file?: File) {
    if (!withCompanyId || !file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      return
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setErrorMessage('Kich thuoc tep vuot qua 2MB.')
      return
    }
    setSubmitting(true)
    try {
      setErrorMessage('')
      const uploaded = await uploadRegistrationFile(file)
      const next = await saveCompanyLogo(withCompanyId, uploaded.url, 'Logo công ty')
      setAssets(next)
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Không tải lên được logo công ty.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoveLogo() {
    if (!withCompanyId) {
      return
    }
    setSubmitting(true)
    try {
      setErrorMessage('')
      const next = await deleteCompanyLogo(withCompanyId)
      setAssets(next)
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Không xóa được logo công ty.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUploadFarmImage(file?: File) {
    if (!isSupplier || !withCompanyId || !file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      return
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setErrorMessage('Kích thước tệp vượt quá 2MB.')
      return
    }
    setSubmitting(true)
    try {
      setErrorMessage('')
      const uploaded = await uploadRegistrationFile(file)
      const next = await addFarmImage(withCompanyId, uploaded.url, file.name)
      setAssets(next)
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Không tải lên được hình ảnh cửa hàng/trang trại.'))
    } finally {
      setSubmitting(false)
    }
  }

  function handlePrepareCertificateUpload(file?: File) {
    if (!isSupplier || !withCompanyId || !file) {
      return
    }
    if (file.size > MAX_CERTIFICATE_UPLOAD_SIZE_BYTES) {
      setErrorMessage('Kích thước tệp vượt quá 10MB.')
      return
    }
    setErrorMessage('')
    setPendingCertificateFile(file)
    setCertificateNameInput(file.name.replace(/\.[^.]+$/, ''))
  }

  function handleCancelCertificateUpload() {
    setPendingCertificateFile(null)
    setCertificateNameInput('')
  }

  async function handleConfirmCertificateUpload() {
    if (!isSupplier || !withCompanyId || !pendingCertificateFile) {
      return
    }

    const label = certificateNameInput.trim() || pendingCertificateFile.name.replace(/\.[^.]+$/, '')

    setSubmitting(true)
    try {
      setErrorMessage('')
      const uploaded = await uploadSupplierDocument(pendingCertificateFile)
      const next = await addCertificate(withCompanyId, uploaded.url, label)
      setAssets(next)
      handleCancelCertificateUpload()
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Không tải lên được chứng chỉ.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteMedia(id: number) {
    if (!isSupplier || !withCompanyId) {
      return
    }
    setSubmitting(true)
    try {
      setErrorMessage('')
      const next = await deleteCompanyMedia(withCompanyId, id)
      setAssets(next)
    } catch (error) {
      setErrorMessage(readErrorMessage(error, 'Không xóa được tệp đã tải lên.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleUploadLogo(event.target.files?.[0])
          event.currentTarget.value = ''
        }}
      />
      {isSupplier ? (
        <>
          <input
            ref={farmImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleUploadFarmImage(event.target.files?.[0])
              event.currentTarget.value = ''
            }}
          />
          <input
            ref={certificateInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(event) => {
              handlePrepareCertificateUpload(event.target.files?.[0])
              event.currentTarget.value = ''
            }}
          />
        </>
      ) : null}

      {pendingCertificateFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Tên chứng chỉ</h3>
            <p className="mt-1 text-xs text-slate-500">Nhập tên hiển thị cho chứng chỉ trước khi tải lên.</p>
            <input
              className="mt-3 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-700"
              value={certificateNameInput}
              onChange={(event) => setCertificateNameInput(event.target.value)}
              placeholder="Ví dụ: VietGAP"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                onClick={handleCancelCertificateUpload}
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  void handleConfirmCertificateUpload()
                }}
                disabled={submitting}
              >
                {submitting ? 'Đang tải...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[170px_1fr]">
        <aside className="space-y-3">
          <div className="rounded-xl border border-emerald-100 bg-white p-2">
            <TabButton icon={User} label="Hồ sơ cá nhân" active={tab === 'personal'} onClick={() => setTab('personal')} />
            <TabButton icon={Building2} label={isBuyer ? 'Thông tin doanh nghiệp' : 'Doanh nghiệp & Trang trại'} active={tab === 'business'} onClick={() => setTab('business')} />
            <TabButton icon={Shield} label="Bảo mật" active={tab === 'security'} onClick={() => setTab('security')} />
            <TabButton icon={Bell} label="Thông báo" active={tab === 'notifications'} onClick={() => setTab('notifications')} />
          </div>

          <div className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 p-3 text-white">
            <p className="text-sm font-bold">{isBuyer ? (profile?.companyTypeLabel ?? 'Buyer') : 'Premium Supplier'}</p>
            <p className="text-xs text-emerald-100">Gói dịch vụ</p>
            {isSupplier ? (
              <>
                <div className="mt-3 space-y-1 text-xs">
                  <p className="flex justify-between"><span>Rating</span><span className="font-bold">4.9/5.0</span></p>
                  <p className="flex justify-between"><span>Đơn hàng</span><span className="font-bold">1,234</span></p>
                  <p className="flex justify-between"><span>Phản hồi RFQ</span><span className="font-bold">98%</span></p>
                  <p className="flex justify-between"><span>Chứng nhận</span><span className="font-bold">5 chứng chỉ</span></p>
                </div>
                <p className="mt-3 border-t border-emerald-400 pt-2 text-[11px]">Gia hạn đến: 10/01/2027</p>
              </>
            ) : (
              <p className="mt-3 border-t border-emerald-400 pt-2 text-[11px]">Chưa có dữ liệu gói dịch vụ</p>
            )}
          </div>
        </aside>

        <section className="space-y-4">
          {errorMessage ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          ) : null}
          {tab === 'personal' ? (
            <SupplierPersonalPanel
              profile={profile}
              loading={loading || submitting}
              personalEditing={personalEditing}
              onToggleEdit={() => setPersonalEditing((prev) => !prev)}
              onSave={handleSavePersonal}
              onCancel={() => setPersonalEditing(false)}
              fullNameInput={fullNameInput}
              setFullNameInput={setFullNameInput}
              emailInput={emailInput}
              setEmailInput={setEmailInput}
              phoneInput={phoneInput}
              setPhoneInput={setPhoneInput}
              logoUrl={displayedLogoUrl}
              onUploadLogo={() => logoInputRef.current?.click()}
              onRemoveLogo={() => {
                void handleRemoveLogo()
              }}
            />
          ) : null}
          {tab === 'business' ? (
            <SupplierBusinessPanel
              profile={profile}
              loading={loading || assetsLoading || submitting}
              businessEditing={businessEditing}
              onToggleEdit={() => setBusinessEditing((prev) => !prev)}
              onSave={handleSaveBusiness}
              onCancel={() => setBusinessEditing(false)}
              companyNameInput={companyNameInput}
              setCompanyNameInput={setCompanyNameInput}
              taxCodeInput={taxCodeInput}
              setTaxCodeInput={setTaxCodeInput}
              registrationNumberInput={registrationNumberInput}
              setRegistrationNumberInput={setRegistrationNumberInput}
              establishedYearInput={establishedYearInput}
              setEstablishedYearInput={setEstablishedYearInput}
              websiteInput={websiteInput}
              setWebsiteInput={setWebsiteInput}
              provinceInput={provinceInput}
              setProvinceInput={setProvinceInput}
              districtInput={districtInput}
              setDistrictInput={setDistrictInput}
              addressInput={addressInput}
              setAddressInput={setAddressInput}
              descriptionInput={descriptionInput}
              setDescriptionInput={setDescriptionInput}
              assets={assets}
              isSupplier={isSupplier}
              isBuyer={isBuyer}
              logoUrl={displayedLogoUrl}
              onUploadLogo={() => logoInputRef.current?.click()}
              onAddFarmImage={() => farmImageInputRef.current?.click()}
              onAddCertificate={() => certificateInputRef.current?.click()}
              onDeleteMedia={(id) => {
                void handleDeleteMedia(id)
              }}
            />
          ) : null}
          {tab === 'security' ? <SupplierSecurityPanel /> : null}
          {tab === 'notifications' ? <SupplierNotificationPanel /> : null}
        </section>
      </div>
    </>
  )
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) {
    return fallback
  }

  const candidate = error as {
    response?: {
      data?: {
        message?: string
      }
    }
    message?: string
  }

  return candidate.response?.data?.message ?? candidate.message ?? fallback
}

function SupplierPersonalPanel({
  profile,
  loading,
  personalEditing,
  onToggleEdit,
  onSave,
  onCancel,
  fullNameInput,
  setFullNameInput,
  emailInput,
  setEmailInput,
  phoneInput,
  setPhoneInput,
  logoUrl,
  onUploadLogo,
  onRemoveLogo,
}: {
  profile: ReturnType<typeof useCurrentUserProfile>['profile']
  loading: boolean
  personalEditing: boolean
  onToggleEdit: () => void
  onSave: () => void
  onCancel: () => void
  fullNameInput: string
  setFullNameInput: (value: string) => void
  emailInput: string
  setEmailInput: (value: string) => void
  phoneInput: string
  setPhoneInput: (value: string) => void
  logoUrl: string | null
  onUploadLogo: () => void
  onRemoveLogo: () => void
}) {
  const fullName = personalEditing ? fullNameInput : profile?.fullName ?? 'N/A'
  const email = personalEditing ? emailInput : profile?.email ?? 'N/A'
  const phone = personalEditing ? phoneInput : profile?.phone ?? 'N/A'
  const accountCode = profile?.accountCode ?? 'N/A'
  const companyTypeLabel = profile?.companyTypeLabel ?? 'N/A'
  const joinedAt = profile?.joinedAt ?? 'N/A'
  const statusLabel = profile?.statusLabel ?? 'N/A'
  const initials = profile?.initials ?? 'U'

  return (
    <>
      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        <h3 className="mb-2 text-lg font-bold">Ảnh đại diện</h3>
        <div className="flex items-center gap-3">
          <div className="relative">
            {logoUrl ? (
              <img src={logoUrl} alt="logo-company" className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 text-lg font-extrabold text-emerald-700">{initials}</div>
            )}
            <button className="absolute -bottom-1 -right-1 rounded-full bg-emerald-500 p-1 text-white"><Camera className="h-3 w-3" /></button>
          </div>
          <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={onUploadLogo}>Tải ảnh lên</button>
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={onRemoveLogo}>Xóa ảnh</button>
          <p className="text-xs text-slate-500">JPG, PNG hoặc GIF. Tối đa 2MB.</p>
        </div>
        {loading ? <p className="mt-2 text-xs font-semibold text-emerald-700">Đang tải thông tin người dùng...</p> : null}
      </div>

      <Card
        title="Thông tin cá nhân"
        actionNode={personalEditing ? (
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700" onClick={onCancel}>Hủy</button>
            <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={onSave}><Save className="h-3.5 w-3.5" /> Lưu</button>
          </div>
        ) : (
          <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700" onClick={onToggleEdit}><Pencil className="h-3.5 w-3.5" /> Chỉnh sửa</button>
        )}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Họ và tên" value={fullName} editable={personalEditing} onChange={setFullNameInput} />
          <Field label="Email" value={email} editable={personalEditing} onChange={setEmailInput} />
          <Field label="Số điện thoại" value={phone} editable={personalEditing} onChange={setPhoneInput} />
          <Field label="Chức vụ" value={profile?.roleLabel ?? 'Nhà cung cấp'} />
        </div>
      </Card>

      <Card title="Thông tin tài khoản">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Mã tài khoản" value={accountCode} />
          <Field label="Loại tài khoản" value={companyTypeLabel} />
          <Field label="Ngày đăng ký" value={joinedAt} />
          <Field label="Trạng thái" value={statusLabel} />
        </div>
      </Card>
    </>
  )
}

function SupplierBusinessPanel({
  profile,
  loading,
  businessEditing,
  onToggleEdit,
  onSave,
  onCancel,
  companyNameInput,
  setCompanyNameInput,
  taxCodeInput,
  setTaxCodeInput,
  registrationNumberInput,
  setRegistrationNumberInput,
  establishedYearInput,
  setEstablishedYearInput,
  websiteInput,
  setWebsiteInput,
  provinceInput,
  setProvinceInput,
  districtInput,
  setDistrictInput,
  addressInput,
  setAddressInput,
  descriptionInput,
  setDescriptionInput,
  assets,
  isSupplier,
  isBuyer,
  logoUrl,
  onUploadLogo,
  onAddFarmImage,
  onAddCertificate,
  onDeleteMedia,
}: {
  profile: ReturnType<typeof useCurrentUserProfile>['profile']
  loading: boolean
  businessEditing: boolean
  onToggleEdit: () => void
  onSave: () => void
  onCancel: () => void
  companyNameInput: string
  setCompanyNameInput: (value: string) => void
  taxCodeInput: string
  setTaxCodeInput: (value: string) => void
  registrationNumberInput: string
  setRegistrationNumberInput: (value: string) => void
  establishedYearInput: string
  setEstablishedYearInput: (value: string) => void
  websiteInput: string
  setWebsiteInput: (value: string) => void
  provinceInput: string
  setProvinceInput: (value: string) => void
  districtInput: string
  setDistrictInput: (value: string) => void
  addressInput: string
  setAddressInput: (value: string) => void
  descriptionInput: string
  setDescriptionInput: (value: string) => void
  assets: CompanyProfileAssets
  isSupplier: boolean
  isBuyer: boolean
  logoUrl: string | null
  onUploadLogo: () => void
  onAddFarmImage: () => void
  onAddCertificate: () => void
  onDeleteMedia: (id: number) => void
}) {
  const companyName = businessEditing ? companyNameInput : profile?.companyName ?? 'N/A'
  const taxCode = businessEditing ? taxCodeInput : profile?.taxCode ?? 'N/A'
  const registrationNumber = businessEditing ? registrationNumberInput : profile?.registrationNumber ?? 'N/A'
  const establishedYear = businessEditing ? establishedYearInput : profile?.establishedYear ?? 'N/A'
  const website = businessEditing ? websiteInput : profile?.website ?? 'N/A'
  const province = businessEditing ? provinceInput : profile?.province ?? 'N/A'
  const district = businessEditing ? districtInput : profile?.district ?? 'N/A'
  const address = businessEditing ? addressInput : profile?.address ?? 'N/A'
  const description = businessEditing ? descriptionInput : profile?.description ?? 'N/A'

  return (
    <>
      <Card
        title={isBuyer ? 'Thông tin doanh nghiệp' : 'Thông tin pháp lý doanh nghiệp'}
        actionNode={businessEditing ? (
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700" onClick={onCancel}>Hủy</button>
            <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={onSave}><Save className="h-3.5 w-3.5" /> Lưu</button>
          </div>
        ) : (
          <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700" onClick={onToggleEdit}><Pencil className="h-3.5 w-3.5" /> Chỉnh sửa</button>
        )}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Tên pháp lý của doanh nghiệp" value={companyName} full editable={businessEditing} onChange={setCompanyNameInput} />
          <Field label="Loại hình doanh nghiệp" value={profile?.companyTypeLabel ?? 'N/A'} />
          <Field label="Mã số thuế" value={taxCode} editable={businessEditing} onChange={setTaxCodeInput} />
          <Field label="Số giấy đăng ký kinh doanh" value={registrationNumber} editable={businessEditing} onChange={setRegistrationNumberInput} />
          <Field label="Năm thành lập" value={establishedYear} editable={businessEditing} onChange={setEstablishedYearInput} />
          <Field label="Website" value={website} full editable={businessEditing} onChange={setWebsiteInput} />
          <Field label="Thành phố / Tỉnh" value={province} editable={businessEditing} onChange={setProvinceInput} />
          <Field label="Quận / Huyện" value={district} editable={businessEditing} onChange={setDistrictInput} />
          <Field label="Địa chỉ chi tiết" value={address} full editable={businessEditing} onChange={setAddressInput} />
        </div>

        {loading ? <p className="mt-2 text-xs font-semibold text-emerald-700">Đang tải thông tin doanh nghiệp...</p> : null}

        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold">Logo công ty</p>
          {logoUrl ? <img src={logoUrl} alt="company-logo" className="mb-2 h-20 w-20 rounded-lg object-cover" /> : null}
          <button className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:bg-slate-50" onClick={onUploadLogo}>
            <UploadCloud className="mr-1 h-3.5 w-3.5" /> Nhấp để tải lên hoặc kéo thả logo công ty
          </button>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold">Mô tả doanh nghiệp</p>
          <textarea className="h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs" value={description} onChange={(event) => setDescriptionInput(event.target.value)} readOnly={!businessEditing} />
        </div>
      </Card>

      {isSupplier ? <Card
        title="Hình ảnh cửa hàng / trang trại"
        actionNode={
          <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700" onClick={onAddFarmImage}><Pencil className="h-3.5 w-3.5" /> Thêm ảnh</button>
        }
      >
        {assets.farmImages.length > 0 ? (
          <div className="space-y-2">
            <img src={resolveUploadedFileUrl(assets.farmImages[0]?.url) ?? '/images/background3.jpg'} alt="farm-main" className="h-36 w-full rounded-lg object-cover" />
            <div className="grid grid-cols-6 gap-2">
              {assets.farmImages.slice(1, 6).map((item) => (
                <div key={item.id} className="relative">
                  <img src={resolveUploadedFileUrl(item.url) ?? '/images/background4.jpg'} alt={item.label} className="h-16 w-full rounded-lg object-cover" />
                  <button className="absolute right-1 top-1 rounded bg-white/90 p-1 text-rose-600" onClick={() => onDeleteMedia(item.id)}><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
              <button className="flex h-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500" onClick={onAddFarmImage}>Thêm ảnh</button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center text-sm text-slate-500">
            Không có hình ảnh
          </div>
        )}
      </Card> : null}

      {isSupplier ? <Card
        title="Giấy chứng nhận & Chứng chỉ"
        actionNode={
          <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700" onClick={onAddCertificate}><Pencil className="h-3.5 w-3.5" /> Thêm chứng nhận</button>
        }
      >
        {assets.certificates.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {assets.certificates.map((item) => (
              <div key={item.id} className="rounded-lg border border-emerald-100 p-2.5">
                <p className="truncate text-sm font-bold">{item.label || 'Chứng chỉ'}</p>
                <p className="text-xs text-slate-500">Còn hiệu lực</p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-emerald-700">
                  <a href={resolveUploadedFileUrl(item.url) ?? '#'} target="_blank" rel="noreferrer">Xem</a>
                  <a href={resolveUploadedFileUrl(item.url) ?? '#'} target="_blank" rel="noreferrer" download>Tải xuống</a>
                  <button className="text-rose-600" onClick={() => onDeleteMedia(item.id)}>Xóa</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center text-sm text-slate-500">
            Không có chứng chỉ
          </div>
        )}
      </Card> : null}

      {isSupplier ? <Card title="Vị trí trang trại trên bản đồ">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="h-40 w-full bg-cover bg-center" style={{ backgroundImage: "url('/images/background.png')" }}>
            <button className="m-2 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-blue-600">Mở trong Maps</button>
          </div>
        </div>
      </Card> : null}
    </>
  )
}

function SupplierSecurityPanel() {
  return (
    <>
      <Card title="Đổi mật khẩu">
        <div className="max-w-md space-y-2">
          <PasswordField label="Mật khẩu hiện tại" />
          <PasswordField label="Mật khẩu mới" />
          <PasswordField label="Xác nhận mật khẩu mới" />
          <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><Lock className="h-3.5 w-3.5" /> Đổi mật khẩu</button>
        </div>
      </Card>

      <Card title="Xác thực hai yếu tố (2FA)">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Thêm lớp bảo vệ cho tài khoản của bạn</p>
          <button className="h-5 w-9 rounded-full bg-emerald-500 p-0.5"><span className="block h-4 w-4 rounded-full bg-white translate-x-4" /></button>
        </div>
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">2FA đã được bật — Mã xác thực gửi qua SMS khi đăng nhập</div>
      </Card>

      <Card title="Lịch sử đăng nhập">
        <div className="space-y-2">
          {[
            ['Chrome - Windows', 'Cà Mau, VN - Hôm nay, 08:30', 'Hiện tại'],
            ['Safari - iPhone', 'Cà Mau, VN - Hôm qua, 19:45', 'Đăng xuất'],
            ['Chrome - Windows', 'TP. Hồ Chí Minh, VN - 03/04/2026, 14:20', 'Đăng xuất'],
          ].map(([device, meta, action]) => (
            <div key={device + meta} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <div>
                <p className="text-sm font-semibold">{device}</p>
                <p className="text-xs text-slate-500">{meta}</p>
              </div>
              <button className={`text-xs font-semibold ${action === 'Hiện tại' ? 'text-emerald-600' : 'text-red-500'}`}>{action}</button>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

function SupplierNotificationPanel() {
  return (
    <Card title="Cài đặt thông báo">
      <div className="space-y-3">
        {[
          ['Đơn hàng mới', 'Thông báo khi có đơn hàng mới từ buyer'],
          ['RFQ mới', 'Thông báo khi nhận được yêu cầu báo giá'],
          ['Thanh toán', 'Thông báo khi nhận được thanh toán'],
          ['Tin tức hệ thống', 'Cập nhật tính năng mới từ AgriBridge'],
        ].map(([title, desc], idx) => (
          <div key={title} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 pb-2 last:border-none">
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <label><input type="checkbox" defaultChecked /> EMAIL</label>
              <label><input type="checkbox" defaultChecked={idx !== 1} /> SMS</label>
              <label><input type="checkbox" defaultChecked /> Push</label>
            </div>
          </div>
        ))}
      </div>
      <button className="mt-3 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><Save className="h-3.5 w-3.5" /> Lưu cài đặt</button>
    </Card>
  )
}

function TabButton({ icon: Icon, label, active, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'}`}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function Card({
  title,
  action,
  actionNode,
  children,
}: {
  title: string
  action?: string
  actionNode?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold">{title}</h3>
        {actionNode ? actionNode : action ? (
          <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"><Pencil className="h-3.5 w-3.5" /> {action}</button>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  value,
  full,
  editable,
  onChange,
}: {
  label: string
  value: string
  full?: boolean
  editable?: boolean
  onChange?: (value: string) => void
}) {
  return (
    <label className={full ? 'md:col-span-2' : ''}>
      <p className="mb-1 text-xs font-semibold text-slate-700">{label}</p>
      <input
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-600"
        value={value}
        readOnly={!editable}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  )
}

function PasswordField({ label }: { label: string }) {
  return (
    <label className="block">
      <p className="mb-1 text-xs font-semibold text-slate-700">{label}</p>
      <div className="relative">
        <input type="password" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 pr-8 text-xs" />
        <Eye className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  )
}
