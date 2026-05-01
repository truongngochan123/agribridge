import { AlertCircle, FileWarning, Loader2, LogOut, Send, Trash2, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { VN_ADDRESS_OPTIONS } from '../../data/vnAddress'
import { clearAuthSession, getStoredAuthSession, storeAuthSession } from '../../services/authSession'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  fetchRegistrationResubmitDraft,
  normalizeUploadedUrls,
  submitRegistrationResubmission,
  type RegistrationResubmitDraft,
} from '../../services/registrationService'
import { uploadRegistrationFile } from '../../services/uploadService'
import {
  fetchVietnamProvinces,
  findProvinceByName,
  type VietnamProvinceOption,
} from '../../services/vietnamAddressService'

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:ring-2'
const textAreaClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none ring-emerald-200 focus:ring-2'
const uploadBoxClass =
  'flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50/50'
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

type FormState = {
  companyId: number
  userId: number
  companyType: 'supplier' | 'buyer'
  companyName: string
  ownerName: string
  fullName: string
  loginPhone: string
  loginEmail: string
  citizenId: string
  taxCode: string
  registrationNumber: string
  companyPhone: string
  companyEmail: string
  address: string
  province: string
  district: string
  description: string
  logoUrl: string
  documentUrls: string[]
}

function buildFormState(draft: RegistrationResubmitDraft): FormState {
  return {
    companyId: draft.companyId,
    userId: draft.userId,
    companyType: draft.companyType,
    companyName: draft.companyName,
    ownerName: draft.ownerName,
    fullName: draft.fullName,
    loginPhone: draft.loginPhone,
    loginEmail: draft.loginEmail ?? '',
    citizenId: draft.citizenId ?? '',
    taxCode: draft.taxCode ?? '',
    registrationNumber: draft.registrationNumber ?? '',
    companyPhone: draft.companyPhone ?? draft.loginPhone,
    companyEmail: draft.companyEmail ?? draft.loginEmail ?? '',
    address: draft.address,
    province: draft.province,
    district: draft.district ?? '',
    description: draft.description ?? '',
    logoUrl: draft.logoUrl ?? '',
    documentUrls: draft.documents.map((item) => item.fileUrl),
  }
}

