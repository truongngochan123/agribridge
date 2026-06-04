import { Eye, EyeOff, UploadCloud } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Header } from '../../components/Header'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  checkRegistrationAvailability,
  registerAccount,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  type ContactVerificationPayload,
  type RegistrationDraft,
} from '../../services/authService'
import { storeAuthSession } from '../../services/authSession'
import { uploadRegistrationFile } from '../../services/uploadService'

const DRAFT_KEY = 'agribridge.register.draft'
const CONTACT_DRAFT_PREFIX = 'agribridge.register.contact'

const labelClass = 'mb-1 block text-[12px] font-semibold text-[#1F2937]'
const inputClass =
  'h-9 w-full rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-2.5 text-[13px] text-[#0F172A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#2F8F3A] focus:bg-white'
const uploadBoxClass =
  'block cursor-pointer rounded-xl border-2 border-dashed border-[#D9E1EA] bg-[#F8FAFC] px-4 py-3 text-center transition hover:border-[#A7B8CC]'
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SIMPLE_PHONE_REGEX = /^(03|05|07|08|09)\d{8}$/
const PASSWORD_REQUIREMENTS = [
  { key: 'minLength', label: 'Tối thiểu 8 ký tự', test: (value: string) => value.length >= 8 },
  { key: 'uppercase', label: 'Có ít nhất 1 chữ hoa', test: (value: string) => /[A-Z]/.test(value) },
  { key: 'lowercase', label: 'Có ít nhất 1 chữ thường', test: (value: string) => /[a-z]/.test(value) },
  { key: 'number', label: 'Có ít nhất 1 số', test: (value: string) => /\d/.test(value) },
  { key: 'special', label: 'Có ít nhất 1 ký tự đặc biệt', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
]

type ApiErrorPayload = {
  message?: string
  errors?: Record<string, string>
}

type ApiErrorResponse = {
  status?: number
  data?: ApiErrorPayload
}

type SavedContactDraft = {
  form: ContactVerificationPayload
  contactPosition: string
  otpSentEmail: string
  otpVerifiedEmail: string
}

type DocumentUploadKey = 'identityDocumentUrl' | 'identityDocumentBackUrl' | 'businessDocumentUrl'

type UploadedDocumentMeta = {
  name: string
  size: number
  previewUrl: string
  isImage: boolean
}

type ContactFieldErrors = {
  fullName?: string
  loginPhone?: string
  loginEmail?: string
  emailOtp?: string
  citizenId?: string
  password?: string
  confirmPassword?: string
  agreedTerms?: string
}

function isValidEmail(value?: string): boolean {
  return SIMPLE_EMAIL_REGEX.test(String(value ?? '').trim())
}

function normalizePhoneForValidation(value?: string): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  return raw.replace(/\D/g, '')
}

function getPasswordChecks(password: string) {
  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }))
}

function isStrongPassword(password: string): boolean {
  return getPasswordChecks(password).every((requirement) => requirement.met)
}

function isValidCitizenId(value: string, currentRole: 'supplier' | 'buyer'): boolean {
  const trimmed = value.trim()
  if (currentRole === 'buyer' && !trimmed) return true
  return /^\d{12}$/.test(trimmed)
}

