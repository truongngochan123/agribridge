import {
  ArrowLeft,
  Award,
  BarChart3,
  Box,
  Building2,
  CheckCircle2,
  ChevronRight,
  Globe,
  Heart,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Scale,
  Send,
  ShieldCheck,
  Star,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PublicPageLayout } from '../../components/site/PublicPageLayout'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useToast } from '../../hooks/useToast'
import { apiClient } from '../../services/apiClient'
import { getStoredAuthSession } from '../../services/authSession'

type Tab = 'products'

const MIN_SUPPLIER_DETAIL_LOADING_MS = 700

interface CompanyItem {
  id: number
  name: string
  province?: string | null
  district?: string | null
  ward?: string | null
  address?: string | null
  description?: string | null
  verifiedStatus?: boolean | null
  verificationStatus?: string | null
  companyType?: string | null
  businessType?: string | null
  trustLevel?: string | null
  establishedYear?: number | null
  website?: string | null
  phone?: string | null
  email?: string | null
}

interface ProductItem {
  productId: number
  productName: string
  supplierCompanyId?: number | null
  categoryName?: string | null
  unit?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  totalAvailableQuantity?: number | null
  minMoq?: number | null
  certifications?: Array<{ id?: number; name: string }>
  batches?: Array<{ id?: number; batchCode?: string | null; grade?: string | null; size?: string | null; quantity?: number | null; price?: number | null }>
}

