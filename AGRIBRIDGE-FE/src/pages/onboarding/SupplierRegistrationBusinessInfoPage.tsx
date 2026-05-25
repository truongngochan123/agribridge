import { CircleHelp, Leaf, ShoppingCart, Sprout, Store, TreePine, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  checkRegistrationAvailability,
  lookupCompanyByTaxCode,
  type RegistrationDraft,
} from '../../services/authService'
import { uploadRegistrationFile } from '../../services/uploadService'

import {
  fetchVietnamProvinces,
  fetchVietnamDistrictsByProvinceCode,
  fetchVietnamWardsByDistrictCode,
  findProvinceByName,
  type VietnamProvinceOption,
  type VietnamDistrictOption,
} from '../../services/vietnamAddressService'

const DRAFT_KEY = 'agribridge.register.draft'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ADDRESS_SUGGESTIONS = [
  'Số nhà, đường, phường/xã',
  'Tòa nhà, số tầng, căn hộ',
  'Khu công nghiệp, lô, đường nội bộ',
  'Chợ, sạp, ki-ot',
  'Ấp/thôn, xã/phường',
]

type BusinessFieldErrors = {
  companyName?: string
  taxCode?: string
  province?: string
  district?: string
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
    case 'district':
      return trimmed ? '' : 'Vui lòng chọn quận/huyện.'
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

function deriveWardProvince(address?: string) {
  if (!address) return { ward: '', province: '' }

  const parts = address
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (parts.length === 0) return { ward: '', province: '' }

  const wardKeywords = /(phuong|phường|xa|xã|thi tran|thị trấn|quan|quận|huyen|huyện|thi xa|thị xã)/i
  const provinceKeywords = /(tinh|tỉnh|thanh pho|thành phố|tp\.?)/i

  let ward = ''
  let province = ''

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index]
    if (!province && (provinceKeywords.test(part) || index === parts.length - 1)) {
      province = part
      continue
    }
    if (!ward && wardKeywords.test(part)) {
      ward = part
      break
    }
  }

  return { ward, province }
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="reg-feature-item flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm text-white shadow-inner">
        {icon}
      </span>
      <div>
        <p className="text-[15px] font-bold text-white">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-emerald-100/80">{desc}</p>
      </div>
    </div>
  )
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
  const [checkingTaxCode, setCheckingTaxCode] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<BusinessFieldErrors>({})
  const [provinceOptions, setProvinceOptions] = useState<VietnamProvinceOption[]>([])
  const [districtOptions, setDistrictOptions] = useState<VietnamDistrictOption[]>([])
  const [wardOptions, setWardOptions] = useState<string[]>([])
  const [loadingAddressOptions, setLoadingAddressOptions] = useState(false)
  const [addressLoadError, setAddressLoadError] = useState('')

  useEffect(() => {
    const rawDraft = localStorage.getItem(DRAFT_KEY)
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

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl)
      }
    }
  }, [logoPreviewUrl])

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
    async function loadDistricts() {
      if (!form.province.trim() || !selectedProvince) {
        setDistrictOptions([])
        setWardOptions([])
        return
      }
      try {
        const districts = await fetchVietnamDistrictsByProvinceCode(selectedProvince.code)
        if (!ignore) setDistrictOptions(districts)
      } catch {
        if (!ignore) setDistrictOptions([])
      }
    }
    void loadDistricts()
    return () => { ignore = true }
  }, [form.province, selectedProvince])

  const selectedDistrict = useMemo(
    () => districtOptions.find((d) => d.name === form.district) ?? null,
    [form.district, districtOptions],
  )

  useEffect(() => {
    let ignore = false
    async function loadWards() {
      if (!selectedDistrict) {
        setWardOptions([])
        return
      }
      try {
        const wards = await fetchVietnamWardsByDistrictCode(selectedDistrict.code)
        if (!ignore) setWardOptions(wards.map((w) => w.name))
      } catch {
        if (!ignore) setWardOptions([])
      }
    }
    void loadWards()
    return () => { ignore = true }
  }, [selectedDistrict])

  const handleChange = <K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      role: currentRole,
      businessType: currentRole === 'supplier' ? 'BUSINESS' : (key === 'taxCode' ? ((String(value).trim() ? 'BUSINESS' : 'INDIVIDUAL')) : prev.businessType),
      district: key === 'province' ? '' : key === 'district' ? String(value) : prev.district,
      ward: (key === 'province' || key === 'district') ? '' : key === 'ward' ? String(value) : prev.ward,
    }))
    if (key === 'companyName' || key === 'taxCode' || key === 'province' || key === 'district' || key === 'ward' || key === 'address') {
      setFieldErrors((prev) => ({ ...prev, [key]: '' }))
    }
    if (key === 'province') {
      setFieldErrors((prev) => ({ ...prev, district: '', ward: '' }))
    }
    if (key === 'district') {
      setFieldErrors((prev) => ({ ...prev, ward: '' }))
    }
    if (key === 'taxCode') {
      setTaxError('')
      setTaxLookupHint('')
    }
  }

  const validateCurrentBusinessFields = () => {
    const nextErrors: BusinessFieldErrors = {
      companyName: validateBusinessField('companyName', form.companyName, requiresTaxCode),
      taxCode: validateBusinessField('taxCode', form.taxCode, requiresTaxCode),
      province: validateBusinessField('province', form.province, requiresTaxCode),
      district: validateBusinessField('district', form.district ?? '', requiresTaxCode),
      ward: validateBusinessField('ward', form.ward, requiresTaxCode),
      address: validateBusinessField('address', form.address, requiresTaxCode),
    }
    setFieldErrors(nextErrors)
    return nextErrors
  }

  const ensureTaxCodeValid = async () => {
    const normalizedTax = form.taxCode.replace(/\D/g, '')
    if (!requiresTaxCode || !normalizedTax) return true
    if (normalizedTax.length !== 10) {
      setTaxError('Mã số thuế phải đúng 10 chữ số.')
      return false
    }

    setCheckingTaxCode(true)
    setTaxLookupHint('')
    try {
      const result = await checkRegistrationAvailability({ role: currentRole, taxCode: normalizedTax })
      if (result.taxCodeTaken) {
        setTaxError('MST đã tồn tại trong hệ thống.')
        return false
      }

      setTaxError('')
      const lookup = await lookupCompanyByTaxCode(normalizedTax)
      if (lookup.found) {
        const derived = deriveWardProvince(lookup.address ?? '')
        setForm((prev) => ({
          ...prev,
          companyName: lookup.companyName ?? prev.companyName,
          province: lookup.province ?? (derived.province || prev.province),
          ward: lookup.ward ?? (derived.ward || prev.ward || ''),
          address: lookup.address ?? prev.address,
        }))
        setTaxLookupHint('Đã tự điền thông tin công ty theo MST.')
      } else {
        setTaxLookupHint('Không tự động tìm thấy thông tin MST. Vui lòng nhập tay thông tin doanh nghiệp.')
      }

      return true
    } catch {
      setTaxLookupHint('Không thể tự động kiểm tra MST lúc này. Vui lòng nhập tay thông tin doanh nghiệp.')
      return true
    } finally {
      setCheckingTaxCode(false)
    }
  }

  const validateBusinessStep = async () => {
    const nextErrors = validateCurrentBusinessFields()
    if (Object.values(nextErrors).some(Boolean)) {
      setError('Vui lòng kiểm tra lại các trường bắt buộc.')
      return false
    }

    const normalizedTax = form.taxCode.replace(/\D/g, '')
    if (requiresTaxCode && normalizedTax.length !== 10) {
      setError('Mã số thuế phải đúng 10 chữ số.')
      return false
    }

    if (requiresTaxCode) {
      const isTaxValid = await ensureTaxCodeValid()
      if (!isTaxValid) {
        setError('Vui lòng kiểm tra mã số thuế trước khi tiếp tục.')
        return false
      }
    }

    if (taxError) {
      setError('Vui lòng kiểm tra mã số thuế trước khi tiếp tục.')
      return false
    }

    setError('')
    return true
  }

  const handleContinue = async () => {
    if (!(await validateBusinessStep())) {
      return
    }

    if (logoFile) {
      try {
        setUploadingLogo(true)
        const uploaded = await uploadRegistrationFile(logoFile)
        setForm((prev) => ({ ...prev, logoUrl: uploaded.url }))
      } catch {
        setError('Upload logo thất bại. Vui lòng thử lại.')
        return
      } finally {
        setUploadingLogo(false)
      }
    }

    localStorage.setItem(
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

        setCheckingTaxCode(true)
        setTaxLookupHint('')

        const result = await checkRegistrationAvailability({ role: currentRole, taxCode: normalizedTax })
        if (result.taxCodeTaken) {
          setTaxError('MST đã tồn tại trong hệ thống.')
          return
        }

        setTaxError('')

        const lookup = await lookupCompanyByTaxCode(normalizedTax)
        if (lookup.found) {
          const derived = deriveWardProvince(lookup.address ?? '')
          setForm((prev) => ({
            ...prev,
            companyName: lookup.companyName ?? prev.companyName,
            province: lookup.province ?? (derived.province || prev.province),
            ward: lookup.ward ?? (derived.ward || prev.ward || ''),
            address: lookup.address ?? prev.address,
          }))
          setTaxLookupHint('Đã tự điền thông tin công ty theo MST.')
        } else {
          setTaxLookupHint('Không tự động tìm thấy thông tin MST. Vui lòng nhập tay thông tin doanh nghiệp.')
        }
      }
    } catch {
      setTaxLookupHint('Không thể tự động kiểm tra MST lúc này. Vui lòng nhập tay thông tin doanh nghiệp.')
    } finally {
      setCheckingTaxCode(false)
    }
  }

  const handleLogoSelect = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Logo phải là file ảnh.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Logo phải nhỏ hơn hoặc bằng 5MB.')
      return
    }

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl)
    }

    setError('')
    setLogoFile(file)
    setLogoPreviewUrl(URL.createObjectURL(file))
  }

  const handleLogoRemove = () => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl)
    }
    setLogoFile(null)
    setLogoPreviewUrl('')
    setForm((prev) => ({ ...prev, logoUrl: '' }))
  }

  const inputClass = `reg-input w-full rounded-xl border border-[#D9E1EA] bg-white/70 px-3.5 py-2.5 text-[13.5px] text-[#0F172A] outline-none transition placeholder:text-[#B0BAC9] focus:border-[#2F8F3A] focus:bg-white focus:ring-3 focus:ring-emerald-100`
  const labelClass = 'mb-1.5 block text-[12px] font-bold text-[#344054] tracking-wide uppercase'

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * { font-family: 'Inter', sans-serif; }

        @keyframes regSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes regFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes regShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes floatBubble {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.6; }
          33% { transform: translateY(-20px) rotate(5deg); opacity: 0.8; }
          66% { transform: translateY(-10px) rotate(-3deg); opacity: 0.7; }
        }
        @keyframes leafSway {
          0%, 100% { transform: rotate(-5deg) scale(1); }
          50% { transform: rotate(5deg) scale(1.05); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(47,143,58,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(47,143,58,0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .reg-page-wrapper {
          animation: regFadeIn 0.5s ease both;
        }
        .reg-aside {
          animation: slideInLeft 0.6s cubic-bezier(.2,.8,.2,1) both;
        }
        .reg-form-panel {
          animation: regSlideUp 0.55s cubic-bezier(.2,.8,.2,1) both;
          animation-delay: 0.1s;
        }
        .reg-feature-item {
          animation: regSlideUp 0.5s cubic-bezier(.2,.8,.2,1) both;
        }
        .reg-feature-item:nth-child(1) { animation-delay: 0.3s; }
        .reg-feature-item:nth-child(2) { animation-delay: 0.45s; }
        .reg-feature-item:nth-child(3) { animation-delay: 0.6s; }

        .reg-bubble {
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
          animation: floatBubble linear infinite;
        }

        .reg-input {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .reg-input:focus {
          box-shadow: 0 0 0 3px rgba(47,143,58,0.12);
        }
        .reg-input-error {
          border-color: #EF4444 !important;
          box-shadow: 0 0 0 3px rgba(239,68,68,0.08) !important;
        }
        .reg-continue-btn {
          background: linear-gradient(135deg, #1a7a2e 0%, #2F8F3A 40%, #16a34a 100%);
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .reg-continue-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
          pointer-events: none;
        }
        .reg-continue-btn:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 32px rgba(47,143,58,0.35), 0 4px 12px rgba(47,143,58,0.2);
        }
        .reg-continue-btn:not(:disabled):active {
          transform: translateY(0);
          box-shadow: none;
        }
        .reg-tab-active {
          background: white;
          color: #2F8F3A;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(47,143,58,0.15), 0 1px 3px rgba(0,0,0,0.1);
        }
        .reg-tab-inactive {
          color: #667085;
          font-weight: 600;
        }
        .reg-tab-inactive:hover {
          color: #344054;
          background: rgba(255,255,255,0.5);
        }
        .reg-card {
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(47,143,58,0.08);
          box-shadow: 0 8px 32px rgba(15,23,42,0.08), 0 2px 8px rgba(47,143,58,0.06);
        }
        .reg-section-divider {
          border-top: 1px solid rgba(214,226,214,0.6);
        }
        .reg-logo-upload {
          border: 2px dashed rgba(47,143,58,0.3);
          background: rgba(240,253,244,0.6);
          transition: all 0.2s ease;
        }
        .reg-logo-upload:hover {
          border-color: #2F8F3A;
          background: rgba(240,253,244,0.9);
        }
        .reg-error-banner {
          animation: regSlideUp 0.25s ease both;
          background: linear-gradient(135deg, #fef2f2, #fff5f5);
        }
        .reg-hint-success {
          animation: regSlideUp 0.2s ease both;
        }
        .reg-select-wrapper select {
          -webkit-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2398A2B3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px;
          padding-right: 36px;
        }
      `}</style>

      <div className="reg-page-wrapper grid min-h-screen lg:grid-cols-[480px_1fr]">

        {/* ─── LEFT PANEL: Decorative Agri Background ─── */}
        <aside className="reg-aside relative hidden overflow-hidden lg:flex lg:flex-col">
          {/* Background image */}
          <img
            src="/images/agri_register_bg.png"
            alt="Nông nghiệp Việt Nam"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Gradient overlays */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(5,90,30,0.88) 0%, rgba(10,110,60,0.82) 40%, rgba(6,78,59,0.90) 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 70%, rgba(34,197,94,0.15) 0%, transparent 60%)' }} />

          {/* Decorative floating bubbles */}
          <div className="reg-bubble" style={{ width: 120, height: 120, top: '10%', right: '15%', animationDuration: '8s', animationDelay: '0s' }} />
          <div className="reg-bubble" style={{ width: 60, height: 60, top: '30%', left: '8%', animationDuration: '6s', animationDelay: '2s' }} />
          <div className="reg-bubble" style={{ width: 80, height: 80, bottom: '20%', right: '10%', animationDuration: '10s', animationDelay: '1s' }} />
          <div className="reg-bubble" style={{ width: 40, height: 40, bottom: '35%', left: '20%', animationDuration: '7s', animationDelay: '3s' }} />

          {/* Content */}
          <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm shadow-lg">
                <img src="/images/logo.png" alt="AgriBridge" className="h-6 w-6 object-contain" />
              </div>
              <span className="text-2xl font-black tracking-tight">AgriBridge</span>
            </div>

            {/* Main message */}
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-sm font-semibold text-emerald-100">
                <Sprout className="h-4 w-4" />
                Nền tảng nông nghiệp số #1 Việt Nam
              </div>
              <h1 className="text-[clamp(36px,3.5vw,52px)] font-black leading-[1.05] text-white">
                Tham gia cùng<br />
                <span style={{ background: 'linear-gradient(90deg, #86efac, #4ade80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  AgriBridge
                </span>
              </h1>
              <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-emerald-100/90">
                Kết nối nhà cung cấp nông sản với nhà buôn toàn quốc. Minh bạch, hiệu quả, bền vững.
              </p>

              <div className="mt-8 space-y-4">
                <FeatureItem
                  icon={<Sprout className="h-5 w-5" />}
                  title="Kết nối trực tiếp"
                  desc="Loại bỏ trung gian, tối ưu lợi nhuận cho nông dân và doanh nghiệp"
                />
                <FeatureItem
                  icon={<Leaf className="h-5 w-5" />}
                  title="Nông sản chất lượng"
                  desc="Truy xuất nguồn gốc rõ ràng, đảm bảo tiêu chuẩn VIETGAP & GlobalGAP"
                />
                <FeatureItem
                  icon={<TreePine className="h-5 w-5" />}
                  title="Phát triển bền vững"
                  desc="Hỗ trợ nông nghiệp xanh, bảo vệ môi trường và cộng đồng nông thôn"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: '2,400+', label: 'Nhà cung cấp' },
                { value: '850+', label: 'Nhà buôn' },
                { value: '63', label: 'Tỉnh thành' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-white/10 backdrop-blur-sm px-3 py-3 text-center">
                  <p className="text-[22px] font-black text-white">{stat.value}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-emerald-200">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ─── RIGHT PANEL: Registration Form ─── */}
        <main className="flex min-h-screen flex-col">
          {/* Top bar */}
          <header className="flex items-center justify-between border-b border-emerald-100/60 bg-white/70 backdrop-blur-sm px-6 py-3.5 shadow-sm">
            <div className="flex items-center gap-2 lg:hidden">
              <img src="/images/logo.png" alt="AgriBridge" className="h-7 w-7 object-contain" />
              <span className="text-xl font-black text-[#0F172A]">AgriBridge</span>
            </div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#667085]">Đã có tài khoản?</span>
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-[#2F8F3A] shadow-sm transition hover:bg-emerald-50 hover:border-emerald-300"
              >
                Đăng nhập
              </Link>
            </div>
          </header>

          {/* Scrollable form area */}
          <div className="flex-1 overflow-y-auto px-5 py-8 sm:px-8 lg:px-10">
            <div className="mx-auto max-w-2xl">

              {/* Title */}
              <div className="mb-6">
                <h1 className="text-[28px] font-black text-[#0F172A] leading-tight">Tạo tài khoản mới</h1>
                <p className="mt-1 text-[14px] text-[#667085]">Điền thông tin doanh nghiệp để bắt đầu hành trình cùng AgriBridge</p>
              </div>

              {/* Role selector */}
              <div className="mb-5">
                <p className="mb-2 text-[11px] font-extrabold tracking-[0.1em] text-[#98A2B3] uppercase">Bạn là ai?</p>
                <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[#F0F4F8] p-1.5">
                  <Link
                    to="/onboarding/supplier/business-info"
                    className={`reg-tab inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] transition ${
                      currentRole === 'supplier' ? 'reg-tab-active' : 'reg-tab-inactive'
                    }`}
                  >
                    <Store className="h-4 w-4" />
                    Nhà cung cấp
                  </Link>
                  <Link
                    to="/onboarding/buyer/business-info"
                    className={`reg-tab inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] transition ${
                      currentRole === 'buyer' ? 'reg-tab-active' : 'reg-tab-inactive'
                    }`}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Nhà buôn
                  </Link>
                </div>
              </div>

              {/* Form card */}
              <div className="reg-form-panel reg-card rounded-2xl p-6">

                {/* Section: Business info */}
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Store className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-black text-[#0F172A]">Thông tin doanh nghiệp</h2>
                    <p className="text-[11px] text-[#667085]">
                      {currentRole === 'supplier'
                        ? 'Nhà cung cấp cần khai báo pháp lý đầy đủ để chờ duyệt.'
                        : 'Nhà buôn có thể dùng ngay sau đăng ký, tự động phân loại theo MST.'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Company name */}
                  <div>
                    <label className={labelClass}>Tên pháp lý của doanh nghiệp <span className="text-red-500">*</span></label>
                    <input
                      id="reg-company-name"
                      className={`${inputClass} ${fieldErrors.companyName ? 'reg-input-error' : ''}`}
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
                    {fieldErrors.companyName ? (
                      <p className="mt-1.5 text-[11.5px] font-semibold text-[#DC2626]">⚠ {fieldErrors.companyName}</p>
                    ) : null}
                  </div>

                  {/* Business type */}
                  <div>
                    <label className={labelClass}>Loại hình doanh nghiệp</label>
                    <div className="flex h-[42px] items-center rounded-xl border border-[#D9E1EA] bg-emerald-50/60 px-3.5 text-[13.5px] font-semibold text-[#0F172A]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {effectiveBusinessType === 'BUSINESS' ? 'Doanh nghiệp' : 'Cá nhân'}
                      </span>
                      <span className="ml-2 text-[11px] font-normal text-[#667085]">
                        ({currentRole === 'supplier' ? 'Cố định cho supplier' : 'Tự động theo MST'})
                      </span>
                    </div>
                  </div>

                  {/* Tax code */}
                  {currentRole === 'supplier' || effectiveBusinessType === 'BUSINESS' ? (
                    <div>
                      <label className={labelClass}>
                        Mã số thuế {requiresTaxCode ? <span className="text-red-500">*</span> : ''}
                      </label>
                      <input
                        id="reg-tax-code"
                        className={`${inputClass} ${fieldErrors.taxCode || taxError ? 'reg-input-error' : ''}`}
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
                      {checkingTaxCode ? (
                        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-[#667085]">
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
                          Đang kiểm tra MST...
                        </p>
                      ) : null}
                      {fieldErrors.taxCode ? <p className="mt-1.5 text-[11.5px] font-semibold text-[#DC2626]">⚠ {fieldErrors.taxCode}</p> : null}
                      {taxError ? <p className="mt-1.5 text-[11.5px] font-semibold text-[#DC2626]">⚠ {taxError}</p> : null}
                      {!taxError && taxLookupHint ? (
                        <p className="reg-hint-success mt-1.5 flex items-center gap-1 text-[11.5px] font-semibold text-[#2F8F3A]">
                          <span>✓</span> {taxLookupHint}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center rounded-xl border border-dashed border-[#D9E1EA] bg-amber-50/50 px-3.5 py-2.5 text-[12px] text-[#667085]">
                      💡 Buyer cá nhân: không bắt buộc MST, có thể bổ sung sau.
                    </div>
                  )}

                  {/* Registration number */}
                  <div>
                    <label className={labelClass}>Số giấy đăng ký kinh doanh</label>
                    <input
                      id="reg-registration-number"
                      className={inputClass}
                      placeholder="Số giấy chứng nhận"
                      value={form.registrationNumber ?? ''}
                      onChange={(event) => handleChange('registrationNumber', event.target.value)}
                    />
                  </div>
                </div>

                {/* Address section */}
                <div className="reg-section-divider mt-5 pt-5">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-1 w-4 rounded-full bg-emerald-500" />
                    <h3 className="text-[13px] font-black text-[#0F172A] uppercase tracking-wide">Địa chỉ trụ sở chính</h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Province */}
                    <div>
                      <label className={labelClass}>Thành phố / Tỉnh <span className="text-red-500">*</span></label>
                      <input
                        id="reg-province"
                        className={`${inputClass} ${fieldErrors.province ? 'reg-input-error' : ''}`}
                        placeholder="Chọn hoặc gõ tên tỉnh/thành"
                        list="province-options"
                        value={form.province}
                        onChange={(event) => handleChange('province', event.target.value)}
                        onBlur={() =>
                          setFieldErrors((prev) => ({
                            ...prev,
                            province: validateBusinessField('province', form.province, requiresTaxCode),
                          }))
                        }
                      />
                      <datalist id="province-options">
                        {provinceOptions.map((item) => (
                          <option key={item.code} value={item.name} />
                        ))}
                      </datalist>
                      {fieldErrors.province ? <p className="mt-1.5 text-[11.5px] font-semibold text-[#DC2626]">⚠ {fieldErrors.province}</p> : null}
                      {loadingAddressOptions ? <p className="mt-1.5 text-[11.5px] text-[#667085]">Đang tải danh sách tỉnh/thành...</p> : null}
                      {!loadingAddressOptions && addressLoadError ? <p className="mt-1.5 text-[11.5px] text-[#667085]">{addressLoadError}</p> : null}
                    </div>

                    {/* District */}
                    <div>
                      <label className={labelClass}>Quận / Huyện <span className="text-red-500">*</span></label>
                      <input
                        id="reg-district"
                        className={`${inputClass} ${fieldErrors.district ? 'reg-input-error' : ''} ${!form.province ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder={form.province ? 'Chọn tỉnh/thành trước' : 'Chọn tỉnh/thành trước'}
                        list="district-options"
                        value={form.district ?? ''}
                        disabled={!form.province}
                        onChange={(event) => handleChange('district', event.target.value)}
                        onBlur={() =>
                          setFieldErrors((prev) => ({
                            ...prev,
                            district: (form.district ?? '').trim() ? '' : 'Vui lòng chọn quận/huyện.',
                          }))
                        }
                      />
                      <datalist id="district-options">
                        {districtOptions.map((item) => (
                          <option key={item.code} value={item.name} />
                        ))}
                      </datalist>
                      {fieldErrors.district ? <p className="mt-1.5 text-[11.5px] font-semibold text-[#DC2626]">⚠ {fieldErrors.district}</p> : null}
                    </div>

                    {/* Ward */}
                    <div>
                      <label className={labelClass}>Xã / Phường <span className="text-red-500">*</span></label>
                      <input
                        id="reg-ward"
                        className={`${inputClass} ${fieldErrors.ward ? 'reg-input-error' : ''} ${!form.district ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder={form.district ? 'Chọn quận/huyện trước' : 'Chọn quận/huyện trước'}
                        list="ward-options"
                        value={form.ward}
                        disabled={!form.district}
                        onChange={(event) => handleChange('ward', event.target.value)}
                        onBlur={() =>
                          setFieldErrors((prev) => ({
                            ...prev,
                            ward: validateBusinessField('ward', form.ward, requiresTaxCode),
                          }))
                        }
                      />
                      <datalist id="ward-options">
                        {wardOptions.map((ward) => (
                          <option key={ward} value={ward} />
                        ))}
                      </datalist>
                      {fieldErrors.ward ? <p className="mt-1.5 text-[11.5px] font-semibold text-[#DC2626]">⚠ {fieldErrors.ward}</p> : null}
                    </div>
                  </div>

                  {/* Detail address */}
                  <div className="mt-4">
                    <label className={labelClass}>Địa chỉ chi tiết <span className="text-red-500">*</span></label>
                    <input
                      id="reg-address"
                      className={`${inputClass} ${fieldErrors.address ? 'reg-input-error' : ''}`}
                      placeholder="Tên đường, số nhà, tòa nhà, phòng"
                      list="address-suggestions"
                      value={form.address}
                      onChange={(event) => handleChange('address', event.target.value)}
                      onBlur={() =>
                        setFieldErrors((prev) => ({
                          ...prev,
                          address: validateBusinessField('address', form.address, requiresTaxCode),
                        }))
                      }
                    />
                    <datalist id="address-suggestions">
                      {ADDRESS_SUGGESTIONS.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                    {fieldErrors.address ? <p className="mt-1.5 text-[11.5px] font-semibold text-[#DC2626]">⚠ {fieldErrors.address}</p> : null}
                  </div>

                  {/* Description */}
                  <div className="mt-4">
                    <label className={`${labelClass} inline-flex items-center gap-1.5`}>
                      Mô tả ngắn
                      <span className="rounded-full bg-[#F0F4F8] px-2 py-0.5 text-[10px] font-semibold text-[#667085] normal-case">Không bắt buộc</span>
                      <span title="Hiển thị cho admin khi duyệt hồ sơ" className="cursor-help">
                        <CircleHelp className="h-3.5 w-3.5 text-[#98A2B3]" />
                      </span>
                    </label>
                    <input
                      id="reg-description"
                      className={inputClass}
                      placeholder="Ví dụ: Nhà cung cấp rau củ khu vực miền Nam"
                      value={form.description ?? ''}
                      onChange={(event) => handleChange('description', event.target.value)}
                    />
                  </div>

                  {/* Logo upload */}
                  <div className="mt-4">
                    <label className={labelClass}>Logo doanh nghiệp</label>
                    {logoPreviewUrl || form.logoUrl ? (
                      <div className="relative mb-3 overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm">
                        <img
                          src={logoPreviewUrl || form.logoUrl}
                          alt="Logo doanh nghiệp"
                          className="h-28 w-full object-contain py-2"
                        />
                        <button
                          type="button"
                          onClick={handleLogoRemove}
                          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#DC2626] shadow-sm transition hover:bg-white hover:scale-110"
                          aria-label="Xóa logo"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                    <label className="reg-logo-upload flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold text-[#475467]">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleLogoSelect(event.target.files?.[0])}
                      />
                      <span className="text-lg">🖼</span>
                      {uploadingLogo ? 'Đang upload logo...' : 'Chọn file logo (JPG, PNG, SVG — tối đa 5MB)'}
                    </label>
                    {form.logoUrl ? (
                      <p className="mt-1.5 flex items-center gap-1 text-[11.5px] font-semibold text-[#2F8F3A]">
                        <span>✓</span> Đã upload logo thành công.
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Error banner */}
                {error ? (
                  <div className="reg-error-banner mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 px-4 py-3">
                    <span className="mt-0.5 text-base">⚠</span>
                    <p className="text-[13px] font-semibold text-[#DC2626]">{error}</p>
                  </div>
                ) : null}

                {/* Footer actions */}
                <div className="mt-5 flex items-center justify-between border-t border-emerald-50 pt-4">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#667085] transition hover:bg-gray-100 hover:text-[#344054]"
                  >
                    ← Quay lại
                  </Link>
                  <button
                    id="reg-continue-btn"
                    type="button"
                    onClick={handleContinue}
                    disabled={checkingTaxCode || uploadingLogo}
                    className="reg-continue-btn inline-flex min-w-44 items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-[13.5px] font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {checkingTaxCode ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Đang kiểm tra...
                      </>
                    ) : uploadingLogo ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Đang upload...
                      </>
                    ) : (
                      <>
                        Lưu và tiếp tục →
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step indicator */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-6 rounded-full bg-emerald-500" />
                  <div className="h-2 w-2 rounded-full bg-emerald-200" />
                </div>
                <p className="ml-1 text-[12px] font-medium text-[#667085]">Bước 1/2 · Thông tin doanh nghiệp</p>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