function validateContactField(
  field: keyof ContactFieldErrors,
  value: string | boolean,
  form: ContactVerificationPayload,
  currentRole: 'supplier' | 'buyer',
): string {
  switch (field) {
    case 'fullName': {
      const trimmed = String(value).trim()
      if (!trimmed) return 'Vui long nhap ten nguoi lien he.'
      if (trimmed.length < 2) return 'Ho ten phai co it nhat 2 ky tu.'
      return ''
    }
    case 'loginPhone': {
      const normalized = normalizePhoneForValidation(String(value))
      if (!normalized) return 'Vui lòng nhập số điện thoại.'
      if (!SIMPLE_PHONE_REGEX.test(normalized)) return 'Số điện thoại phải có 10 số và bắt đầu bằng 03/05/07/08/09.'
      return ''
    }
    case 'loginEmail': {
      const normalized = String(value).trim().toLowerCase()
      if (!normalized) return 'Vui long nhap email dang nhap.'
      if (!isValidEmail(normalized)) return 'Email dang nhap khong dung dinh dang.'
      return ''
    }
    case 'emailOtp': {
      const otp = String(value).trim()
      if (!otp) return 'Vui long nhap ma OTP.'
      if (!/^\d{6}$/.test(otp)) return 'Ma OTP phai gom 6 chu so.'
      return ''
    }
    case 'citizenId': {
      const trimmed = String(value).trim()
      if (currentRole === 'buyer' && !trimmed) return ''
      if (!trimmed) return 'Vui lòng nhập số CCCD.'
      if (!isValidCitizenId(trimmed, currentRole)) return 'CCCD phải đúng 12 số.'
      return ''
    }
    case 'password': {
      const password = String(value)
      if (!password) return 'Vui lòng nhập mật khẩu.'
      if (!isStrongPassword(password)) return 'Mật khẩu chưa đáp ứng đầy đủ yêu cầu bảo mật.'
      return ''
    }
    case 'confirmPassword': {
      const confirmPassword = String(value)
      if (!confirmPassword) return 'Vui lòng nhập lại mật khẩu.'
      if (confirmPassword !== form.password) return 'Mật khẩu không khớp.'
      return ''
    }
    case 'agreedTerms':
      return value === true ? '' : 'Ban can dong y dieu khoan de tiep tuc.'
    default:
      return ''
  }
}

function isAllowedDocumentFile(file: File): boolean {
  const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf']
  const allowedExtensions = /\.(png|jpe?g|pdf)$/i
  return allowedTypes.includes(file.type) || allowedExtensions.test(file.name)
}

function isImageDocumentFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name)
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function extractApiErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'Đăng ký thất bại, vui lòng thử lại.'
  }

  const maybeNetworkError = error as { code?: string; message?: string; response?: ApiErrorResponse }
  if (!('response' in maybeNetworkError) || !maybeNetworkError.response) {
    if (maybeNetworkError.code === 'ERR_NETWORK') {
      return 'Không thể kết nối đến máy chủ (localhost:8025). Vui lòng kiểm tra backend đang chạy.'
    }
    return maybeNetworkError.message ?? 'Đăng ký thất bại, vui lòng thử lại.'
  }

  const response = maybeNetworkError.response
  const payload = response?.data
  const statusCode = response?.status

  if (statusCode === 503) {
    return payload?.message ?? 'Dịch vụ gửi email OTP đang tạm thời không sẵn sàng. Vui lòng thử lại sau ít phút.'
  }

  const fieldErrors = payload?.errors ?? {}
  const firstFieldEntry = Object.entries(fieldErrors)[0]
  if (firstFieldEntry) {
    const [field, message] = firstFieldEntry
    return `${field}: ${message}`
  }

  return payload?.message ?? 'Đăng ký thất bại, vui lòng thử lại.'
}