function getLogoText(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatCurrency(value?: number | null): string {
  if (!value) return 'Liên hệ'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
}

function formatQuantity(value?: number | null, unit?: string | null): string {
  if (!value) return 'Liên hệ'
  return `${value.toLocaleString('vi-VN')} ${unit ?? ''}`.trim()
}

function formatBusinessType(type?: string | null): string {
  const map: Record<string, string> = {
    FARM: 'Trang trại',
    COOPERATIVE: 'Hợp tác xã',
    COMPANY: 'Doanh nghiệp',
    HOUSEHOLD: 'Hộ kinh doanh',
  }
  return type ? map[type] ?? type : 'Nhà cung cấp'
}

export function SupplierDetailPage() {
  usePageTitle('Chi tiết nhà cung cấp')
  const { supplierId } = useParams<{ supplierId: string }>()
  const navigate = useNavigate()
  const { showConfirm, showToast } = useToast()
  const [supplier, setSupplier] = useState<CompanyItem | null>(null)
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('products')
  const [followed, setFollowed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchSupplierDetail() {
      if (!supplierId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)

      try {
        const [supplierRes, productsRes] = await Promise.all([
          apiClient.get<CompanyItem>(`/api/public/suppliers/${supplierId}`),
          apiClient.get<ProductItem[]>('/api/public/products'),
          new Promise((resolve) => window.setTimeout(resolve, MIN_SUPPLIER_DETAIL_LOADING_MS)),
        ])

        if (cancelled) return
        setSupplier(supplierRes.data)
        setProducts(productsRes.data.filter((product) => product.supplierCompanyId === supplierRes.data.id))
      } catch {
        if (cancelled) return
        setSupplier(null)
        setProducts([])
        setError('Không thể tải dữ liệu nhà cung cấp. Vui lòng thử lại.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSupplierDetail()
    return () => {
      cancelled = true
    }
  }, [supplierId])

  const certifications = useMemo(() => {
    const names = products.flatMap((product) => product.certifications?.map((cert) => cert.name) ?? [])
    return Array.from(new Set(names)).slice(0, 4)
  }, [products])
  const displayCertifications = certifications.length > 0 ? certifications : supplier?.trustLevel ? [supplier.trustLevel] : []

  const supplierProducts = useMemo(() => {
    return products.map((product) => {
      const firstBatch = product.batches?.[0]
      const price =
        product.minPrice && product.maxPrice && product.minPrice !== product.maxPrice
          ? `${formatCurrency(product.minPrice)} - ${formatCurrency(product.maxPrice)}`
          : formatCurrency(product.minPrice ?? product.maxPrice)

      return {
        id: product.productId,
        name: product.productName,
        lotId: firstBatch?.batchCode || `SP-${product.productId}`,
        spec: [firstBatch?.grade, firstBatch?.size].filter(Boolean).join(' / ') || product.categoryName || 'N/A',
        price,
        inventory: formatQuantity(product.totalAvailableQuantity ?? firstBatch?.quantity, product.unit),
        certifications: product.certifications?.map((cert) => cert.name) ?? [],
      }
    })
  }, [products])

  const mainProduct = products[0]
  const mainCategory = mainProduct?.categoryName ?? formatBusinessType(supplier?.businessType)
  const mainMoq = products.map((product) => product.minMoq).find((value): value is number => Boolean(value))

  const actionTarget = (intent: string) => {
    if (!supplier) return '/buyer/sourcing'
    const params = new URLSearchParams()
    params.set('supplierId', String(supplier.id))
    params.set('supplierName', supplier.name)
    if (mainProduct?.productId) params.set('productId', String(mainProduct.productId))
    if (mainProduct?.productName) params.set('productName', mainProduct.productName)
    if (mainProduct?.categoryName) params.set('categoryName', mainProduct.categoryName)

    if (intent === 'send-rfq') {
      params.set('action', 'create')
      return `/buyer/rfq?${params.toString()}`
    }
    if (intent === 'contact-supplier') {
      params.set('action', 'contact')
      return `/buyer/rfq?${params.toString()}`
    }
    if (intent === 'compare-supplier') {
      params.set('action', 'compare')
      return `/buyer/rfq?${params.toString()}`
    }
    if (intent === 'quick-order') {
      return mainProduct?.productId
        ? `/buyer/sourcing/products/${mainProduct.productId}/batches`
        : `/buyer/sourcing?${params.toString()}`
    }
    return `/buyer/sourcing?${params.toString()}`
  }

  const actionLabel = (intent: string) => {
    const labels: Record<string, string> = {
      'send-rfq': 'gửi RFQ',
      'contact-supplier': 'liên hệ nhà cung cấp',
      'compare-supplier': 'so sánh nhà cung cấp',
      'quick-order': 'đặt hàng',
      'follow-supplier': 'theo dõi nhà cung cấp',
    }
    return labels[intent] ?? 'tiếp tục'
  }

  const requireBuyerAuth = async (intent: string) => {
    const target = actionTarget(intent)
    const session = getStoredAuthSession()
    if (!session) {
      const accepted = await showConfirm(`Bạn cần đăng nhập hoặc đăng ký tài khoản người mua để ${actionLabel(intent)}.`, {
        title: 'Yêu cầu đăng nhập',
        confirmText: 'Đăng nhập',
        cancelText: 'Ở lại',
      })
      if (accepted) navigate('/auth/login', { state: { from: target, intent } })
      return null
    }
    if (session.status !== 'SUCCESS') {
      const accepted = await showConfirm('Tài khoản của bạn chưa sẵn sàng sử dụng chức năng này. Vui lòng đăng nhập lại hoặc hoàn tất xác minh.', {
        title: 'Cần xác minh tài khoản',
        confirmText: 'Tiếp tục',
        cancelText: 'Ở lại',
      })
      if (accepted) navigate('/auth/login', { state: { from: target, intent } })
      return null
    }
    if (String(session.companyType ?? '').toLowerCase() !== 'buyer') {
      showToast('Chức năng này chỉ dành cho tài khoản người mua.', 'info')
      return null
    }
    return target
  }

  const handleProtectedAction = async (intent: string) => {
    const target = await requireBuyerAuth(intent)
    if (!target) return
    const accepted = await showConfirm(`Mở trang ${actionLabel(intent)} cho nhà cung cấp này?`, {
      title: 'Tiếp tục thao tác',
      confirmText: 'Mở trang',
      cancelText: 'Ở lại',
    })
    if (accepted) navigate(target)
  }

  const handleFollow = async () => {
    const target = await requireBuyerAuth('follow-supplier')
    if (!target) return
    const accepted = await showConfirm('Theo dõi nhà cung cấp này và mở khu tìm nguồn hàng?', {
      title: 'Theo dõi nhà cung cấp',
      confirmText: 'Theo dõi',
      cancelText: 'Ở lại',
    })
    if (!accepted) return
    setFollowed((value) => !value)
    navigate(target)
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'products', label: 'Lô hàng đang bán', count: products.length },
  ]

  if (loading) {
    return (
      <PublicPageLayout>
        {/* Breadcrumb skeleton */}
        <div className="mb-5 flex items-center gap-2">
          <div className="h-4 w-28 rounded-full bg-gray-200 animate-pulse" />
          <div className="h-3 w-3 rounded-full bg-gray-200 animate-pulse" />
          <div className="h-4 w-48 rounded-full bg-gray-200 animate-pulse" />
        </div>

        {/* Hero card skeleton */}
        <section className="rounded-2xl border border-[#E8EDF3] bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)] overflow-hidden">
          {/* Banner */}
          <div className="h-32 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="-mt-10 flex items-end gap-4 mb-4">
              <div className="h-20 w-20 rounded-2xl bg-gray-200 animate-pulse ring-4 ring-white flex-shrink-0" />
            </div>
            {/* Info + buttons */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-64 rounded-xl bg-gray-200 animate-pulse" />
                  <div className="h-5 w-24 rounded-full bg-emerald-100 animate-pulse" />
                </div>
                <div className="flex gap-4">
                  <div className="h-4 w-20 rounded-full bg-gray-200 animate-pulse" />
                  <div className="h-4 w-20 rounded-full bg-gray-200 animate-pulse" />
                  <div className="h-4 w-20 rounded-full bg-gray-200 animate-pulse" />
                </div>
                <div className="h-4 w-full max-w-md rounded-full bg-gray-200 animate-pulse" />
                <div className="h-4 w-3/4 max-w-sm rounded-full bg-gray-200 animate-pulse" />
                <div className="flex gap-2 mt-1">
                  <div className="h-6 w-16 rounded-xl bg-amber-100 animate-pulse" />
                  <div className="h-6 w-14 rounded-full bg-emerald-100 animate-pulse" />
                  <div className="h-6 w-20 rounded-full bg-emerald-100 animate-pulse" />
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <div className="h-10 w-28 rounded-xl bg-emerald-200 animate-pulse" />
                <div className="h-10 w-28 rounded-xl bg-gray-200 animate-pulse" />
                <div className="h-10 w-28 rounded-xl bg-gray-200 animate-pulse" />
                <div className="h-10 w-28 rounded-xl bg-gray-200 animate-pulse" />
              </div>
            </div>
          </div>
        </section>

        {/* Capacity + Business Info skeletons */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <section key={i} className="rounded-2xl border border-[#E8EDF3] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
                <div className="h-5 w-36 rounded-full bg-gray-200 animate-pulse" />
              </div>
              <div className="space-y-3">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex items-center justify-between rounded-xl bg-[#F9FBFD] border border-[#F0F4F8] px-4 py-3">
                    <div className="h-4 w-32 rounded-full bg-gray-200 animate-pulse" />
                    <div className="h-4 w-24 rounded-full bg-gray-200 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Products tab skeleton */}
        <section className="mt-5 rounded-2xl border border-[#E8EDF3] bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-1 border-b border-[#F0F4F8] px-6">
            <div className="py-4 px-4">
              <div className="h-4 w-32 rounded-full bg-gray-200 animate-pulse" />
            </div>
            <div className="py-4 px-4">
              <div className="h-4 w-20 rounded-full bg-gray-200 animate-pulse" />
            </div>
          </div>
          <div className="p-6 grid gap-5 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl border border-[#E8EDF3] bg-[#F9FBFD] p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-36 rounded-full bg-gray-200 animate-pulse" />
                    <div className="h-3.5 w-48 rounded-full bg-gray-200 animate-pulse" />
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 animate-pulse" />
                </div>
                <div className="h-px bg-[#F0F4F8]" />
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <div className="h-3 w-12 rounded-full bg-gray-200 animate-pulse" />
                    <div className="h-7 w-28 rounded-xl bg-emerald-100 animate-pulse" />
                  </div>
                  <div className="h-8 w-24 rounded-xl bg-blue-100 animate-pulse" />
                </div>
                <div className="flex gap-2">
                  <div className="h-5 w-12 rounded-full bg-emerald-100 animate-pulse" />
                  <div className="h-5 w-16 rounded-full bg-emerald-100 animate-pulse" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-10 rounded-xl bg-emerald-200 animate-pulse" />
                  <div className="h-10 rounded-xl bg-emerald-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </PublicPageLayout>
    )
  }

  if (error || !supplier) {
    return (
      <PublicPageLayout>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          {error ?? 'Không tìm thấy nhà cung cấp.'}
        </div>
      </PublicPageLayout>
    )
  }

  return (
    <PublicPageLayout>
      {/* ── Breadcrumb ── */}
      <div className="mb-5 flex items-center gap-2 text-sm text-[#667085]">
        <Link to="/suppliers" className="inline-flex items-center gap-1.5 font-medium hover:text-emerald-600 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Nhà cung cấp
        </Link>
        <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        <span className="text-[#0F172A] font-semibold truncate max-w-xs">{supplier.name}</span>
      </div>

      {/* ── Hero Card ── */}
      <section className="relative overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)] border border-[#E8EDF3]">
        {/* Gradient Banner */}
        <div className="h-32 w-full bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 relative">
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute right-24 top-4 h-20 w-20 rounded-full bg-white/5" />
          <div className="absolute left-1/3 -bottom-2 h-16 w-16 rounded-full bg-white/10" />
          {/* Pattern overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }}
          />
        </div>

        <div className="px-6 pb-6">
          {/* Avatar row — overlaps banner */}
          <div className="-mt-10 flex items-end gap-4">
            <div className="relative flex-shrink-0">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl font-extrabold text-white shadow-lg ring-4 ring-white">
                {getLogoText(supplier.name)}
              </div>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                <ShieldCheck className="h-3 w-3 text-white" />
              </div>
            </div>
          </div>

          {/* Supplier Info + Actions — full white area */}
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            {/* Left: info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-[#0F172A]">{supplier.name}</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Đã xác minh
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[#667085]">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-emerald-500" />
                  {supplier.province ?? 'Chưa cập nhật'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  {mainCategory}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-violet-500" />
                  {products.length} sản phẩm
                </span>
              </div>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#475467]">{supplier.description || 'Nhà cung cấp nông hải sản chất lượng cao trên nền tảng AgriBridge.'}</p>

              {/* Rating + Certs */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-100 px-3 py-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-bold text-amber-700">4.8</span>
                  <span className="text-xs text-amber-600">/5.0</span>
                </div>
                {displayCertifications.map((cert) => (
                  <span key={cert} className="inline-flex items-center gap-1 rounded-full bg-[#F0FDF9] border border-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <Award className="h-3 w-3" />
                    {cert}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Action Buttons — clearly in white zone */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => handleProtectedAction('send-rfq')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-emerald-500 hover:to-teal-500 transition-all duration-200 active:scale-95"
              >
                <Send className="h-4 w-4" />
                Gửi RFQ
              </button>
              <button
                onClick={() => handleProtectedAction('contact-supplier')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E8EDF3] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054] hover:bg-[#F9FBFD] hover:border-emerald-200 transition-all duration-200"
              >
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                Liên hệ
              </button>
              <button
                onClick={handleFollow}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  followed
                    ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                    : 'border-[#E8EDF3] bg-white text-[#344054] hover:bg-[#F9FBFD] hover:border-rose-200'
                }`}
              >
                <Heart className={`h-4 w-4 transition-all ${followed ? 'fill-rose-500 text-rose-500' : ''}`} />
                {followed ? 'Đã theo dõi' : 'Theo dõi'}
              </button>
              <button
                onClick={() => handleProtectedAction('compare-supplier')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E8EDF3] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054] hover:bg-[#F9FBFD] transition-all duration-200"
              >
                <Scale className="h-4 w-4 text-blue-500" />
                So sánh NCC
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Metrics ── */}
      {/* ── Capacity & Business Info ── */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Năng lực cung ứng */}
        <section className="rounded-2xl border border-[#E8EDF3] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-[#0F172A]">Năng lực cung ứng</h2>
          </div>
          <div className="space-y-3">
            {[
              { icon: Box, label: 'Mặt hàng chính', value: mainProduct?.productName ?? 'Chưa cập nhật', color: 'text-emerald-600' },
              { icon: BarChart3, label: 'Sản lượng khả dụng', value: formatQuantity(products.reduce((sum, product) => sum + (product.totalAvailableQuantity ?? 0), 0), mainProduct?.unit), color: 'text-blue-600' },
              { icon: Package, label: 'MOQ', value: formatQuantity(mainMoq, mainProduct?.unit), color: 'text-violet-600' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-[#F9FBFD] border border-[#F0F4F8] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-sm text-[#667085]">{label}</span>
                </div>
                <span className="text-sm font-semibold text-[#0F172A]">{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Thông tin doanh nghiệp */}
        <section className="rounded-2xl border border-[#E8EDF3] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-[#0F172A]">Thông tin doanh nghiệp</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Tên pháp lý', value: supplier.name, icon: Building2 },
              { label: 'Loại hình', value: formatBusinessType(supplier.businessType), icon: Zap },
              { label: 'Địa chỉ', value: [supplier.address, supplier.ward, supplier.district, supplier.province].filter(Boolean).join(', ') || 'Chưa cập nhật', icon: MapPin },
              { label: 'Số điện thoại', value: supplier.phone || 'Yêu cầu đăng nhập để xem', icon: Phone },
              { label: 'Email', value: supplier.email || 'Yêu cầu đăng nhập để xem', icon: Mail },
              { label: 'Website', value: supplier.website || 'Chưa cập nhật', icon: Globe },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl bg-[#F9FBFD] border border-[#F0F4F8] px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs text-[#98A2B3] mb-0.5">
                  <Icon className="h-3 w-3" />
                  {label}
                </p>
                <p className="text-xs font-semibold text-[#0F172A] leading-snug break-all">{value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Tabs ── */}
      <section className="mt-5 rounded-2xl border border-[#E8EDF3] bg-white shadow-sm overflow-hidden">
        {/* Tab Header */}
        <div className="flex items-center gap-0 border-b border-[#F0F4F8] px-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative py-4 px-4 text-sm font-semibold transition-colors duration-200 ${
                activeTab === tab.key
                  ? 'text-emerald-600'
                  : 'text-[#667085] hover:text-[#344054]'
              }`}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold transition-colors ${
                      activeTab === tab.key
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-[#F0F4F8] text-[#98A2B3]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'products' && (
            <div className="grid gap-5 md:grid-cols-2">
              {supplierProducts.map((product) => (
                <article
                  key={product.id}
                  className="group relative rounded-2xl border border-[#E8EDF3] bg-gradient-to-br from-[#F9FBFD] to-white p-5 hover:shadow-lg hover:border-emerald-200 transition-all duration-300 hover:-translate-y-0.5"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-[#0F172A] group-hover:text-emerald-700 transition-colors">
                        {product.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#98A2B3]">
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Lô: <span className="font-medium text-[#667085]">{product.lotId}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Box className="h-3 w-3" />
                          {product.spec}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 rounded-xl bg-emerald-50 border border-emerald-100 p-2">
                      <Package className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="my-3 h-px bg-[#F0F4F8]" />

                  {/* Price + Inventory */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-[#98A2B3] mb-0.5">Giá / kg</p>
                      <p className="text-2xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                        {product.price}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#98A2B3] mb-0.5">Còn lại</p>
                      <div className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-100 px-2.5 py-1">
                        <Box className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-sm font-bold text-blue-700">{product.inventory}</span>
                      </div>
                    </div>
                  </div>

                  {/* Certs */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {product.certifications.map((cert) => (
                      <span
                        key={cert}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {cert}
                      </span>
                    ))}
                  </div>

                  {/* CTA Buttons */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button onClick={() => handleProtectedAction('quick-order')} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:from-emerald-500 hover:to-teal-500 transition-all duration-200 active:scale-95">
                      Đặt hàng ngay
                    </button>
                    <button onClick={() => handleProtectedAction('send-rfq')} className="rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5">
                      <Send className="h-3.5 w-3.5" />
                      Gửi RFQ
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicPageLayout>
  )
}