export function RegistrationNeedMoreInfoPage() {
  usePageTitle('Cập nhật thêm thông tin')
  const navigate = useNavigate()
  const session = getStoredAuthSession()
  const [draft, setDraft] = useState<RegistrationResubmitDraft | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [provinceOptions, setProvinceOptions] = useState<VietnamProvinceOption[]>([])
  const [districtOptions, setDistrictOptions] = useState<string[]>([])
  const [loadingAddressOptions, setLoadingAddressOptions] = useState(false)
  const [addressLoadError, setAddressLoadError] = useState('')

  useEffect(() => {
    async function loadDraft() {
      if (!session?.companyId || !session.userId) {
        navigate('/auth/login', { replace: true })
        return
      }
      try {
        setLoading(true)
        setError('')
        const payload = await fetchRegistrationResubmitDraft(session.companyId, session.userId)
        setDraft(payload)
        setForm(buildFormState(payload))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Kh�ng t?i du?c h? so c?n b? sung.')
      } finally {
        setLoading(false)
      }
    }

    loadDraft()
  }, [navigate, session?.companyId, session?.userId])

  const selectedProvince = useMemo(
    () => findProvinceByName(provinceOptions, form?.province),
    [form?.province, provinceOptions],
  )

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
          setAddressLoadError('Khong the tai danh sach tinh/thanh tu API. Dang dung danh sach du phong.')
          setProvinceOptions(VN_ADDRESS_OPTIONS.map((item, index) => ({ code: -(index + 1), name: item.province })))
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
    const provinceName = form?.province ?? ''

    async function loadDistricts() {
      if (!provinceName.trim()) {
        setDistrictOptions([])
        return
      }

      if (!selectedProvince || selectedProvince.code <= 0) {
        const fallbackDistricts =
          VN_ADDRESS_OPTIONS.find((item) => item.province === provinceName)?.districts ?? []
        setDistrictOptions(fallbackDistricts)
        return
      }
    }

    void loadDistricts()
  }, [form?.province, selectedProvince])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  async function handleUploadLogo(file?: File) {
    if (!file || !form) return
    if (!file.type.startsWith('image/')) {
      setError('Logo phải là file ảnh.')
      return
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError('Logo phải nhỏ hơn 5MB.')
      return
    }
    try {
      setUploadingLogo(true)
      setError('')
      const uploaded = await uploadRegistrationFile(file)
      updateField('logoUrl', uploaded.url)
    } catch {
      setError('Không upload được logo. Vui lòng thử lại.')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleUploadDocument(file?: File) {
    if (!file || !form) return
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImage && !isPdf) {
      setError('Tài liệu phải là PNG, JPG hoặc PDF.')
      return
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError('Tài liệu phải nhỏ hơn hoặc bằng 5MB.')
      return
    }
    try {
      setUploadingDocument(true)
      setError('')
      const uploaded = await uploadRegistrationFile(file)
      updateField('documentUrls', [...form.documentUrls, uploaded.url])
    } catch {
      setError('Không upload được tài liệu. Vui lòng thử lại.')
    } finally {
      setUploadingDocument(false)
    }
  }

  function removeDocument(url: string) {
    if (!form) return
    updateField(
      'documentUrls',
      form.documentUrls.filter((item) => item !== url),
    )
  }

  async function handleSubmit() {
    if (!form) return
    if (!form.companyName.trim() || !form.ownerName.trim() || !form.fullName.trim()) {
      setError('Vui lòng nhập đầy đủ tên doanh nghiệp, người đại diện và họ tên tài khoản.')
      return
    }
    if (!form.loginPhone.trim() || !form.address.trim() || !form.province.trim()) {
      setError('Vui lòng nhập số điện thoại, địa chỉ và tỉnh / thành.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')
      const response = await submitRegistrationResubmission({
        companyId: form.companyId,
        userId: form.userId,
        companyName: form.companyName,
        ownerName: form.ownerName,
        fullName: form.fullName,
        loginPhone: form.loginPhone,
        loginEmail: form.loginEmail || undefined,
        citizenId: form.citizenId || undefined,
        taxCode: form.taxCode || undefined,
        registrationNumber: form.registrationNumber || undefined,
        companyPhone: form.companyPhone || undefined,
        companyEmail: form.companyEmail || undefined,
        address: form.address,
        province: form.province,
        district: form.district || undefined,
        description: form.description || undefined,
        logoUrl: form.logoUrl || undefined,
        documentUrls: normalizeUploadedUrls(form.documentUrls),
      })
      storeAuthSession(response, form.loginPhone)
      setSuccess('Hồ sơ đã được gửi lại và đang chờ duyệt.')
      window.setTimeout(() => {
        navigate('/onboarding/verification/pending', { replace: true })
      }, 900)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không gửi lại được hồ sơ.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleLogout() {
    clearAuthSession()
    navigate('/auth/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> �ang t?i h? so cần bổ sung...
        </div>
      </div>
    )
  }

  if (!draft || !form) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <p className="text-lg font-bold text-red-700">{error || 'Kh�ng t�m th?y h? so d? b? sung.'}</p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => navigate('/auth/login', { replace: true })} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
              Quay l?i dang nh?p
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Tài khoản của bạn cần bổ sung hồ sơ trước khi có thể sử dụng hệ thống. Chỉ trang này và đang xuất đăng nhập được mở.
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <FileWarning className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600">H? so c?n b? sung</p>
                <h1 className="mt-2 text-3xl font-extrabold text-slate-900">C?p nh?t h? so doanh nghi?p d? g?i l?i x�t duy?t</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Vui lòng cập nhật thông tin doanh nghiệp, giấy tờ và tài liệu theo yêu cầu của admin. Sau khi gửi lại,
                  hồ sơ sẽ chuyển vào trạng thái chờ duyệt và bạn chưa thể sử dụng các module chính cho đến khi được phê duyệt.
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              <LogOut className="h-4 w-4" /> �ang xu?t
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <p className="font-bold text-slate-900">Y�u c?u b? sung t? admin</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {draft.verificationNote?.trim() || 'Admin chua d? l?i ghi ch� chi ti?t.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="T�n ph�p l� doanh nghi?p *">
                <input className={inputClass} value={form.companyName} onChange={(event) => updateField('companyName', event.target.value)} />
              </Field>
              <Field label="Ngu?i d?i di?n *">
                <input className={inputClass} value={form.ownerName} onChange={(event) => updateField('ownerName', event.target.value)} />
              </Field>
              <Field label="H? t�n t�i kho?n *">
                <input className={inputClass} value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} />
              </Field>
              <Field label="S? di?n tho?i dang nh?p *">
                <input className={inputClass} value={form.loginPhone} onChange={(event) => updateField('loginPhone', event.target.value)} />
              </Field>
              <Field label="Email dang nh?p">
                <input className={inputClass} value={form.loginEmail} onChange={(event) => updateField('loginEmail', event.target.value)} />
              </Field>
              <Field label="CCCD / CMND">
                <input className={inputClass} value={form.citizenId} onChange={(event) => updateField('citizenId', event.target.value)} />
              </Field>
              <Field label="M� s? thu?">
                <input className={inputClass} value={form.taxCode} onChange={(event) => updateField('taxCode', event.target.value)} />
              </Field>
              <Field label="S? gi?y dang k� kinh doanh">
                <input className={inputClass} value={form.registrationNumber} onChange={(event) => updateField('registrationNumber', event.target.value)} />
              </Field>
              <Field label="S? di?n tho?i doanh nghi?p">
                <input className={inputClass} value={form.companyPhone} onChange={(event) => updateField('companyPhone', event.target.value)} />
              </Field>
              <Field label="Email doanh nghi?p">
                <input className={inputClass} value={form.companyEmail} onChange={(event) => updateField('companyEmail', event.target.value)} />
              </Field>
              <Field label="T?nh / Th�nh *">
                <select className={inputClass} value={form.province} onChange={(event) => updateField('province', event.target.value)}>
                  <option value="">Ch?n t?nh / th�nh</option>
                  {provinceOptions.map((item) => (
                    <option key={item.code} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {loadingAddressOptions ? <p className="mt-1 text-xs text-slate-500">Dang tai danh sach tinh/thanh...</p> : null}
                {!loadingAddressOptions && addressLoadError ? <p className="mt-1 text-xs text-slate-500">{addressLoadError}</p> : null}
              </Field>
              <Field label="Qu?n / Huy?n">
                <select className={inputClass} value={form.district} onChange={(event) => updateField('district', event.target.value)}>
                  <option value="">Ch?n qu?n / huy?n</option>
                  {districtOptions.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="�?a ch? chi ti?t *">
              <input className={inputClass} value={form.address} onChange={(event) => updateField('address', event.target.value)} />
            </Field>

            <Field label="M� t? doanh nghi?p">
              <textarea rows={4} className={textAreaClass} value={form.description} onChange={(event) => updateField('description', event.target.value)} />
            </Field>
          </div>

          <div className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-extrabold text-slate-900">Logo v� gi?y t?</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Logo doanh nghi?p</p>
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="Logo doanh nghi?p" className="mb-3 h-40 w-full rounded-2xl border border-slate-200 object-cover" />
                  ) : (
                    <div className="mb-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      Chua c� logo
                    </div>
                  )}
                  <label className={uploadBoxClass}>
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => handleUploadLogo(event.target.files?.[0])} />
                    <span className="inline-flex items-center gap-2">
                      <UploadCloud className="h-4 w-4" /> {uploadingLogo ? '�ang upload logo...' : 'Upload / thay logo'}
                    </span>
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Gi?y t? d� upload</p>
                  <div className="space-y-2">
                    {form.documentUrls.length > 0 ? (
                      form.documentUrls.map((url) => (
                        <div key={url} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <a href={url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-blue-600 hover:underline">
                            {url.split('/').pop() || 'document'}
                          </a>
                          <button onClick={() => removeDocument(url)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        Chua c� gi?y t? n�o sau khi b? sung.
                      </div>
                    )}
                  </div>
                  <label className={`${uploadBoxClass} mt-3`}>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={(event) => handleUploadDocument(event.target.files?.[0])} />
                    <span className="inline-flex items-center gap-2">
                      <UploadCloud className="h-4 w-4" /> {uploadingDocument ? '�ang upload t�i li?u...' : 'Upload th�m gi?y t?'}
                    </span>
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-extrabold text-slate-900">Tr?ng th�i hi?n t?i</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <InfoRow label="Lo?i t�i kho?n" value={form.companyType === 'supplier' ? 'Nh� cung c?p' : 'Nh� bu�n'} />
                <InfoRow label="Tr?ng th�i h? so" value="C?n b? sung" />
                <InfoRow label="T�i li?u hi?n c�" value={String(form.documentUrls.length)} />
              </dl>
            </section>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
        {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</div> : null}

        <div className="flex flex-wrap justify-between gap-3">
          <Link to="/support" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300">
            Li�n h? h? tr?
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploadingLogo || uploadingDocument}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? '�ang g?i l?i h? so...' : 'G?i l?i h? so'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
