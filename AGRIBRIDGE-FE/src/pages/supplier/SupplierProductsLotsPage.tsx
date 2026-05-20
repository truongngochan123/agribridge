import { ExternalLink, Loader2, Plus, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SupplierPanel, SupplierStatusPill } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useNotificationModuleRefresh } from '../../hooks/useNotificationModuleRefresh'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  createBatchForExistingProduct,
  createSupplierCategory,
  createProductWithFirstBatch,
  fetchCategories,
  fetchCertificationNames,
  fetchMetadataProvinces,
  fetchMetadataUnits,
  fetchSupplierProducts,
} from '../../services/supplierService'
import { uploadSupplierDocument } from '../../services/uploadService'
import type {
  CategoryOption,
  CreateBatchForProductRequest,
  CreateBatchPayload,
  CreateProductCertificationPayload,
  CreateProductWithFirstBatchRequest,
  SupplierCreateFlowResponse,
  SupplierProductOption,
} from '../../types/supplierCreateFlow'
import { useSupplierDashboardData } from './useSupplierDashboardData'

type CertificationFormItem = {
  id: string
  optionName: string
  customName: string
  documentUrl: string
  issuedBy: string
  issuedDate: string
  expiryDate: string
  uploading: boolean
}

type ProductFormState = {
  name: string
  categoryId: string
  unit: string
  originProvince: string
  description: string
  imageUrl: string
  uploadingImage: boolean
  certifications: CertificationFormItem[]
}

type BatchFormState = {
  harvestDate: string
  expiryDate: string
  grade: 'A' | 'B' | 'C' | ''
  size: string
  quantity: string
  price: string
  moq: string
  storageTemp: string
  videoUrl: string
  qcResult: 'PASS' | 'FAIL' | ''
  qcDocumentUrl: string
  qcNotes: string
  uploadingQc: boolean
}

const STORAGE_TEMP_REGEX = /^-?\d{1,2}(?:\.\d)?\s*°?C(?:\s*(?:-|đến|to)\s*-?\d{1,2}(?:\.\d)?\s*°?C)?$/i

function createEmptyCertification(): CertificationFormItem {
  return {
    id: String(Date.now()) + Math.random().toString(16).slice(2),
    optionName: '',
    customName: '',
    documentUrl: '',
    issuedBy: '',
    issuedDate: '',
    expiryDate: '',
    uploading: false,
  }
}

function createDefaultProductForm(): ProductFormState {
  return {
    name: '',
    categoryId: '',
    unit: '',
    originProvince: '',
    description: '',
    imageUrl: '',
    uploadingImage: false,
    certifications: [createEmptyCertification()],
  }
}

function createDefaultBatchForm(): BatchFormState {
  return {
    harvestDate: '',
    expiryDate: '',
    grade: '',
    size: '',
    quantity: '',
    price: '',
    moq: '',
    storageTemp: '',
    videoUrl: '',
    qcResult: '',
    qcDocumentUrl: '',
    qcNotes: '',
    uploadingQc: false,
  }
}

