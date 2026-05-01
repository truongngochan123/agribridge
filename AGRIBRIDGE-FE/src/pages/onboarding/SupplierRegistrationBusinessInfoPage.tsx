import { CircleHelp, ShoppingCart, Store } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Header } from '../../components/Header'
import { usePageTitle } from '../../hooks/usePageTitle'
import { checkRegistrationAvailability, lookupCompanyByTaxCode, type RegistrationDraft } from '../../services/authService'
import { uploadRegistrationFile } from '../../services/uploadService'

import {
  fetchVietnamProvinces,
  fetchVietnamWardsByProvinceCode,
  findProvinceByName,
  type VietnamProvinceOption,
} from '../../services/vietnamAddressService'

const DRAFT_KEY = 'agribridge.register.draft'

const labelClass = 'mb-1 block text-[12px] font-semibold text-[#1F2937]'
const inputClass =
  'h-9 w-full rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-2.5 text-[13px] text-[#0F172A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#2F8F3A] focus:bg-white'
const MAX_FILE_BYTES = 5 * 1024 * 1024

type BusinessFieldErrors = {
  companyName?: string
  taxCode?: string
  province?: string
  ward?: string
  address?: string
}

function validateBusinessField(field: keyof BusinessFieldErrors, value: string, requiresTaxCode: boolean): string {
  const trimmed = value.trim()

  switch (field) {
    case 'companyName':
      if (!trimmed) return 'Vui lòng nhập tên doanh nghiệp.'
      if (trimmed.length < 2) return 'Tên doanh nghiệp phải có ít nhất 2 ký tự.'
      return ''
    case 'taxCode': {
      const normalizedTax = value.replace(/\D/g, '')
      if (!requiresTaxCode && !normalizedTax) return ''
      if (!normalizedTax) return 'Vui lòng nhập mã số thuế.'
      if (normalizedTax.length !== 10) return 'Mã số thuế phải đúng 10 chữ số.'
      return ''
    }
    case 'province':
      return trimmed ? '' : 'Vui lòng chọn tỉnh/thành.'
    case 'ward':
      return trimmed ? '' : 'Vui lòng chọn xã/phường.'
    case 'address':
      if (!trimmed) return 'Vui lòng nhập địa chỉ chi tiết.'
      if (trimmed.length < 5) return 'Địa chỉ chi tiết quá ngắn.'
      return ''
    default:
      return ''
  }
}