export function SupplierRegistrationContactVerificationPage() {
  usePageTitle('Đăng ký - Xác minh liên lạc')
  const { role } = useParams<{ role: string }>()
  const navigate = useNavigate()
  const currentRole = role === 'buyer' ? 'buyer' : 'supplier'

  const [form, setForm] = useState<ContactVerificationPayload>({
    fullName: '',
    loginPhone: '',
    loginEmail: '',
    emailOtp: '',
    citizenId: '',
    password: '',
    confirmPassword: '',
    identityDocumentUrl: '',
    identityDocumentBackUrl: '',
    businessDocumentUrl: '',
    agreedTerms: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [contactPosition, setContactPosition] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [citizenError, setCitizenError] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  const [resultHint, setResultHint] = useState('')
  const [uploadingField, setUploadingField] = useState<DocumentUploadKey | null>(null)
  const [documentMeta, setDocumentMeta] = useState<Partial<Record<DocumentUploadKey, UploadedDocumentMeta>>>({})
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [otpSentEmail, setOtpSentEmail] = useState('')
  const [otpVerifiedEmail, setOtpVerifiedEmail] = useState('')
  const [otpMessage, setOtpMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const contactDraftKey = `${CONTACT_DRAFT_PREFIX}.${currentRole}`
  const passwordChecks = getPasswordChecks(form.password)
  const normalizedLoginEmail = form.loginEmail.trim().toLowerCase()
  const isBusinessDocumentRequired = currentRole === 'supplier'
  const isDocumentStepValid =
    Boolean(form.identityDocumentUrl.trim()) &&
    Boolean(form.identityDocumentBackUrl.trim()) &&
    (!isBusinessDocumentRequired || Boolean(form.businessDocumentUrl.trim())) &&
    form.agreedTerms
  const isAccountStepValid =
    !validateContactField('fullName', form.fullName, form, currentRole) &&
    !validateContactField('loginPhone', form.loginPhone, form, currentRole) &&
    !validateContactField('loginEmail', form.loginEmail, form, currentRole) &&
    !validateContactField('password', form.password, form, currentRole) &&
    !validateContactField('confirmPassword', form.confirmPassword, form, currentRole) &&
    !validateContactField('citizenId', form.citizenId, form, currentRole) &&
    form.agreedTerms &&
    otpVerifiedEmail === normalizedLoginEmail
  const canSendOtp = isValidEmail(normalizedLoginEmail)

  useEffect(() => {
    const raw = localStorage.getItem(contactDraftKey)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as SavedContactDraft
      if (parsed.form) {
        setForm((prev) => ({ ...prev, ...parsed.form, identityDocumentBackUrl: parsed.form.identityDocumentBackUrl ?? '' }))
      }
      setContactPosition(parsed.contactPosition ?? '')
      setOtpSentEmail(parsed.otpSentEmail ?? '')
      setOtpVerifiedEmail(parsed.otpVerifiedEmail ?? '')
    } catch {
      // Ignore malformed contact draft.
    }
  }, [contactDraftKey])

  useEffect(() => {
    const draft: SavedContactDraft = {
      form,
      contactPosition,
      otpSentEmail,
      otpVerifiedEmail,
    }
    localStorage.setItem(contactDraftKey, JSON.stringify(draft))
  }, [contactDraftKey, contactPosition, form, otpSentEmail, otpVerifiedEmail])

  useEffect(() => {
    return () => {
      Object.values(documentMeta).forEach((meta) => {
        if (meta?.previewUrl) URL.revokeObjectURL(meta.previewUrl)
      })
    }
  }, [documentMeta])

  const handleChange = <K extends keyof ContactVerificationPayload>(key: K, value: ContactVerificationPayload[K]) => {
    const nextForm = { ...form, [key]: value }

    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'loginEmail') {
        const normalizedEmail = String(value ?? '').trim().toLowerCase()
        if (normalizedEmail !== otpSentEmail) {
          next.emailOtp = ''
          nextForm.emailOtp = ''
        }
      }
      return next
    })

    if (key === 'loginPhone') setPhoneError('')
    if (key === 'citizenId') setCitizenError('')
    if (key === 'fullName' || key === 'loginPhone' || key === 'loginEmail' || key === 'emailOtp' || key === 'citizenId' || key === 'password' || key === 'confirmPassword' || key === 'agreedTerms') {
      const fieldKey = key as keyof ContactFieldErrors
      setFieldErrors((prev) => {
        const nextErrors = { ...prev }
        nextErrors[fieldKey] = validateContactField(fieldKey, nextForm[key], nextForm, currentRole)
        if (key === 'password') {
          nextErrors.confirmPassword = nextForm.confirmPassword
            ? validateContactField('confirmPassword', nextForm.confirmPassword, nextForm, currentRole)
            : ''
        }
        return nextErrors
      })
    }
    if (key === 'loginEmail') {
      const normalizedEmail = String(value ?? '').trim().toLowerCase()
      setEmailError('')
      if (normalizedEmail !== otpSentEmail) {
        setOtpVerifiedEmail('')
        setOtpMessage('')
      }
    }
  }

  const validateContactFields = (fields: Array<keyof ContactFieldErrors>) => {
    const nextErrors: ContactFieldErrors = {}
    for (const field of fields) {
      const rawValue =
        field === 'agreedTerms'
          ? form.agreedTerms
          : field === 'fullName' ||
              field === 'loginPhone' ||
              field === 'loginEmail' ||
              field === 'emailOtp' ||
              field === 'citizenId' ||
              field === 'password' ||
              field === 'confirmPassword'
            ? form[field]
            : ''
      nextErrors[field] = validateContactField(field, rawValue, form, currentRole)
    }
    setFieldErrors((prev) => ({ ...prev, ...nextErrors }))
    return nextErrors
  }

  const handleFileUpload = async (key: DocumentUploadKey, file?: File) => {
    if (!file) return
    if (!isAllowedDocumentFile(file)) {
      setError('Tệp tải lên phải là PNG, JPG, JPEG hoặc PDF.')
      return
    }
    const isImage = isImageDocumentFile(file)
    if (!isAllowedDocumentFile(file)) {
      setError('Tệp tải lên phải là PNG, JPG hoặc PDF.')
      return
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError('Tệp tài liệu phải nhỏ hơn hoặc bằng 10MB.')
      return
    }

    const previewUrl = isImage ? URL.createObjectURL(file) : ''

    try {
      setUploadingField(key)
      setError('')
      const uploaded = await uploadRegistrationFile(file)
      handleChange(key, uploaded.url)
      setDocumentMeta((prev) => {
        if (prev[key]?.previewUrl) URL.revokeObjectURL(prev[key]?.previewUrl ?? '')
        return {
          ...prev,
          [key]: {
            name: file.name,
            size: file.size,
            previewUrl,
            isImage,
          },
        }
      })
    } catch {
      setError('Upload tài liệu thất bại. Vui lòng thử lại.')
    } finally {
      setUploadingField(null)
    }
  }

  const handleRemoveUploadedDocument = (key: DocumentUploadKey) => {
    if (documentMeta[key]?.previewUrl) URL.revokeObjectURL(documentMeta[key]?.previewUrl ?? '')
    setDocumentMeta((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    handleChange(key, '')
    setError('')
  }

  const validateAvailability = async () => {
    const normalizedCitizen = form.citizenId.replace(/\D/g, '')
    const result = await checkRegistrationAvailability({
      role: currentRole,
      phone: form.loginPhone.trim(),
      email: form.loginEmail.trim().toLowerCase(),
      citizenId: normalizedCitizen || undefined,
    })

    setPhoneError(result.phoneTaken ? 'Số điện thoại đã tồn tại.' : '')
    setEmailError(result.emailTaken ? 'Email đã tồn tại.' : '')
    setCitizenError(result.citizenIdTaken ? 'CCCD đã liên kết với công ty khác.' : '')

    if (result.phoneTaken || result.emailTaken || result.citizenIdTaken) {
      throw new Error('Vui lòng sửa thông tin trùng trước khi tiếp tục.')
    }
  }

  const handleSendOtp = async () => {
    const normalizedEmail = form.loginEmail.trim().toLowerCase()
    const nextErrors = validateContactFields(['loginEmail'])
    if (nextErrors.loginEmail) {
      setError(nextErrors.loginEmail)
      return
    }

    try {
      setSendingOtp(true)
      setError('')
      await validateAvailability()
      const response = await sendRegistrationOtp(normalizedEmail)
      setOtpSentEmail(normalizedEmail)
      setOtpVerifiedEmail('')
      setOtpMessage(response.message)
      setForm((prev) => ({ ...prev, emailOtp: '' }))
    } catch (sendError) {
      setError(extractApiErrorMessage(sendError))
    } finally {
      setSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    const normalizedEmail = form.loginEmail.trim().toLowerCase()
    const nextErrors = validateContactFields(['loginEmail', 'emailOtp'])
    if (nextErrors.loginEmail || nextErrors.emailOtp) {
      setError(nextErrors.loginEmail || nextErrors.emailOtp || 'Vui long kiem tra lai thong tin OTP.')
      return
    }
    if (otpSentEmail !== normalizedEmail) {
      setError('Bạn cần gửi OTP cho email hiện tại trước khi xác thực.')
      return
    }
    if (!form.emailOtp.trim()) {
      setError('Vui lòng nhập mã OTP đã nhận qua email.')
      return
    }

    try {
      setVerifyingOtp(true)
      setError('')
      const response = await verifyRegistrationOtp(normalizedEmail, form.emailOtp.trim())
      setOtpVerifiedEmail(normalizedEmail)
      setOtpMessage(response.message)
    } catch (verifyError) {
      setError(extractApiErrorMessage(verifyError))
    } finally {
      setVerifyingOtp(false)
    }
  }

  const validateAccountStep = async () => {
    const nextErrors = validateContactFields([
      'fullName',
      'loginPhone',
      'loginEmail',
      'password',
      'confirmPassword',
      'citizenId',
    ])
    const firstFieldError = Object.values(nextErrors).find(Boolean)
    if (firstFieldError) {
      setError(firstFieldError)
      return false
    }

    if (otpVerifiedEmail !== form.loginEmail.trim().toLowerCase()) {
      setError('Vui lòng xác thực OTP email trước khi tiếp tục.')
      return false
    }

    try {
      await validateAvailability()
    } catch (availabilityError) {
      setError(extractApiErrorMessage(availabilityError))
      return false
    }

    setError('')
    return true
  }

  const handleNextStep = async () => {
    const valid = await validateAccountStep()
    if (!valid) return
    setStep(2)
  }

  const handleSubmit = async (skipOptionalDocs = false) => {
    try {
      setError('')

      const draftRaw = localStorage.getItem(DRAFT_KEY)
      if (!draftRaw) {
        setError('Không tìm thấy thông tin bước 1. Vui lòng quay lại nhập thông tin doanh nghiệp.')
        return
      }

      const draft: RegistrationDraft = JSON.parse(draftRaw)
      const isBuyerIndividual = currentRole === 'buyer' && !String(draft.taxCode ?? '').trim()
      const normalizedLoginEmail = form.loginEmail.trim().toLowerCase()
      const nextErrors = validateContactFields([
        'fullName',
        'loginPhone',
        'loginEmail',
        'password',
        'confirmPassword',
        'citizenId',
        'agreedTerms',
      ])
      const firstFieldError = Object.values(nextErrors).find(Boolean)
      if (firstFieldError) {
        setError(firstFieldError)
        return
      }

      if (otpVerifiedEmail !== normalizedLoginEmail) {
        setError('Email đăng nhập chưa được xác thực OTP.')
        return
      }

      if (draft.companyEmail.trim() && !isValidEmail(draft.companyEmail)) {
        setError('Email công ty không đúng định dạng. Vui lòng quay lại bước 1 để chỉnh.')
        return
      }

      if (!form.identityDocumentUrl.trim()) {
        setError('Nhà cung cấp cần tải lên giấy tờ định danh để xác minh.')
        return
      }

      if (!form.identityDocumentBackUrl.trim()) {
        setError('Vui lòng tải lên CCCD mặt sau.')
        return
      }

      if (isBusinessDocumentRequired && !form.businessDocumentUrl.trim()) {
        setError('Vui lòng tải lên giấy phép kinh doanh.')
        return
      }

      const payload: ContactVerificationPayload = {
        ...form,
        loginEmail: normalizedLoginEmail,
        emailOtp: form.emailOtp.trim(),
        identityDocumentUrl: form.identityDocumentUrl,
        identityDocumentBackUrl: form.identityDocumentBackUrl,
        businessDocumentUrl: skipOptionalDocs ? '' : form.businessDocumentUrl,
        citizenId: form.citizenId.replace(/\D/g, ''),
      }

      if (isBuyerIndividual && skipOptionalDocs) {
        payload.businessDocumentUrl = ''
      }

      setSubmitting(true)
      const result = await registerAccount({ ...draft, role: currentRole }, payload)
      storeAuthSession(result, { phone: form.loginPhone.trim(), email: normalizedLoginEmail })
      localStorage.setItem('agribridge.auth.name', form.fullName.trim())
      setResultHint(
        `Trust: ${result.trustLevel ?? 'N/A'} | Credit limit: ${result.creditLimit ?? 0} | Có thể mua nợ: ${
          result.canUseCredit ? 'Có' : 'Không'
        }`,
      )
      localStorage.removeItem(DRAFT_KEY)
      localStorage.removeItem(contactDraftKey)

      if (result.redirectPath) {
        // Auto-approved: backend scored >= 80, supplier can use platform immediately
        if (
          result.status === 'SUCCESS' &&
          (result.verificationStatus === 'AUTO_APPROVED' ||
            result.verificationStatus === 'APPROVED' ||
            result.verificationStatus === 'MANUAL_APPROVED')
        ) {
          navigate('/onboarding/verification/approved')
          return
        }

        if (result.status === 'PENDING_VERIFICATION') {
          localStorage.setItem('agribridge.pending.email', normalizedLoginEmail)
          navigate(`/onboarding/verification/pending?role=${currentRole}&email=${encodeURIComponent(normalizedLoginEmail)}`)
          return
        }
        navigate(result.redirectPath)
        return
      }

      localStorage.setItem('agribridge.pending.email', normalizedLoginEmail)
      navigate(`/onboarding/verification/pending?role=${currentRole}&email=${encodeURIComponent(normalizedLoginEmail)}`)

    } catch (submitError: unknown) {
      setError(extractApiErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const renderDocumentUpload = (key: DocumentUploadKey, label: string, required: boolean, actionLabel: string) => {
    const meta = documentMeta[key]
    const hasUploaded = Boolean(form[key]?.trim())

    return (
      <div>
        <label className={labelClass}>{label}{required ? '*' : ' (không bắt buộc)'}</label>
        <label className={uploadBoxClass}>
          <input type="file" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" className="hidden" onChange={(event) => handleFileUpload(key, event.target.files?.[0])} />
          <UploadCloud className="mx-auto h-6 w-6 text-[#98A2B3]" />
          <p className="mt-1 text-xs font-semibold text-[#344054]">{uploadingField === key ? 'Đang upload...' : actionLabel}</p>
          <p className="text-[11px] text-[#98A2B3]">PNG, JPG, JPEG hoặc PDF (tối đa 10MB)</p>
        </label>
        {hasUploaded ? (
          <div className="mt-2 rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] p-2">
            {meta?.isImage && meta.previewUrl ? <img src={meta.previewUrl} alt={label} className="mb-2 h-24 max-w-full rounded-md border border-[#D9E1EA] object-cover" /> : null}
            <p className="text-xs font-semibold text-[#2F8F3A]">{meta?.name ?? 'Đã tải lên tài liệu.'}</p>
            {meta ? <p className="mt-0.5 text-[11px] text-[#667085]">{formatFileSize(meta.size)}</p> : null}
            <button type="button" onClick={() => handleRemoveUploadedDocument(key)} className="mt-1 text-[11px] font-semibold text-[#DC2626]">
              Xóa và upload lại
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F3F5F7]">
      <Header variant="onboarding" />

      <main className="mx-auto max-w-5xl px-4 pb-3 pt-16">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight text-[#0F172A]">Liên hệ & hồ sơ</h1>
          <p className="mt-1 text-[12px] text-[#667085]">Bước {step}/2 • {step === 1 ? 'Thông tin tài khoản' : 'Tài liệu xác minh'}</p>
        </div>

        <section className="mt-2 rounded-2xl border border-[#D9E1EA] bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.05)] md:p-3">
          {step === 1 ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Tên người liên hệ *</label>
                  <input
                    className={inputClass}
                    placeholder="Nguyễn Văn A"
                    value={form.fullName}
                    onChange={(event) => handleChange('fullName', event.target.value)}
                    onBlur={() => validateContactFields(['fullName'])}
                  />
                  {fieldErrors.fullName ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{fieldErrors.fullName}</p> : null}
                </div>
                <div>
                  <label className={labelClass}>Số điện thoại liên hệ *</label>
                  <input
                    className={inputClass}
                    placeholder="0912345678"
                    value={form.loginPhone}
                    onChange={(event) => handleChange('loginPhone', event.target.value)}
                    onBlur={() => validateContactFields(['loginPhone'])}
                  />
                  {fieldErrors.loginPhone ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{fieldErrors.loginPhone}</p> : null}
                  {phoneError ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{phoneError}</p> : null}
                </div>
                <div>
                  <label className={labelClass}>Chức vụ người liên hệ</label>
                  <input className={inputClass} placeholder="Giám đốc kinh doanh" value={contactPosition} onChange={(event) => setContactPosition(event.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Email đăng nhập *</label>
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      placeholder="name@company.com"
                      value={form.loginEmail}
                      onChange={(event) => handleChange('loginEmail', event.target.value.toLowerCase())}
                      onBlur={() => validateContactFields(['loginEmail'])}
                    />
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={sendingOtp || !canSendOtp}
                      className="shrink-0 rounded-lg border border-[#2F8F3A] px-3 text-[12px] font-semibold text-[#2F8F3A] disabled:opacity-60"
                    >
                      {sendingOtp ? 'Đang gửi...' : 'Gửi OTP'}
                    </button>
                  </div>
                  {fieldErrors.loginEmail ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{fieldErrors.loginEmail}</p> : null}
                  {emailError ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{emailError}</p> : null}
                  {otpMessage ? <p className="mt-1 text-xs font-semibold text-[#2F8F3A]">{otpMessage}</p> : null}
                </div>
                <div>
                  <label className={labelClass}>Mã OTP email *</label>
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      placeholder="Nhập mã 6 số"
                      value={form.emailOtp}
                      onChange={(event) => handleChange('emailOtp', event.target.value.replace(/\D/g, '').slice(0, 6))}
                      onBlur={() => validateContactFields(['emailOtp'])}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={verifyingOtp}
                      className="shrink-0 rounded-lg bg-[#2F8F3A] px-3 text-[12px] font-semibold text-white disabled:opacity-60"
                    >
                      {verifyingOtp ? 'Đang kiểm tra...' : 'Xác thực'}
                    </button>
                  </div>
                  {fieldErrors.emailOtp ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{fieldErrors.emailOtp}</p> : null}
                  {otpVerifiedEmail === form.loginEmail.trim().toLowerCase() ? <p className="mt-1 text-xs font-semibold text-[#2F8F3A]">Email đã xác thực OTP.</p> : null}
                </div>
                <div>
                  <label className={labelClass}>Số CCCD {currentRole === 'supplier' ? '*' : '(không bắt buộc)'}</label>
                  <input
                    className={inputClass}
                    placeholder="012345678901"
                    value={form.citizenId}
                    onChange={(event) => handleChange('citizenId', event.target.value)}
                    onBlur={() => validateContactFields(['citizenId'])}
                  />
                  {fieldErrors.citizenId ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{fieldErrors.citizenId}</p> : null}
                  {citizenError ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{citizenError}</p> : null}
                </div>
                <div>
                  <label className={labelClass}>Mật khẩu *</label>
                  <div className="relative">
                    <input
                      className={`${inputClass} pr-9`}
                      placeholder="••••••••••"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(event) => handleChange('password', event.target.value)}
                      onBlur={() => validateContactFields(['password', 'confirmPassword'])}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#667085]"
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{fieldErrors.password}</p> : null}
                  <ul className="mt-1 space-y-0.5 text-[11px] font-semibold">
                    {passwordChecks.map((requirement) => (
                      <li key={requirement.key} className={requirement.met ? 'text-[#2F8F3A]' : 'text-[#667085]'}>
                        {requirement.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <label className={labelClass}>Nhập lại mật khẩu *</label>
                  <div className="relative">
                    <input
                      className={`${inputClass} pr-9`}
                      placeholder="••••••••••"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={(event) => handleChange('confirmPassword', event.target.value)}
                      onBlur={() => validateContactFields(['confirmPassword'])}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#667085]"
                      aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword ? <p className="mt-1 text-xs font-semibold text-[#DC2626]">{fieldErrors.confirmPassword}</p> : null}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-[11px] text-[#667085]">
                {currentRole === 'supplier'
                  ? 'Nhà cung cấp: CCCD và giấy phép là bắt buộc để duyệt.'
                  : 'Nhà buôn: tài liệu không bắt buộc, có thể bỏ qua để dùng ngay.'}
              </p>

              <div className="space-y-4">
                {renderDocumentUpload('identityDocumentUrl', 'CCCD mặt trước ', true, 'Chọn tệp CCCD mặt trước để tải lên')}
                {renderDocumentUpload('identityDocumentBackUrl', 'CCCD mặt sau ', true, 'Chọn tệp CCCD mặt sau để tải lên')}
                {renderDocumentUpload('businessDocumentUrl', 'Giấy phép kinh doanh ', isBusinessDocumentRequired, 'Tải lên giấy phép kinh doanh')}
              </div>

              <div className="hidden">
                <div>
                  <label className={labelClass}>Xác minh danh tính người đăng ký (CCCD/Hộ chiếu){currentRole === 'supplier' ? '*' : '(không bắt buộc)'}</label>
                  <label className={uploadBoxClass}>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={(event) => handleFileUpload('identityDocumentUrl', event.target.files?.[0])} />
                    <UploadCloud className="mx-auto h-6 w-6 text-[#98A2B3]" />
                    <p className="mt-1 text-xs font-semibold text-[#344054]">{uploadingField === 'identityDocumentUrl' ? 'Đang upload...' : 'Chọn tệp định danh để tải lên'}</p>
                    <p className="text-[11px] text-[#98A2B3]">PNG, JPG hoặc PDF (tối đa 10MB)</p>
                  </label>
                  {form.identityDocumentUrl ? <p className="mt-1 text-xs text-[#2F8F3A]">Đã tải lên tệp định danh.</p> : null}
                </div>

                <div>
                  <label className={labelClass}>Giấy phép kinh doanh / Tài liệu (không bắt buộc)</label>
                  <label className={uploadBoxClass}>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={(event) => handleFileUpload('businessDocumentUrl', event.target.files?.[0])} />
                    <UploadCloud className="mx-auto h-6 w-6 text-[#98A2B3]" />
                    <p className="mt-1 text-xs font-semibold text-[#344054]">{uploadingField === 'businessDocumentUrl' ? 'Đang upload...' : 'Tải lên giấy phép kinh doanh'}</p>
                    <p className="text-[11px] text-[#98A2B3]">PNG, JPG hoặc PDF (tối đa 10MB)</p>
                  </label>
                  {form.businessDocumentUrl ? <p className="mt-1 text-xs text-[#2F8F3A]">Đã tải lên tài liệu doanh nghiệp.</p> : null}
                </div>
              </div>
            </div>
          )}

          <label className="mt-3 flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border border-[#D9E1EA] accent-[#2F8F3A]"
              checked={form.agreedTerms}
              onChange={(event) => handleChange('agreedTerms', event.target.checked)}
            />
            <span className="text-xs leading-5 text-[#667085]">
              Tôi cam kết rằng các thông tin cung cấp là chính xác và đồng ý với{' '}
              <a href="#" className="font-semibold text-[#2F8F3A]">Điều khoản dịch vụ</a> và{' '}
              <a href="#" className="font-semibold text-[#2F8F3A]">Chính sách bảo vệ dữ liệu</a> của AgriBridge.
            </span>
          </label>
          {fieldErrors.agreedTerms ? <p className="mt-2 text-xs font-semibold text-[#DC2626]">{fieldErrors.agreedTerms}</p> : null}

          {error ? <p className="mt-4 text-sm font-semibold text-[#DC2626]">{error}</p> : null}
          {resultHint ? <p className="mt-2 text-xs font-semibold text-[#2F8F3A]">{resultHint}</p> : null}

          <div className="mt-4 flex items-center justify-between border-t border-[#E6ECF2] pt-3">
            <Link to={`/onboarding/${currentRole}/business-info`} className="inline-flex items-center gap-2 font-semibold text-[#344054] hover:text-[#0F172A]">
              Quay lại
            </Link>

            {step === 1 ? (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={!isAccountStepValid}
                className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-[#2F8F3A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#277A31] disabled:cursor-not-allowed disabled:bg-[#93c5a1]"
              >
                Tiếp tục đến tài liệu
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {currentRole === 'buyer' ? (
                  <button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    disabled={submitting || !isDocumentStepValid}
                    className="inline-flex min-w-24 items-center justify-center rounded-lg border border-[#D9E1EA] bg-white px-3 py-2 text-xs font-semibold text-[#344054]"
                  >
                    Bỏ qua
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting || !isDocumentStepValid}
                  className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-[#2F8F3A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#277A31] disabled:cursor-not-allowed disabled:bg-[#93c5a1]"
                >
                  {submitting ? 'Đang gửi...' : 'Hoàn tất đăng ký'}
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
