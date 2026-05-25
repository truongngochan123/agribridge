/**
 * SupplierSkeletons.tsx
 * Shared skeleton loading components for all Supplier pages.
 * Uses emerald accent to match the supplier brand color.
 */
import type { ReactNode } from 'react'

/* ── Base shimmer bar ──────────────────────────────────────────────────────── */
export function SSkelBar({ className }: { className: string }) {
  return (
    <div
      className={`rounded-md ${className}`}
      style={{
        background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
        backgroundSize: '400% 100%',
        animation: 'ssk-shimmer 1.6s ease-in-out infinite',
      }}
    />
  )
}

/* ── Global keyframes (injected once per render tree) ──────────────────────── */
export function SupplierSkeletonStyles() {
  return (
    <style>{`
      @keyframes ssk-shimmer {
        0%   { background-position: 100% 50%; }
        100% { background-position: 0%   50%; }
      }
      @keyframes ssk-fadein {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  )
}

/* ── Stagger fade wrapper ──────────────────────────────────────────────────── */
function SFade({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  return (
    <div style={{ opacity: 0, animation: `ssk-fadein 0.32s ease forwards ${delay}s` }}>
      {children}
    </div>
  )
}

/* ── Loading banner (used across all pages) ────────────────────────────────── */
export function SupplierSkeletonBanner({
  title,
  subtitle,
  pills = [],
}: {
  title: string
  subtitle: string
  pills?: string[]
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 shadow-sm">
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-20" />
        <span className="relative inline-flex h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-emerald-800">{title}</p>
        <p className="text-xs font-medium text-emerald-600/70">{subtitle}</p>
      </div>
      {pills.length > 0 && (
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {pills.map((label, i) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-[11px] font-semibold text-emerald-600 backdrop-blur"
            >
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
                style={{ animationDelay: `${i * 0.25}s` }}
              />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   1. TỔNG QUAN — KPI cards + chart placeholder + activity feed
   ════════════════════════════════════════════════════════════════════════════ */
export function OverviewSkeletonLoader() {
  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 0.06, 0.12, 0.18].map((delay, i) => (
          <SFade key={i} delay={delay}>
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <SSkelBar className="h-8 w-8 rounded-lg" />
                <SSkelBar className="h-5 w-12 rounded-full" />
              </div>
              <div className="mt-3 space-y-1.5">
                <SSkelBar className="h-2.5 w-20" />
                <SSkelBar className="h-6 w-28" />
                <SSkelBar className="h-2.5 w-16" />
              </div>
            </div>
          </SFade>
        ))}
      </div>

      {/* Chart + activity */}
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <SFade delay={0.22}>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="space-y-1.5">
                <SSkelBar className="h-4 w-36" />
                <SSkelBar className="h-3 w-20" />
              </div>
              <div className="text-right space-y-1.5">
                <SSkelBar className="h-5 w-24 ml-auto" />
                <SSkelBar className="h-3 w-16 ml-auto" />
              </div>
            </div>
            {/* Chart area */}
            <div className="h-40 rounded-xl" style={{
              background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
              backgroundSize: '400% 100%',
              animation: 'ssk-shimmer 1.6s ease-in-out infinite',
            }} />
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-50 pt-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg bg-slate-50 py-2 text-center space-y-1.5">
                  <SSkelBar className="mx-auto h-4 w-16" />
                  <SSkelBar className="mx-auto h-2.5 w-12" />
                </div>
              ))}
            </div>
          </div>
        </SFade>

        <SFade delay={0.28}>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <SSkelBar className="mb-3 h-4 w-32" />
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <SSkelBar key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </SFade>
      </div>
      <SupplierSkeletonStyles />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   2. ĐƠN HÀNG — table rows skeleton
   ════════════════════════════════════════════════════════════════════════════ */
export function SupplierOrdersSkeletonLoader() {
  return (
    <div className="space-y-3 mb-4">
      <SupplierSkeletonBanner
        title="Đang tải danh sách đơn hàng..."
        subtitle="Lấy thông tin đơn, lô hàng và trạng thái giao hàng"
        pills={['Chờ xác nhận', 'Đang giao', 'Hoàn thành']}
      />
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Mã đơn', 'Khách hàng', 'Sản phẩm + lô', 'Số lượng', 'Giá trị', 'Trạng thái đơn', 'Giao hàng', 'Ngày đặt', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {[0, 0.07, 0.14, 0.21, 0.28].map((delay, i) => (
              <tr key={i} style={{ opacity: 0, animation: `ssk-fadein 0.3s ease forwards ${delay}s` }}>
                <td className="px-4 py-3"><SSkelBar className="h-4 w-20" /></td>
                <td className="px-4 py-3 space-y-1.5"><SSkelBar className="h-3.5 w-24" /><SSkelBar className="h-3 w-16" /></td>
                <td className="px-4 py-3 space-y-1.5"><SSkelBar className="h-3.5 w-28" /><SSkelBar className="h-3 w-20" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-3.5 w-14" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-4 w-20" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-5 w-24 rounded-full" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-5 w-20 rounded-full" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-3 w-16" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-7 w-16 rounded-lg" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SupplierSkeletonStyles />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   3. RFQ & BÁO GIÁ — card list skeleton
   ════════════════════════════════════════════════════════════════════════════ */
function RfqSkelCard({ delay }: { delay: number }) {
  return (
    <SFade delay={delay}>
      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SSkelBar className="h-4 w-24" />
            <SSkelBar className="h-5 w-16 rounded-full" />
          </div>
          <div className="shrink-0 space-y-1 text-right">
            <SSkelBar className="h-3 w-10 ml-auto" />
            <SSkelBar className="h-4 w-20 ml-auto" />
          </div>
        </div>
        <SSkelBar className="mt-1.5 h-3 w-40" />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 space-y-1.5">
              <SSkelBar className="h-2.5 w-12" />
              <SSkelBar className="h-3.5 w-3/4" />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <SSkelBar className="h-8 flex-1 min-w-[80px] rounded-xl" />
          <SSkelBar className="h-8 w-20 rounded-xl" />
          <SSkelBar className="h-8 w-16 rounded-xl" />
        </div>
      </div>
    </SFade>
  )
}

export function SupplierRfqSkeletonLoader() {
  return (
    <div className="space-y-3 mb-4">
      <SupplierSkeletonBanner
        title="Đang tải danh sách RFQ..."
        subtitle="Lấy yêu cầu báo giá và lịch sử báo giá từ buyer"
        pills={['Chờ báo giá', 'Đã báo giá', 'Chấp nhận']}
      />
      <div className="space-y-3">
        {[0, 0.08, 0.16, 0.24].map((delay, i) => (
          <RfqSkelCard key={i} delay={delay} />
        ))}
      </div>
      <SupplierSkeletonStyles />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   4. SẢN PHẨM / LÔ HÀNG — card grid skeleton
   ════════════════════════════════════════════════════════════════════════════ */
function ProductSkelCard({ delay }: { delay: number }) {
  return (
    <SFade delay={delay}>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {/* Image placeholder */}
        <div className="h-36 w-full" style={{
          background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
          backgroundSize: '400% 100%',
          animation: 'ssk-shimmer 1.6s ease-in-out infinite',
        }} />
        <div className="p-3 space-y-2">
          <SSkelBar className="h-4 w-3/4" />
          <SSkelBar className="h-3 w-1/2" />
          <div className="flex items-center justify-between gap-2 pt-1">
            <SSkelBar className="h-5 w-24 rounded-full" />
            <SSkelBar className="h-4 w-16" />
          </div>
          <div className="flex gap-2 pt-1">
            <SSkelBar className="h-8 flex-1 rounded-xl" />
            <SSkelBar className="h-8 w-10 rounded-xl" />
          </div>
        </div>
      </div>
    </SFade>
  )
}

export function ProductsSkeletonLoader() {
  return (
    <div className="space-y-4 mb-4">
      <SupplierSkeletonBanner
        title="Đang tải danh sách sản phẩm..."
        subtitle="Lấy thông tin sản phẩm, lô hàng và tình trạng tồn kho"
        pills={['Đang bán', 'Hết hàng', 'Nháp']}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[0, 0.06, 0.12, 0.18, 0.24, 0.30, 0.36, 0.42].map((delay, i) => (
          <ProductSkelCard key={i} delay={delay} />
        ))}
      </div>
      <SupplierSkeletonStyles />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   5. QUẢN LÝ LÔ HÀNG — table rows skeleton
   ════════════════════════════════════════════════════════════════════════════ */
export function LotsSkeletonLoader() {
  return (
    <div className="space-y-3 mb-4">
      <SupplierSkeletonBanner
        title="Đang tải danh sách lô hàng..."
        subtitle="Lấy thông tin lô, chất lượng và trạng thái"
        pills={['Đang bán', 'Bán hết', 'Chờ duyệt']}
      />
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Mã lô', 'Sản phẩm', 'Kho vực', 'SL còn', 'Đơn giá', 'Grade/Size', 'Trạng thái', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {[0, 0.07, 0.14, 0.21, 0.28, 0.35].map((delay, i) => (
              <tr key={i} style={{ opacity: 0, animation: `ssk-fadein 0.3s ease forwards ${delay}s` }}>
                <td className="px-4 py-3"><SSkelBar className="h-4 w-20" /></td>
                <td className="px-4 py-3 space-y-1.5"><SSkelBar className="h-3.5 w-28" /><SSkelBar className="h-3 w-16" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-3.5 w-20" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-4 w-16" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-4 w-20" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-3.5 w-20" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-5 w-20 rounded-full" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-7 w-20 rounded-lg" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SupplierSkeletonStyles />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   6. GIAO HÀNG — card grid skeleton (mirrors DeliveryCard)
   ════════════════════════════════════════════════════════════════════════════ */
function DeliverySkelCard({ delay }: { delay: number }) {
  return (
    <SFade delay={delay}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Accent stripe */}
        <SSkelBar className="h-1 w-full rounded-none" />
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <SSkelBar className="h-4 w-28" />
                <SSkelBar className="h-5 w-20 rounded-full" />
              </div>
              <SSkelBar className="h-3 w-32" />
            </div>
            <SSkelBar className="h-4 w-24 shrink-0" />
          </div>
          {/* Cargo bar */}
          <SSkelBar className="h-10 w-full rounded-xl" />
          {/* Progress */}
          <SSkelBar className="h-1.5 w-full rounded-full" />
          {/* Actions */}
          <div className="flex items-center gap-2">
            <SSkelBar className="h-9 flex-1 rounded-xl" />
            <SSkelBar className="h-9 w-9 rounded-xl" />
            <SSkelBar className="h-9 w-9 rounded-xl" />
          </div>
        </div>
      </div>
    </SFade>
  )
}

export function SupplierDeliverySkeletonLoader() {
  return (
    <div className="space-y-4 mb-4">
      <SupplierSkeletonBanner
        title="Đang tải theo dõi giao hàng..."
        subtitle="Lấy trạng thái vận chuyển và cập nhật lộ trình"
        pills={['Đang giao', 'Có sự cố', 'Đã giao']}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 0.07, 0.14, 0.21, 0.28, 0.35].map((delay, i) => (
          <DeliverySkelCard key={i} delay={delay} />
        ))}
      </div>
      <SupplierSkeletonStyles />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   7. CÔNG NỢ — KPI cards + table rows skeleton
   ════════════════════════════════════════════════════════════════════════════ */
export function SupplierDebtSkeletonLoader() {
  return (
    <div className="space-y-4 mb-4">
      <SupplierSkeletonBanner
        title="Đang tải dữ liệu công nợ phải thu..."
        subtitle="Lấy hóa đơn, hạn thanh toán và thông tin buyer"
        pills={['Quá hạn', 'Sắp đến hạn', 'Chưa thanh toán']}
      />
      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 0.06, 0.12, 0.18].map((delay, i) => (
          <SFade key={i} delay={delay}>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-2">
              <SSkelBar className="h-3 w-20" />
              <SSkelBar className="h-7 w-32" />
              <SSkelBar className="h-3 w-16 rounded-full" />
            </div>
          </SFade>
        ))}
      </div>
      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Buyer', 'Hóa đơn', 'Tổng tiền', 'Đã trả', 'Còn lại', 'Hạn', 'Trạng thái'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {[0, 0.07, 0.14, 0.21, 0.28].map((delay, i) => (
              <tr key={i} style={{ opacity: 0, animation: `ssk-fadein 0.3s ease forwards ${delay}s` }}>
                <td className="px-4 py-3 space-y-1.5"><SSkelBar className="h-3.5 w-28" /><SSkelBar className="h-3 w-20" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-3.5 w-24" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-4 w-20" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-4 w-16" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-4 w-18" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-3 w-20" /></td>
                <td className="px-4 py-3"><SSkelBar className="h-5 w-20 rounded-full" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SupplierSkeletonStyles />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   8. BÁO CÁO — chart + table skeletons
   ════════════════════════════════════════════════════════════════════════════ */
export function ReportsSkeletonLoader() {
  return (
    <div className="space-y-4 mb-4">
      <SupplierSkeletonBanner
        title="Đang tải báo cáo..."
        subtitle="Tổng hợp doanh thu, công nợ và hiệu suất kinh doanh"
        pills={['Doanh thu', 'Công nợ', 'Đơn hàng']}
      />
      {/* KPI */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 0.06, 0.12, 0.18].map((delay, i) => (
          <SFade key={i} delay={delay}>
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm space-y-2">
              <SSkelBar className="h-3 w-20" />
              <SSkelBar className="h-7 w-28" />
              <SSkelBar className="h-5 w-14 rounded-full" />
            </div>
          </SFade>
        ))}
      </div>
      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        {[0.22, 0.28].map((delay, i) => (
          <SFade key={i} delay={delay}>
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <SSkelBar className="mb-3 h-4 w-40" />
              <div className="h-48 rounded-xl" style={{
                background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
                backgroundSize: '400% 100%',
                animation: 'ssk-shimmer 1.6s ease-in-out infinite',
              }} />
            </div>
          </SFade>
        ))}
      </div>
      <SupplierSkeletonStyles />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   9. VÍ & THANH TOÁN — wallet card + transaction list skeleton
   ════════════════════════════════════════════════════════════════════════════ */
export function WalletSkeletonLoader() {
  return (
    <div className="space-y-4 mb-4">
      <SupplierSkeletonBanner
        title="Đang tải ví & giao dịch..."
        subtitle="Lấy số dư, lịch sử rút tiền và trạng thái thanh toán"
        pills={['Số dư', 'Đã rút', 'Đang xử lý']}
      />
      {/* Wallet card */}
      <SFade delay={0.06}>
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-600 p-6 shadow-xl">
          <div className="h-3 w-24 mb-2 rounded-md" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div className="h-10 w-48 mb-4 rounded-md" style={{ background: 'rgba(255,255,255,0.25)' }} />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-white/10 px-3 py-2 space-y-1.5">
                <div className="h-2.5 w-12 rounded-md" style={{ background: 'rgba(255,255,255,0.2)' }} />
                <div className="h-4 w-16 rounded-md" style={{ background: 'rgba(255,255,255,0.25)' }} />
              </div>
            ))}
          </div>
        </div>
      </SFade>
      {/* Transaction list */}
      <SFade delay={0.14}>
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <SSkelBar className="h-4 w-40" />
          </div>
          <div className="divide-y divide-slate-50">
            {[0, 0.06, 0.12, 0.18, 0.24].map((delay, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-3" style={{ opacity: 0, animation: `ssk-fadein 0.3s ease forwards ${delay}s` }}>
                <div className="flex items-center gap-3">
                  <SSkelBar className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="space-y-1.5">
                    <SSkelBar className="h-3.5 w-32" />
                    <SSkelBar className="h-3 w-20" />
                  </div>
                </div>
                <div className="text-right space-y-1.5">
                  <SSkelBar className="h-4 w-20 ml-auto" />
                  <SSkelBar className="h-3 w-14 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SFade>
      <SupplierSkeletonStyles />
    </div>
  )
}
