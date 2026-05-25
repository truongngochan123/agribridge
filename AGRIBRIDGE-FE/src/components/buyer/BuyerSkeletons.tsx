/**
 * BuyerSkeletons.tsx
 * Shared skeleton loading components dùng chung cho các trang Buyer.
 */

/* ── Base shimmer bar ───────────────────────────────────────────── */
export function SkelBar({ className }: { className: string }) {
  return (
    <div
      className={`rounded-md ${className}`}
      style={{
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '400% 100%',
        animation: 'bsk-shimmer 1.6s ease-in-out infinite',
      }}
    />
  )
}

/* ── Loading banner (spinner + title + pills) ───────────────────── */
export function SkeletonBanner({
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

/* ── Keyframes (injected once) ──────────────────────────────────── */
export function BuyerSkeletonStyles() {
  return (
    <style>{`
      @keyframes bsk-shimmer {
        0%   { background-position: 100% 50%; }
        100% { background-position: 0%   50%; }
      }
      @keyframes bsk-fadein {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0);   }
      }
    `}</style>
  )
}

/* ── Stagger fade-in wrapper ────────────────────────────────────── */
export function SkelRow({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <div
      style={{ opacity: 0, animation: `bsk-fadein 0.35s ease forwards ${delay}s` }}
    >
      {children}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   1. Đơn hàng — table row skeletons
   ══════════════════════════════════════════════════════════════════ */
export function OrdersSkeletonLoader() {
  return (
    <div className="space-y-3 mb-4">
      <SkeletonBanner
        title="Đang tải danh sách đơn hàng..."
        subtitle="Lấy dữ liệu đơn, thanh toán và trạng thái giao hàng"
        pills={['Đang xử lý', 'Đang giao', 'Hoàn thành']}
      />
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Mã đơn', 'Nhà cung cấp', 'Sản phẩm', 'Giá trị', 'Trạng thái', 'Thanh toán', 'Ngày đặt', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {[0, 0.07, 0.14, 0.21, 0.28].map((delay, i) => (
              <tr key={i} style={{ opacity: 0, animation: `bsk-fadein 0.3s ease forwards ${delay}s` }}>
                <td className="px-4 py-3"><SkelBar className="h-4 w-24" /></td>
                <td className="px-4 py-3 space-y-1.5"><SkelBar className="h-3.5 w-28" /><SkelBar className="h-3 w-20" /></td>
                <td className="px-4 py-3"><SkelBar className="h-3.5 w-32" /></td>
                <td className="px-4 py-3"><SkelBar className="h-4 w-20" /></td>
                <td className="px-4 py-3"><SkelBar className="h-5 w-24 rounded-full" /></td>
                <td className="px-4 py-3 space-y-1.5"><SkelBar className="h-3.5 w-20" /><SkelBar className="h-4 w-16 rounded-full" /></td>
                <td className="px-4 py-3"><SkelBar className="h-3 w-16" /></td>
                <td className="px-4 py-3"><SkelBar className="h-7 w-16 rounded-lg" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BuyerSkeletonStyles />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   2. Chi nhánh — card skeletons
   ══════════════════════════════════════════════════════════════════ */
function BranchSkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
      style={{ opacity: 0, animation: `bsk-fadein 0.35s ease forwards ${delay}s` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1">
          <SkelBar className="h-5 w-40" />
          <SkelBar className="h-3.5 w-24 rounded-full" />
        </div>
        <SkelBar className="h-8 w-8 rounded-lg shrink-0" />
      </div>
      <div className="mt-3 space-y-2">
        <SkelBar className="h-3 w-full" />
        <SkelBar className="h-3 w-4/5" />
        <SkelBar className="h-3 w-2/3" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SkelBar className="h-14 rounded-xl" />
        <SkelBar className="h-14 rounded-xl" />
      </div>
      <div className="mt-3 flex gap-2">
        <SkelBar className="h-8 flex-1 rounded-xl" />
        <SkelBar className="h-8 w-20 rounded-xl" />
        <SkelBar className="h-8 w-20 rounded-xl" />
      </div>
    </div>
  )
}

export function BranchesSkeletonLoader() {
  return (
    <div className="space-y-4 mb-4">
      <SkeletonBanner
        title="Đang tải danh sách chi nhánh..."
        subtitle="Lấy thông tin chi nhánh và đơn hàng liên quan"
        pills={['Đang hoạt động', 'Tạm dừng']}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 0.08, 0.16, 0.24, 0.32, 0.40].map((delay, i) => (
          <BranchSkeletonCard key={i} delay={delay} />
        ))}
      </div>
      <BuyerSkeletonStyles />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   3. Theo dõi Giao hàng — row skeletons
   ══════════════════════════════════════════════════════════════════ */
function DeliverySkeletonRow({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
      style={{ opacity: 0, animation: `bsk-fadein 0.35s ease forwards ${delay}s` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <SkelBar className="h-4 w-24" />
            <SkelBar className="h-5 w-20 rounded-full" />
            <SkelBar className="h-5 w-16 rounded-full" />
          </div>
          <SkelBar className="h-3 w-32" />
        </div>
        <div className="shrink-0 text-right space-y-1">
          <SkelBar className="h-3 w-16 ml-auto" />
          <SkelBar className="h-4 w-24 ml-auto" />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 space-y-1.5">
            <SkelBar className="h-2.5 w-14" />
            <SkelBar className="h-3.5 w-3/4" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <SkelBar className="h-8 w-28 rounded-xl" />
        <SkelBar className="h-8 w-24 rounded-xl" />
      </div>
    </div>
  )
}

export function DeliverySkeletonLoader() {
  return (
    <div className="space-y-3 mb-4">
      <SkeletonBanner
        title="Đang tải theo dõi giao hàng..."
        subtitle="Lấy trạng thái vận chuyển và cập nhật lộ trình"
        pills={['Đang giao', 'Trễ hạn', 'Đã giao']}
      />
      <div className="space-y-3">
        {[0, 0.08, 0.16, 0.24].map((delay, i) => (
          <DeliverySkeletonRow key={i} delay={delay} />
        ))}
      </div>
      <BuyerSkeletonStyles />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   4. Công nợ — KPI + table skeletons
   ══════════════════════════════════════════════════════════════════ */
export function DebtSkeletonLoader() {
  return (
    <div className="space-y-4 mb-4">
      <SkeletonBanner
        title="Đang tải dữ liệu công nợ..."
        subtitle="Lấy hóa đơn, hạn thanh toán và thông tin nhà cung cấp"
        pills={['Quá hạn', 'Sắp đến hạn', 'Chưa thanh toán']}
      />
      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 0.06, 0.12, 0.18].map((delay, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            style={{ opacity: 0, animation: `bsk-fadein 0.3s ease forwards ${delay}s` }}
          >
            <SkelBar className="h-3 w-20 mb-2" />
            <SkelBar className="h-7 w-32 mb-1.5" />
            <SkelBar className="h-3 w-16 rounded-full" />
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Nhà cung cấp', 'Hóa đơn', 'Tổng tiền', 'Đã trả', 'Còn lại', 'Hạn thanh toán', 'Trạng thái'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {[0, 0.07, 0.14, 0.21, 0.28].map((delay, i) => (
              <tr key={i} style={{ opacity: 0, animation: `bsk-fadein 0.3s ease forwards ${delay}s` }}>
                <td className="px-4 py-3 space-y-1.5"><SkelBar className="h-3.5 w-28" /><SkelBar className="h-3 w-20" /></td>
                <td className="px-4 py-3"><SkelBar className="h-3.5 w-24" /></td>
                <td className="px-4 py-3"><SkelBar className="h-4 w-20" /></td>
                <td className="px-4 py-3"><SkelBar className="h-4 w-16" /></td>
                <td className="px-4 py-3"><SkelBar className="h-4 w-18" /></td>
                <td className="px-4 py-3"><SkelBar className="h-3 w-20" /></td>
                <td className="px-4 py-3"><SkelBar className="h-5 w-20 rounded-full" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BuyerSkeletonStyles />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   5. Giá thị trường — card skeletons
   ══════════════════════════════════════════════════════════════════ */
function MarketPriceSkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={{ opacity: 0, animation: `bsk-fadein 0.35s ease forwards ${delay}s` }}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', backgroundSize: '400% 100%', animation: 'bsk-shimmer 1.6s ease-in-out infinite' }} />
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5 flex-1">
            <SkelBar className="h-3 w-16" />
            <SkelBar className="h-4 w-3/4" />
            <SkelBar className="h-3 w-1/2" />
          </div>
          <SkelBar className="h-6 w-14 rounded-full shrink-0" />
        </div>
        {/* Price highlight block */}
        <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 px-3 py-2.5 flex items-end gap-3">
          <div className="space-y-1.5 flex-1">
            <SkelBar className="h-2.5 w-16" />
            <SkelBar className="h-6 w-28" />
          </div>
          <div className="text-right space-y-1">
            <SkelBar className="h-2.5 w-12 ml-auto" />
            <SkelBar className="h-4 w-20 ml-auto" />
          </div>
        </div>
        {/* Min-Max bar */}
        <div>
          <div className="flex justify-between mb-1">
            <SkelBar className="h-2.5 w-20" />
            <SkelBar className="h-2.5 w-20" />
          </div>
          <SkelBar className="h-1.5 w-full rounded-full" />
        </div>
        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-1.5">
          <SkelBar className="h-3 w-3/4" />
          <SkelBar className="h-3 w-2/3" />
          <SkelBar className="h-3 w-1/2" />
          <SkelBar className="h-3 w-2/3" />
        </div>
        {/* Actions */}
        <div className="flex gap-1.5">
          <SkelBar className="h-8 flex-1 rounded-xl" />
          <SkelBar className="h-8 w-14 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function MarketPriceSkeletonLoader() {
  return (
    <div className="space-y-4 mb-4">
      <SkeletonBanner
        title="Đang tải giá thị trường..."
        subtitle="Lấy giá tham khảo từ nhà cung cấp và giao dịch hoàn tất"
        pills={['Giá chào bán', 'Giao dịch thực', 'Xu hướng']}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 0.07, 0.14, 0.21, 0.28, 0.35].map((delay, i) => (
          <MarketPriceSkeletonCard key={i} delay={delay} />
        ))}
      </div>
      <BuyerSkeletonStyles />
    </div>
  )
}