export function SupplierRegistrationBusinessInfoPage() {
  usePageTitle('Đăng ký - Thông tin doanh nghiệp')
  const { role } = useParams<{ role: string }>()
  const navigate = useNavigate()
  const currentRole = role === 'buyer' ? 'buyer' : 'supplier'

  const [form, setForm] = useState<RegistrationDraft>({
    role: currentRole,
    companyName: '',
    businessType: currentRole === 'supplier' ? 'BUSINESS' : 'INDIVIDUAL',
    ownerName: '',
    taxCode: '',
    registrationNumber: '',
    companyPhone: '',
    companyEmail: '',
    province: '',
    ward: '',
    address: '',
    description: '',
    logoUrl: '',
  })
  const [error, setError] = useState('')
  const [taxError, setTaxError] = useState('')
  const [taxLookupHint, setTaxLookupHint] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<BusinessFieldErrors>({})
  const [provinceOptions, setProvinceOptions] = useState<VietnamProvinceOption[]>([])
  const [wardOptions, setWardOptions] = useState<string[]>([])
  const [loadingAddressOptions, setLoadingAddressOptions] = useState(false)
  const [addressLoadError, setAddressLoadError] = useState('')

  useEffect(() => {
    const rawDraft = sessionStorage.getItem(DRAFT_KEY)
    if (!rawDraft) return

    try {
      const parsed = JSON.parse(rawDraft) as RegistrationDraft
      if (parsed.role !== currentRole) return

      setForm((prev) => ({
        ...prev,
        ...parsed,
        role: currentRole,
      }))
    } catch {
      // Ignore malformed draft and keep default empty form.
    }
  }, [currentRole])

  const selectedProvince = useMemo(
    () => findProvinceByName(provinceOptions, form.province),
    [form.province, provinceOptions],
  )
  const inferredBuyerType = form.taxCode.trim() ? 'BUSINESS' : 'INDIVIDUAL'
  const effectiveBusinessType = currentRole === 'supplier' ? 'BUSINESS' : inferredBuyerType
  const requiresTaxCode = currentRole === 'supplier' || effectiveBusinessType === 'BUSINESS'

  useEffect(() => {
    let ignore = false
    async function loadProvinces() {
      setLoadingAddressOptions(true)
      setAddressLoadError('')
      try {
        const provinces = await fetchVietnamProvinces()
        if (!ignore) {
          setProvinceOptions(provinces)
        }
      } catch {
        if (!ignore) {
          setAddressLoadError('Không thể tải danh sách tỉnh/thành từ API.')
          setProvinceOptions([])
        }
      } finally {
        if (!ignore) {
          setLoadingAddressOptions(false)
        }
      }
    }

    void loadProvinces()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
  let ignore = false

  async function loadWards() {
    if (!form.province.trim() || !selectedProvince) {
      setWardOptions([])
      return
    }

    try {
      const wards = await fetchVietnamWardsByProvinceCode(selectedProvince.code)
      if (!ignore) {
        setWardOptions(wards.map((ward) => ward.name))
      }
    } catch {
      if (!ignore) {
        setWardOptions([])
      }
    }
  }

  void loadWards()
  return () => {
    ignore = true
  }
}, [form.province, selectedProvince])

  const handleChange = <K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      role: currentRole,
      businessType: currentRole === 'supplier' ? 'BUSINESS' : (key === 'taxCode' ? ((String(value).trim() ? 'BUSINESS' : 'INDIVIDUAL')) : prev.businessType),
      ward: key === 'province' ? '' : key === 'ward' ? String(value) : prev.ward,
    }))
    if (key === 'companyName' || key === 'taxCode' || key === 'province' || key === 'ward' || key === 'address') {
      setFieldErrors((prev) => ({ ...prev, [key]: '' }))
    }
    if (key === 'province') {
      setFieldErrors((prev) => ({ ...prev, ward: '' }))
    }
  }

  const validateCurrentBusinessFields = () => {
    const nextErrors: BusinessFieldErrors = {
      companyName: validateBusinessField('companyName', form.companyName, requiresTaxCode),
      taxCode: validateBusinessField('taxCode', form.taxCode, requiresTaxCode),
      province: validateBusinessField('province', form.province, requiresTaxCode),
      ward: validateBusinessField('ward', form.ward, requiresTaxCode),
      address: validateBusinessField('address', form.address, requiresTaxCode),
    }
    setFieldErrors(nextErrors)
    return nextErrors
  }

  const validateBusinessStep = () => {
    const nextErrors = validateCurrentBusinessFields()
    if (Object.values(nextErrors).some(Boolean)) {
      setError('Vui long kiem tra lai cac truong bat buoc.')
      return false
    }

    const normalizedTax = form.taxCode.replace(/\D/g, '')
    if (requiresTaxCode && normalizedTax.length !== 10) {
      setError('Mã số thuế phải đúng 10 chữ số.')
      return false
    }

    if (taxError) {
      setError('Vui lòng xử lý các lỗi kiểm tra trùng trước khi tiếp tục.')
      return false
    }

    setError('')
    return true
  }

  const handleContinue = () => {
    if (!validateBusinessStep()) {
      return
    }

    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        ...form,
        role: currentRole,
        businessType: effectiveBusinessType,
        taxCode: form.taxCode.replace(/\D/g, ''),
      }),
    )
    navigate(`/onboarding/${currentRole}/contact-verification`)
  }

  const handleRealtimeValidation = async (field: 'tax') => {
    try {
      if (field === 'tax') {
        const normalizedTax = form.taxCode.replace(/\D/g, '')
        if (!normalizedTax) {
          setTaxError('')
          setTaxLookupHint('')
          return
        }
        if (normalizedTax.length !== 10) {
          setTaxError('MST phải đúng 10 số.')
          return
        }

        const result = await checkRegistrationAvailability({ role: currentRole, taxCode: normalizedTax })
        setTaxError(result.taxCodeTaken ? 'MST đã tồn tại trong hệ thống.' : '')

        if (!result.taxCodeTaken && normalizedTax.length === 10) {
          const lookup = await lookupCompanyByTaxCode(normalizedTax)
          if (lookup.found) {
            setForm((prev) => ({
              ...prev,
              companyName: lookup.companyName ?? prev.companyName,
              province: lookup.province ?? prev.province,
              ward: lookup.ward ?? prev.ward ?? '',
              address: lookup.address ?? prev.address,
            }))
            setTaxLookupHint('Đã tự điền thông tin công ty theo MST.')
          } else {
            setTaxLookupHint('Không tìm thấy hồ sơ MST, bạn nhập tay thông tin doanh nghiệp.')
          }
        }
      }

    } catch {
      // Keep UX non-blocking if realtime check endpoint is temporarily unavailable.
    }
  }

  const handleLogoUpload = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Logo phải là file ảnh.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Logo phải nhỏ hơn hoặc bằng 5MB.')
      return
    }

    try {
      setUploadingLogo(true)
      setError('')
      const uploaded = await uploadRegistrationFile(file)
      setForm((prev) => ({ ...prev, logoUrl: uploaded.url }))
    } catch {
      setError('Upload logo thất bại. Vui lòng thử lại.')
    } finally {
      setUploadingLogo(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F5F7]">
      <Header variant="onboarding" />

      <main className="mx-auto max-w-5xl px-4 pb-3 pt-16">
        {/* Title block */}
        <div className="text-center">
          <h1 className="text-[30px] font-extrabold leading-tight text-[#0F172A]">Tạo tài khoản mới</h1>
        </div>

        {/* Role selector */}
        <div className="mx-auto mt-2 max-w-2xl">
          <p className="text-[11px] font-extrabold tracking-[0.08em] text-[#344054]">BẠN LÀ AI?</p>
          <div className="mt-2 grid grid-cols-2 rounded-xl bg-[#EAF0F5] p-1">
            <Link
              to="/onboarding/supplier/business-info"
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs ${
                currentRole === 'supplier'
                  ? 'bg-white font-bold text-[#2F8F3A] shadow-sm'
                  : 'font-semibold text-[#475467]'
              }`}
            >
              <Store className="h-4 w-4" />
              Nhà cung cấp
            </Link>
            <Link
              to="/onboarding/buyer/business-info"
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs ${
                currentRole === 'buyer'
                  ? 'bg-white font-bold text-[#2F8F3A] shadow-sm'
                  : 'font-semibold text-[#475467]'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              Nhà buôn
            </Link>
          </div>
        </div>

        {/* Section heading */}
        <div className="mt-2">
          <h2 className="text-[22px] font-extrabold leading-tight text-[#0F172A]">Thông tin doanh nghiệp</h2>
          <p className="mt-1 text-[12px] text-[#667085]">
            {currentRole === 'supplier'
              ? 'Nhà cung cấp cần khai báo pháp lý đầy đủ để chờ duyệt.'
              : 'Nhà buôn có thể dùng ngay sau đăng ký, tự động phân loại theo MST.'}
          </p>
        </div>

        {/* Form card */}
        <section className="mt-2 rounded-2xl border border-[#D9E1EA] bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.05)] md:p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Tên pháp lý của doanh nghiệp *</label>
              <input
                className={inputClass}
                placeholder="e.g. Green Valley Organics Ltd."
                value={form.companyName}
                onChange={(event) => handleChange('companyName', event.target.value)}
                onBlur={() =>
                  setFieldErrors((prev) => ({
                    ...prev,
                    companyName: validateBusinessField('companyName', form.companyName, requiresTaxCode),
                  }))
                }
              />
              {fieldErrors.companyName ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{fieldErrors.companyName}</p> : null}
            </div>

            <div>
              <label className={labelClass}>Loại hình doanh nghiệp</label>
              <div className="flex h-9 items-center rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-2.5 text-[13px] font-semibold text-[#0F172A]">
                {effectiveBusinessType === 'BUSINESS' ? 'Doanh nghiệp' : 'Cá nhân'}
                <span className="ml-2 text-[11px] font-normal text-[#667085]">
                  ({currentRole === 'supplier' ? 'Cố định cho supplier' : 'Tự động theo MST'})
                </span>
              </div>
            </div>

            {currentRole === 'supplier' || effectiveBusinessType === 'BUSINESS' ? (
              <div>
                <label className={labelClass}>Mã số thuế {requiresTaxCode ? '*' : ''}</label>
                <input
                  className={inputClass}
                  placeholder="Mã số thuế gồm 10 chữ số"
                  value={form.taxCode}
                  onChange={(event) => handleChange('taxCode', event.target.value)}
                  onBlur={() => {
                    setFieldErrors((prev) => ({
                      ...prev,
                      taxCode: validateBusinessField('taxCode', form.taxCode, requiresTaxCode),
                    }))
                    handleRealtimeValidation('tax')
                  }}
                />
                {fieldErrors.taxCode ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{fieldErrors.taxCode}</p> : null}
                {taxError ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{taxError}</p> : null}
                {!taxError && taxLookupHint ? <p className="mt-1 text-xs font-semibold text-[#2F8F3A]">{taxLookupHint}</p> : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#D9E1EA] bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#667085]">
                Buyer cá nhân: không bắt buộc MST, có thể bổ sung sau.
              </div>
            )}

            <div>
              <label className={labelClass}>Số giấy đăng ký kinh doanh</label>
              <input
                className={inputClass}
                placeholder="Số giấy chứng nhận"
                value={form.registrationNumber ?? ''}
                onChange={(event) => handleChange('registrationNumber', event.target.value)}
              />
            </div>

          </div>

          {/* Address section */}
          <div className="mt-3 border-t border-[#E6ECF2] pt-3">
            <h3 className="text-[14px] font-bold text-[#1F2937]">Địa chỉ trụ sở chính</h3>

            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>Thành phố / Tỉnh *</label>
                <select
                  className={`${inputClass} appearance-none`}
                  value={form.province}
                  onChange={(event) => handleChange('province', event.target.value)}
                  onBlur={() =>
                    setFieldErrors((prev) => ({
                      ...prev,
                      province: validateBusinessField('province', form.province, requiresTaxCode),
                    }))
                  }
                >
                  <option value="">Chọn tỉnh/thành</option>
                  {provinceOptions.map((item) => (
                    <option key={item.code} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.province ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{fieldErrors.province}</p> : null}
                {loadingAddressOptions ? <p className="mt-1 text-xs text-[#667085]">Dang tai danh sach tinh/thanh...</p> : null}
                {!loadingAddressOptions && addressLoadError ? <p className="mt-1 text-xs text-[#667085]">{addressLoadError}</p> : null}
              </div>

              <div>
                <label className={labelClass}>Xã / Phường *</label>
                <select
                  className={`${inputClass} appearance-none`}
                  value={form.ward}
                  disabled={!form.province}
                  onChange={(event) => handleChange('ward', event.target.value)}
                  onBlur={() =>
                    setFieldErrors((prev) => ({
                      ...prev,
                      ward: validateBusinessField('ward', form.ward, requiresTaxCode),
                    }))
                  }
                >
                  <option value="">Chọn xã/phường</option>
                  {wardOptions.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                </select>
                {fieldErrors.ward ? (
                  <p className="mt-1 text-xs font-semibold text-[#DC2626]">{fieldErrors.ward}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-3">
              <label className={labelClass}>Địa chỉ chi tiết *</label>
              <input
                className={inputClass}
                placeholder="Tên đường, số nhà, tòa nhà, phòng"
                value={form.address}
                onChange={(event) => handleChange('address', event.target.value)}
                onBlur={() =>
                  setFieldErrors((prev) => ({
                    ...prev,
                    address: validateBusinessField('address', form.address, requiresTaxCode),
                  }))
                }
              />
              {fieldErrors.address ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{fieldErrors.address}</p> : null}
            </div>

            <div className="mt-3">
              <label className={`${labelClass} inline-flex items-center gap-1`}>
                Mô tả ngắn (không bắt buộc)
                <span title="Hiển thị cho admin khi duyệt hồ sơ">
                  <CircleHelp className="h-3.5 w-3.5 text-[#98A2B3]" />
                </span>
              </label>
              <input
                className={inputClass}
                placeholder="Ví dụ: Nhà cung cấp rau củ khu vực miền Nam"
                value={form.description ?? ''}
                onChange={(event) => handleChange('description', event.target.value)}
              />
            </div>

            <div className="mt-3">
              <label className={labelClass}>Logo doanh nghiệp</label>
              <label className="flex h-10 cursor-pointer items-center justify-center rounded-lg border border-dashed border-[#D9E1EA] bg-[#F8FAFC] px-3 text-[12px] font-semibold text-[#475467]">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleLogoUpload(event.target.files?.[0])}
                />
                {uploadingLogo ? 'Đang upload logo...' : 'Chọn file logo'}
              </label>
              {form.logoUrl ? <p className="mt-1 text-xs text-[#2F8F3A]">Đã upload logo.</p> : null}
            </div>
          </div>

          {error ? <p className="mt-4 text-sm font-semibold text-[#DC2626]">{error}</p> : null}

          <div className="mt-4 flex items-center justify-between border-t border-[#E6ECF2] pt-3">
            <Link to="/" className="inline-flex items-center gap-2 font-semibold text-[#344054] hover:text-[#0F172A]">
              Quay lại
            </Link>
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-[#2F8F3A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#277A31]"
            >
              Lưu và tiếp tục
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