export function SupplierProductsLotsPage() {
  usePageTitle('Sản phẩm & Lô hàng')
  const { data, loading, error } = useSupplierDashboardData()
  const lots = data?.productLots ?? []

  const [openAddProduct, setOpenAddProduct] = useState(false)
  const [addStep, setAddStep] = useState<1 | 2>(1)
  const [openCreateLotForm, setOpenCreateLotForm] = useState(false)

  const [units, setUnits] = useState<string[]>([])
  const [provinces, setProvinces] = useState<string[]>([])
  const [certificationNames, setCertificationNames] = useState<string[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [supplierProducts, setSupplierProducts] = useState<SupplierProductOption[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryError, setNewCategoryError] = useState('')
  const [createCategoryLoading, setCreateCategoryLoading] = useState(false)

  const [productForm, setProductForm] = useState<ProductFormState>(createDefaultProductForm)
  const [batchFormForNewProduct, setBatchFormForNewProduct] = useState<BatchFormState>(createDefaultBatchForm)
  const [batchFormForExistingProduct, setBatchFormForExistingProduct] = useState<BatchFormState>(createDefaultBatchForm)

  const [selectedExistingProductId, setSelectedExistingProductId] = useState<string>('')

  const [productErrors, setProductErrors] = useState<Record<string, string>>({})
  const [batchErrors, setBatchErrors] = useState<Record<string, string>>({})
  const [existingBatchErrors, setExistingBatchErrors] = useState<Record<string, string>>({})

  const [submitLoading, setSubmitLoading] = useState(false)
  const [flowMessage, setFlowMessage] = useState('')
  const [createdResult, setCreatedResult] = useState<SupplierCreateFlowResponse | null>(null)
  const [productReloadToken, setProductReloadToken] = useState(0)

  const companyId = Number(localStorage.getItem('agribridge.auth.companyId') ?? 0)
  const userId = Number(localStorage.getItem('agribridge.auth.userId') ?? 0)

  const selectedExistingProduct = useMemo(
    () => supplierProducts.find((item) => item.id === Number(selectedExistingProductId)) ?? null,
    [selectedExistingProductId, supplierProducts],
  )

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [loadedUnits, loadedProvinces, loadedCertNames, loadedCategories] = await Promise.all([
          fetchMetadataUnits(),
          fetchMetadataProvinces(),
          fetchCertificationNames(),
          fetchCategories(userId || undefined),
        ])
        setUnits(loadedUnits)
        setProvinces(loadedProvinces)
        setCertificationNames(loadedCertNames)
        setCategories(loadedCategories)
      } catch {
        setFlowMessage('Không thể tải metadata (đơn vị, tỉnh/thành, danh mục).')
      }
    }

    void loadMetadata()
  }, [userId])

  useEffect(() => {
    if (!companyId) {
      setSupplierProducts([])
      return
    }

    const loadProducts = async () => {
      try {
        const products = await fetchSupplierProducts(companyId)
        setSupplierProducts(products)
        if (products.length > 0) {
          setSelectedExistingProductId(String(products[0].id))
        }
      } catch {
        setFlowMessage('Không thể tải danh sách sản phẩm hiện có.')
      }
    }

    void loadProducts()
  }, [companyId, productReloadToken])

  useNotificationModuleRefresh(['INVENTORY', 'SOURCING'], () => setProductReloadToken((value) => value + 1))

  const resetCreateProductFlow = () => {
    setAddStep(1)
    setProductForm(createDefaultProductForm())
    setBatchFormForNewProduct(createDefaultBatchForm())
    setProductErrors({})
    setBatchErrors({})
    setNewCategoryName('')
    setNewCategoryError('')
  }

  const resetCreateBatchFlow = () => {
    setBatchFormForExistingProduct(createDefaultBatchForm())
    setExistingBatchErrors({})
  }

  const buildCertificationPayload = (items: CertificationFormItem[]): CreateProductCertificationPayload[] => {
    return items
      .map((item) => {
        const selectedName = item.optionName === '__custom__' ? item.customName : item.optionName
        return {
          name: selectedName.trim(),
          documentUrl: item.documentUrl.trim() || undefined,
          issuedBy: item.issuedBy.trim() || undefined,
          issuedDate: item.issuedDate || undefined,
          expiryDate: item.expiryDate || undefined,
        }
      })
      .filter((item) => item.name.length > 0)
  }

  const validateProductStep = (): boolean => {
    const errors: Record<string, string> = {}

    if (!productForm.name.trim()) {
      errors.name = 'Tên sản phẩm là bắt buộc.'
    }
    if (!productForm.categoryId) {
      errors.categoryId = 'Danh mục là bắt buộc.'
    }
    if (!productForm.unit) {
      errors.unit = 'Đơn vị tính là bắt buộc.'
    }
    if (!productForm.originProvince) {
      errors.originProvince = 'Xuất xứ tỉnh/thành là bắt buộc.'
    }

    productForm.certifications.forEach((cert, index) => {
      const fieldPrefix = `cert_${index}`
      const certName = cert.optionName === '__custom__' ? cert.customName.trim() : cert.optionName.trim()

      if (cert.optionName === '__custom__' && !cert.customName.trim()) {
        errors[`${fieldPrefix}_customName`] = 'Vui lòng nhập tên chứng nhận tùy chỉnh.'
      }
      if (cert.expiryDate && !cert.issuedDate) {
        errors[`${fieldPrefix}_issuedDate`] = 'Có ngày hết hạn thì bắt buộc có ngày cấp.'
      }
      if (cert.expiryDate && cert.issuedDate && cert.expiryDate <= cert.issuedDate) {
        errors[`${fieldPrefix}_expiryDate`] = 'Ngày hết hạn phải sau ngày cấp.'
      }
      if (!certName && (cert.issuedBy || cert.issuedDate || cert.expiryDate || cert.documentUrl)) {
        errors[`${fieldPrefix}_name`] = 'Vui lòng chọn tên chứng nhận.'
      }
    })

    setProductErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateBatchStep = (form: BatchFormState, setErrors: (errors: Record<string, string>) => void): boolean => {
    const errors: Record<string, string> = {}

    if (!form.harvestDate) {
      errors.harvestDate = 'Ngày thu hoạch là bắt buộc.'
    }
    if (!form.grade) {
      errors.grade = 'Grade là bắt buộc.'
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      errors.quantity = 'Tồn kho phải lớn hơn 0.'
    }
    if (!form.price || Number(form.price) <= 0) {
      errors.price = 'Giá bán phải lớn hơn 0.'
    }
    if (form.moq && Number(form.moq) < 0) {
      errors.moq = 'MOQ không được âm.'
    }
    if (form.expiryDate && form.harvestDate && form.expiryDate < form.harvestDate) {
      errors.expiryDate = 'Hạn sử dụng phải sau ngày thu hoạch.'
    }
    if (form.storageTemp && !STORAGE_TEMP_REGEX.test(form.storageTemp.trim())) {
      errors.storageTemp = 'Định dạng nhiệt độ chưa hợp lệ. Ví dụ: -18°C hoặc 2-4°C.'
    }
    if (form.videoUrl) {
      try {
        const url = new URL(form.videoUrl)
        if (!url.protocol.startsWith('http')) {
          errors.videoUrl = 'Video URL phải bắt đầu bằng http/https.'
        }
      } catch {
        errors.videoUrl = 'Video URL không hợp lệ.'
      }
    }

    if (!form.qcResult) {
      errors.qcResult = 'Kết quả QC là bắt buộc.'
    }
    if (form.qcResult === 'PASS' && !form.qcDocumentUrl.trim()) {
      errors.qcDocumentUrl = 'PASS bắt buộc có file QC.'
    }
    if (form.qcResult === 'FAIL' && !form.qcNotes.trim()) {
      errors.qcNotes = 'FAIL bắt buộc có ghi chú QC.'
    }

    setErrors(errors)
    return Object.keys(errors).length === 0
  }

  const toCreateBatchPayload = (form: BatchFormState): CreateBatchPayload => {
    return {
      harvestDate: form.harvestDate,
      expiryDate: form.expiryDate || undefined,
      grade: form.grade as 'A' | 'B' | 'C',
      size: form.size.trim() || undefined,
      quantity: Number(form.quantity),
      price: Number(form.price),
      moq: form.moq ? Number(form.moq) : 0,
      storageTemp: form.storageTemp.trim() || undefined,
      videoUrl: form.videoUrl.trim() || undefined,
      qc: {
        result: form.qcResult as 'PASS' | 'FAIL',
        documentUrl: form.qcDocumentUrl.trim() || undefined,
        notes: form.qcNotes.trim() || undefined,
      },
    }
  }

  const handleUploadFile = async (
    file: File,
    onUploadingChange: (uploading: boolean) => void,
    onSuccess: (url: string) => void,
  ) => {
    onUploadingChange(true)
    try {
      const uploaded = await uploadSupplierDocument(file)
      onSuccess(uploaded.url)
    } catch {
      setFlowMessage('Upload file thất bại. Vui lòng thử lại.')
    } finally {
      onUploadingChange(false)
    }
  }

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (!userId) {
      setNewCategoryError('Thiếu thông tin người dùng.')
      return
    }
    if (!name) {
      setNewCategoryError('Vui lòng nhập tên danh mục.')
      return
    }
    if (categories.some((category) => category.name.trim().toLowerCase() === name.toLowerCase())) {
      setNewCategoryError('Danh mục đã tồn tại trong tài khoản này.')
      return
    }

    setCreateCategoryLoading(true)
    setNewCategoryError('')
    try {
      const created = await createSupplierCategory({ userId, name })
      const nextCategories = await fetchCategories(userId)
      setCategories(nextCategories)
      setProductForm((prev) => ({ ...prev, categoryId: String(created.id) }))
      setNewCategoryName('')
      setFlowMessage('Đã thêm danh mục mới.')
    } catch {
      setNewCategoryError('Không thể thêm danh mục. Vui lòng kiểm tra tên có bị trùng không.')
    } finally {
      setCreateCategoryLoading(false)
    }
  }

  const handleCreateProductAndBatch = async () => {
    if (!companyId || !userId) {
      setFlowMessage('Thiếu thông tin đăng nhập phiên hiện tại. Vui lòng đăng nhập lại.')
      return
    }
    if (!validateProductStep()) {
      setFlowMessage('Vui lòng kiểm tra dữ liệu Step 1.')
      return
    }
    if (!validateBatchStep(batchFormForNewProduct, setBatchErrors)) {
      setFlowMessage('Vui lòng kiểm tra dữ liệu Step 2.')
      return
    }

    setSubmitLoading(true)
    setFlowMessage('')

    try {
      const payload: CreateProductWithFirstBatchRequest = {
        supplierCompanyId: companyId,
        userId,
        product: {
          name: productForm.name.trim(),
          categoryId: Number(productForm.categoryId),
          unit: productForm.unit,
          originProvince: productForm.originProvince,
          description: productForm.description.trim() || undefined,
          imageUrl: productForm.imageUrl.trim() || undefined,
          certifications: buildCertificationPayload(productForm.certifications),
        },
        batch: toCreateBatchPayload(batchFormForNewProduct),
      }

      const response = await createProductWithFirstBatch(payload)
      setCreatedResult(response)
      setFlowMessage('Tạo sản phẩm và lô hàng đầu tiên thành công.')
      setOpenAddProduct(false)
      resetCreateProductFlow()

      const products = await fetchSupplierProducts(companyId)
      setSupplierProducts(products)
      if (products.length > 0) {
        setSelectedExistingProductId(String(products[0].id))
      }
    } catch {
      setFlowMessage('Tạo sản phẩm/lô hàng thất bại. Vui lòng kiểm tra dữ liệu và thử lại.')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleCreateBatchOnly = async () => {
    if (!userId) {
      setFlowMessage('Thiếu thông tin người dùng trong phiên đăng nhập.')
      return
    }

    const productId = Number(selectedExistingProductId)
    if (!productId) {
      setExistingBatchErrors({ productId: 'Vui lòng chọn sản phẩm.' })
      return
    }

    if (!validateBatchStep(batchFormForExistingProduct, setExistingBatchErrors)) {
      setFlowMessage('Vui lòng kiểm tra dữ liệu tạo lô hàng.')
      return
    }

    setSubmitLoading(true)
    setFlowMessage('')

    try {
      const payload: CreateBatchForProductRequest = {
        productId,
        userId,
        batch: toCreateBatchPayload(batchFormForExistingProduct),
      }
      const response = await createBatchForExistingProduct(payload)
      setCreatedResult(response)
      setFlowMessage('Tạo lô hàng mới thành công.')
      setOpenCreateLotForm(false)
      resetCreateBatchFlow()
    } catch {
      setFlowMessage('Tạo lô hàng thất bại. Vui lòng thử lại.')
    } finally {
      setSubmitLoading(false)
    }
  }

  const selectedUnitForBatchOnly = selectedExistingProduct?.unit ?? ''

  return (
    <>
      <SupplierShell
        activeKey="products"
        title="Quản lý Sản phẩm & Lô hàng"
        subtitle="Quản lý sản phẩm và lô hàng của bạn"
        actions={
          <div className="flex items-center justify-end gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              onClick={() => {
                setOpenCreateLotForm(true)
                resetCreateBatchFlow()
              }}
            >
              <Plus className="h-4 w-4" />
              Tạo lô hàng mới
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              onClick={() => {
                setOpenAddProduct(true)
                resetCreateProductFlow()
              }}
            >
              <Plus className="h-4 w-4" />
              Thêm sản phẩm mới
            </button>
          </div>
        }
      >
        <SupplierPanel title="Sản phẩm & Lô hàng">
          {flowMessage ? <p className="mb-3 text-sm font-semibold text-emerald-700">{flowMessage}</p> : null}
          {createdResult ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-semibold text-emerald-900">
                Đã tạo: {createdResult.product.name} - {createdResult.batch.batchCode}
              </p>
              <button
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                onClick={() => window.open(`/public/batch/${createdResult.batch.id}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Xem QR truy xuất
              </button>
            </div>
          ) : null}

          {loading ? <p className="mb-3 text-sm font-semibold text-emerald-700">Đang tải dữ liệu realtime...</p> : null}
          {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
          {!loading && !error && lots.length === 0 ? (
            <p className="mb-3 text-sm font-semibold text-slate-600">Chưa có sản phẩm hoặc lô hàng nào cho tài khoản này.</p>
          ) : null}

          <p className="mb-2 text-xs font-semibold text-emerald-700">Tong so lo hang: {lots.length}</p>

          <div className="max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {lots.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-2xl border border-emerald-200 bg-white">
                  <div className="relative h-28 bg-emerald-100/60">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs font-bold text-emerald-700">
                        {item.name}
                      </div>
                    )}
                    <div className="absolute right-3 top-3">
                      <SupplierStatusPill label={item.status} />
                    </div>
                  </div>

                  <div className="p-3">
                    <h3 className="truncate text-[18px] font-bold text-emerald-950">{item.name}</h3>
                    <p className="mt-1 truncate text-xs text-emerald-700/80">Lô hiện tại: {item.lotCode}</p>

                    <div className="mt-2.5 grid grid-cols-2 gap-y-1 text-xs">
                      <p className="text-emerald-900/70">Grade</p>
                      <p className="font-semibold text-emerald-900">{item.grade}</p>
                      <p className="text-emerald-900/70">Size</p>
                      <p className="truncate font-semibold text-emerald-900">{item.size}</p>
                      <p className="text-emerald-900/70">Tồn kho</p>
                      <p className="font-semibold text-emerald-900">{item.stock}</p>
                      <p className="text-emerald-900/70">MOQ</p>
                      <p className="font-semibold text-emerald-900">{item.moq}</p>
                    </div>

                    <div className="mt-2.5 flex items-end justify-between">
                      <p className="text-[28px] font-extrabold leading-none text-emerald-700">{item.price}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </SupplierPanel>
      </SupplierShell>

      {openAddProduct ? (
        <div className="fixed inset-0 z-[80] bg-black/35 p-4">
          <div className="mx-auto mt-5 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white">
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Thêm sản phẩm mới</h3>
                <p className="text-sm text-slate-500">Bước 1 tạo product, bước 2 tạo lô hàng đầu tiên.</p>
              </div>
              <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={() => setOpenAddProduct(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <div className="mb-5 flex gap-2">
                <button
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                    addStep === 1 ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500'
                  }`}
                >
                  1 Thông tin sản phẩm
                </button>
                <button
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                    addStep === 2 ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500'
                  }`}
                >
                  2 Tạo lô hàng
                </button>
              </div>

              {addStep === 1 ? (
                <div className="space-y-4">
                  <InputField
                    label="Tên sản phẩm"
                    required
                    value={productForm.name}
                    onChange={(value) => setProductForm((prev) => ({ ...prev, name: value }))}
                    error={productErrors.name}
                    placeholder="VD: Tôm sú hữu cơ size 1"
                  />

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <SelectField
                        label="Danh mục"
                        required
                        value={productForm.categoryId}
                        onChange={(value) => setProductForm((prev) => ({ ...prev, categoryId: value }))}
                        error={productErrors.categoryId}
                        options={categories.map((category) => ({ value: String(category.id), label: category.name }))}
                        placeholder="-- Chọn danh mục --"
                      />
                      <div className="flex gap-2">
                        <input
                          className={`h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm text-slate-700 ${
                            newCategoryError ? 'border-rose-400' : 'border-slate-300'
                          }`}
                          value={newCategoryName}
                          onChange={(event) => {
                            setNewCategoryName(event.target.value)
                            setNewCategoryError('')
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              void handleCreateCategory()
                            }
                          }}
                          placeholder="Nhập danh mục mới"
                        />
                        <button
                          type="button"
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          onClick={() => void handleCreateCategory()}
                          disabled={createCategoryLoading}
                        >
                          {createCategoryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          Thêm
                        </button>
                      </div>
                      {newCategoryError ? <p className="text-xs font-semibold text-rose-600">{newCategoryError}</p> : null}
                    </div>
                    <SelectField
                      label="Đơn vị tính"
                      required
                      value={productForm.unit}
                      onChange={(value) => setProductForm((prev) => ({ ...prev, unit: value }))}
                      error={productErrors.unit}
                      options={units.map((unit) => ({ value: unit, label: unit }))}
                      placeholder="-- Chọn đơn vị --"
                    />
                  </div>

                  <SelectField
                    label="Xuất xứ tỉnh/thành"
                    required
                    value={productForm.originProvince}
                    onChange={(value) => setProductForm((prev) => ({ ...prev, originProvince: value }))}
                    error={productErrors.originProvince}
                    options={provinces.map((province) => ({ value: province, label: province }))}
                    placeholder="-- Chọn tỉnh/thành --"
                  />

                  <TextareaField
                    label="Mô tả sản phẩm"
                    value={productForm.description}
                    onChange={(value) => setProductForm((prev) => ({ ...prev, description: value }))}
                    placeholder="Mô tả chi tiết về sản phẩm..."
                  />

                  <UploadField
                    title="Hình ảnh sản phẩm"
                    subtitle="PNG, JPG, WEBP tối đa 10MB"
                    uploading={productForm.uploadingImage}
                    fileUrl={productForm.imageUrl}
                    onSelectFile={(file) =>
                      void handleUploadFile(
                        file,
                        (uploading) => setProductForm((prev) => ({ ...prev, uploadingImage: uploading })),
                        (url) => setProductForm((prev) => ({ ...prev, imageUrl: url })),
                      )
                    }
                  />

                  <div className="space-y-3 rounded-xl border border-emerald-200 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-emerald-900">Chứng nhận sản phẩm</p>
                      <button
                        className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700"
                        onClick={() =>
                          setProductForm((prev) => ({
                            ...prev,
                            certifications: [...prev.certifications, createEmptyCertification()],
                          }))
                        }
                      >
                        + Thêm chứng nhận
                      </button>
                    </div>

                    {productForm.certifications.map((item, index) => {
                      const certPrefix = `cert_${index}`
                      const selectedCustom = item.optionName === '__custom__'

                      return (
                        <div key={item.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-700">Chứng nhận {index + 1}</p>
                            {productForm.certifications.length > 1 ? (
                              <button
                                className="text-xs font-semibold text-rose-600"
                                onClick={() =>
                                  setProductForm((prev) => ({
                                    ...prev,
                                    certifications: prev.certifications.filter((cert) => cert.id !== item.id),
                                  }))
                                }
                              >
                                Xóa
                              </button>
                            ) : null}
                          </div>

                          <SelectField
                            label="Tên chứng nhận"
                            value={item.optionName}
                            onChange={(value) => {
                              setProductForm((prev) => ({
                                ...prev,
                                certifications: prev.certifications.map((cert) =>
                                  cert.id === item.id ? { ...cert, optionName: value } : cert,
                                ),
                              }))
                            }}
                            options={[
                              ...certificationNames.map((name) => ({ value: name, label: name })),
                              { value: '__custom__', label: 'Khác (nhập tay)' },
                            ]}
                            placeholder="-- Chọn tên chứng nhận --"
                            error={productErrors[`${certPrefix}_name`]}
                          />

                          {selectedCustom ? (
                            <InputField
                              label="Tên chứng nhận tùy chỉnh"
                              value={item.customName}
                              onChange={(value) => {
                                setProductForm((prev) => ({
                                  ...prev,
                                  certifications: prev.certifications.map((cert) =>
                                    cert.id === item.id ? { ...cert, customName: value } : cert,
                                  ),
                                }))
                              }}
                              error={productErrors[`${certPrefix}_customName`]}
                              placeholder="Nhập tên chứng nhận"
                            />
                          ) : null}

                          <div className="grid gap-2 md:grid-cols-2">
                            <InputField
                              label="Đơn vị cấp"
                              value={item.issuedBy}
                              onChange={(value) => {
                                setProductForm((prev) => ({
                                  ...prev,
                                  certifications: prev.certifications.map((cert) =>
                                    cert.id === item.id ? { ...cert, issuedBy: value } : cert,
                                  ),
                                }))
                              }}
                              placeholder="VD: Bộ NN&PTNT"
                            />
                            <UploadField
                              title="File chứng nhận"
                              subtitle="PDF/JPG/PNG"
                              uploading={item.uploading}
                              fileUrl={item.documentUrl}
                              compact
                              onSelectFile={(file) =>
                                void handleUploadFile(
                                  file,
                                  (uploading) => {
                                    setProductForm((prev) => ({
                                      ...prev,
                                      certifications: prev.certifications.map((cert) =>
                                        cert.id === item.id ? { ...cert, uploading } : cert,
                                      ),
                                    }))
                                  },
                                  (url) => {
                                    setProductForm((prev) => ({
                                      ...prev,
                                      certifications: prev.certifications.map((cert) =>
                                        cert.id === item.id ? { ...cert, documentUrl: url } : cert,
                                      ),
                                    }))
                                  },
                                )
                              }
                            />
                          </div>

                          <div className="grid gap-2 md:grid-cols-2">
                            <InputField
                              label="Ngày cấp"
                              type="date"
                              value={item.issuedDate}
                              onChange={(value) => {
                                setProductForm((prev) => ({
                                  ...prev,
                                  certifications: prev.certifications.map((cert) =>
                                    cert.id === item.id ? { ...cert, issuedDate: value } : cert,
                                  ),
                                }))
                              }}
                              error={productErrors[`${certPrefix}_issuedDate`]}
                            />
                            <InputField
                              label="Ngày hết hạn"
                              type="date"
                              value={item.expiryDate}
                              onChange={(value) => {
                                setProductForm((prev) => ({
                                  ...prev,
                                  certifications: prev.certifications.map((cert) =>
                                    cert.id === item.id ? { ...cert, expiryDate: value } : cert,
                                  ),
                                }))
                              }}
                              error={productErrors[`${certPrefix}_expiryDate`]}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <BatchFormSection
                  form={batchFormForNewProduct}
                  setForm={setBatchFormForNewProduct}
                  errors={batchErrors}
                  unitLabel={productForm.unit}
                  onUploadQc={(file) =>
                    void handleUploadFile(
                      file,
                      (uploading) => setBatchFormForNewProduct((prev) => ({ ...prev, uploadingQc: uploading })),
                      (url) => setBatchFormForNewProduct((prev) => ({ ...prev, qcDocumentUrl: url })),
                    )
                  }
                />
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm font-semibold text-slate-700"
                onClick={() => setOpenAddProduct(false)}
              >
                Hủy
              </button>
              {addStep === 1 ? (
                <button
                  className="rounded-lg bg-emerald-500 px-6 py-2 text-sm font-semibold text-white"
                  onClick={() => {
                    if (validateProductStep()) {
                      setFlowMessage('')
                      setAddStep(2)
                    }
                  }}
                >
                  Tiếp theo: Tạo lô hàng
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm font-semibold text-slate-700"
                    onClick={() => setAddStep(1)}
                  >
                    Quay lại
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    onClick={() => void handleCreateProductAndBatch()}
                    disabled={submitLoading}
                  >
                    {submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Tạo sản phẩm & Lô hàng
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {openCreateLotForm ? (
        <div className="fixed inset-0 z-[80] bg-black/35 p-4">
          <div className="mx-auto mt-6 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white">
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Tạo lô hàng mới</h3>
                <p className="text-sm text-slate-500">Chỉ tạo Batch cho Product có sẵn, không tạo lại Product.</p>
              </div>
              <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={() => setOpenCreateLotForm(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <SelectField
                label="Sản phẩm"
                required
                value={selectedExistingProductId}
                onChange={setSelectedExistingProductId}
                options={supplierProducts.map((product) => ({
                  value: String(product.id),
                  label: `${product.name} (${product.unit})`,
                }))}
                placeholder="-- Chọn sản phẩm --"
                error={existingBatchErrors.productId}
              />

              <BatchFormSection
                form={batchFormForExistingProduct}
                setForm={setBatchFormForExistingProduct}
                errors={existingBatchErrors}
                unitLabel={selectedUnitForBatchOnly}
                onUploadQc={(file) =>
                  void handleUploadFile(
                    file,
                    (uploading) => setBatchFormForExistingProduct((prev) => ({ ...prev, uploadingQc: uploading })),
                    (url) => setBatchFormForExistingProduct((prev) => ({ ...prev, qcDocumentUrl: url })),
                  )
                }
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm font-semibold text-slate-700"
                onClick={() => setOpenCreateLotForm(false)}
              >
                Hủy
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void handleCreateBatchOnly()}
                disabled={submitLoading}
              >
                {submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Tạo lô hàng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function BatchFormSection({
  form,
  setForm,
  errors,
  unitLabel,
  onUploadQc,
}: {
  form: BatchFormState
  setForm: React.Dispatch<React.SetStateAction<BatchFormState>>
  errors: Record<string, string>
  unitLabel: string
  onUploadQc: (file: File) => void
}) {
  const suffixUnit = unitLabel || 'đơn vị sản phẩm'

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-emerald-700">Mã lô hàng và QR sẽ do backend tự sinh sau khi tạo.</p>

      <div className="grid gap-3 md:grid-cols-2">
        <InputField
          label="Ngày thu hoạch / Đánh bắt"
          required
          type="date"
          value={form.harvestDate}
          onChange={(value) => setForm((prev) => ({ ...prev, harvestDate: value }))}
          error={errors.harvestDate}
        />
        <InputField
          label="Hạn sử dụng"
          type="date"
          value={form.expiryDate}
          onChange={(value) => setForm((prev) => ({ ...prev, expiryDate: value }))}
          error={errors.expiryDate}
        />

        <SelectField
          label="Grade / Phân loại"
          required
          value={form.grade}
          onChange={(value) => setForm((prev) => ({ ...prev, grade: value as 'A' | 'B' | 'C' | '' }))}
          options={[
            { value: 'A', label: 'A' },
            { value: 'B', label: 'B' },
            { value: 'C', label: 'C' },
          ]}
          placeholder="-- Chọn grade --"
          error={errors.grade}
        />
        <InputField
          label="Size / Cỡ"
          value={form.size}
          onChange={(value) => setForm((prev) => ({ ...prev, size: value }))}
          placeholder="VD: 20-25 con/kg"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InputField
          label={`Tồn kho (${suffixUnit})`}
          required
          type="number"
          min={0}
          value={form.quantity}
          onChange={(value) => setForm((prev) => ({ ...prev, quantity: value }))}
          error={errors.quantity}
          placeholder="0"
        />
        <InputField
          label="Giá bán"
          required
          type="number"
          value={form.price}
          onChange={(value) => setForm((prev) => ({ ...prev, price: value }))}
          error={errors.price}
          placeholder="0"
        />
        <InputField
          label={`MOQ tối thiểu (${suffixUnit})`}
          type="number"
          value={form.moq}
          onChange={(value) => setForm((prev) => ({ ...prev, moq: value }))}
          error={errors.moq}
          placeholder="0"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InputField
          label="Nhiệt độ bảo quản"
          value={form.storageTemp}
          onChange={(value) => setForm((prev) => ({ ...prev, storageTemp: value }))}
          error={errors.storageTemp}
          placeholder="VD: -18°C hoặc 2-4°C"
        />
        <InputField
          label="Video lô hàng"
          value={form.videoUrl}
          onChange={(value) => setForm((prev) => ({ ...prev, videoUrl: value }))}
          error={errors.videoUrl}
          placeholder="https://..."
        />
      </div>

      <div className="space-y-3 rounded-lg border border-emerald-200 p-3">
        <p className="text-sm font-bold text-emerald-900">QC kiểm định lô hàng</p>

        <SelectField
          label="Kết quả QC"
          required
          value={form.qcResult}
          onChange={(value) => setForm((prev) => ({ ...prev, qcResult: value as 'PASS' | 'FAIL' | '' }))}
          options={[
            { value: 'PASS', label: 'PASS' },
            { value: 'FAIL', label: 'FAIL' },
          ]}
          placeholder="-- Chọn kết quả QC --"
          error={errors.qcResult}
        />

        <UploadField
          title="File QC"
          subtitle="PDF/JPG/PNG"
          uploading={form.uploadingQc}
          fileUrl={form.qcDocumentUrl}
          compact
          onSelectFile={onUploadQc}
        />
        {errors.qcDocumentUrl ? <p className="text-xs font-semibold text-rose-600">{errors.qcDocumentUrl}</p> : null}

        <TextareaField
          label="Ghi chú QC"
          value={form.qcNotes}
          onChange={(value) => setForm((prev) => ({ ...prev, qcNotes: value }))}
          placeholder="Ghi chú kết quả kiểm định..."
          error={errors.qcNotes}
        />
      </div>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
  type = 'text',
  min,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  required?: boolean
  type?: 'text' | 'number' | 'date'
  min?: number
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <input
        className={`h-11 w-full rounded-lg border px-3 text-sm text-slate-700 ${error ? 'border-rose-400' : 'border-slate-300'}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        min={min}
      />
      {error ? <p className="mt-1 text-xs font-semibold text-rose-600">{error}</p> : null}
    </label>
  )
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        className={`h-24 w-full rounded-lg border px-3 py-2 text-sm text-slate-700 ${error ? 'border-rose-400' : 'border-slate-300'}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {error ? <p className="mt-1 text-xs font-semibold text-rose-600">{error}</p> : null}
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  required?: boolean
  error?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <select
        className={`h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-700 ${error ? 'border-rose-400' : 'border-slate-300'}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder ?? '-- Chọn --'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs font-semibold text-rose-600">{error}</p> : null}
    </label>
  )
}

function UploadField({
  title,
  subtitle,
  uploading,
  fileUrl,
  onSelectFile,
  compact = false,
}: {
  title: string
  subtitle: string
  uploading: boolean
  fileUrl: string
  onSelectFile: (file: File) => void
  compact?: boolean
}) {
  const inputId = `upload-${title.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-slate-700">{title}</p>
      <label
        htmlFor={inputId}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 ${compact ? 'h-20' : 'h-28'}`}
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        <p className="mt-2 text-sm font-semibold">{uploading ? 'Đang upload...' : 'Nhấn để tải lên'}</p>
        <p className="text-xs">{subtitle}</p>
      </label>
      <input
        id={inputId}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            onSelectFile(file)
          }
          event.currentTarget.value = ''
        }}
      />
      {fileUrl ? <p className="mt-1 truncate text-xs text-emerald-700">Đã upload: {fileUrl}</p> : null}
    </div>
  )
}
