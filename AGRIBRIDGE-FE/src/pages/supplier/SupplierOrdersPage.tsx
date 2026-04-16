import { SupplierPanel, SupplierStatusPill } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useSupplierDashboardData } from './useSupplierDashboardData'

export function SupplierOrdersPage() {
  const { data, loading, error } = useSupplierDashboardData()
  const orders = data?.orders ?? []
  const statusCount = {
    pending: orders.filter((item) => item.status === 'Chờ xác nhận').length,
    confirmed: orders.filter((item) => item.status === 'Đã xác nhận').length,
    shipping: orders.filter((item) => item.status === 'Đang giao').length,
    completed: orders.filter((item) => item.status === 'Hoàn thành').length,
    cancelled: orders.filter((item) => item.status === 'Đã hủy').length,
  }

  return (
    <SupplierShell activeKey="orders" title="Quản lý Đơn hàng" subtitle="Theo dõi và xử lý toàn bộ đơn hàng">
      <div className="grid gap-4 md:grid-cols-5">
        {[
          { value: String(statusCount.pending), label: 'Chờ xác nhận' },
          { value: String(statusCount.confirmed), label: 'Đã xác nhận' },
          { value: String(statusCount.shipping), label: 'Đang giao' },
          { value: String(statusCount.completed), label: 'Hoàn thành' },
          { value: String(statusCount.cancelled), label: 'Đã hủy' },
        ].map((item) => (
          <article key={item.label} className="rounded-2xl border border-emerald-200 bg-white p-4">
            <p className="text-[38px] font-extrabold leading-none text-emerald-950">{item.value}</p>
            <div className="mt-2">
              <SupplierStatusPill label={item.label} />
            </div>
          </article>
        ))}
      </div>

      <SupplierPanel>
        {loading ? <p className="mb-3 text-sm font-semibold text-emerald-700">Đang tải dữ liệu realtime...</p> : null}
        {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
        {!loading && !error && orders.length === 0 ? (
          <p className="mb-3 text-sm font-semibold text-slate-600">Chưa có đơn hàng nào cho tài khoản này.</p>
        ) : null}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            placeholder="Tìm đơn hàng, khách hàng..."
            className="h-11 min-w-[280px] flex-1 rounded-lg border border-emerald-200 px-4 text-sm outline-none focus:border-emerald-500"
          />
          {['Tất cả', 'Chờ xác nhận', 'Đã xác nhận', 'Đang giao', 'Hoàn thành', 'Đã hủy'].map((tab, idx) => (
            <button
              key={tab}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                idx === 0 ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-emerald-700/70">
                <th className="px-3">Mã đơn</th>
                <th className="px-3">Khách hàng</th>
                <th className="px-3">Sản phẩm</th>
                <th className="px-3">SL</th>
                <th className="px-3">Giá trị</th>
                <th className="px-3">Trạng thái</th>
                <th className="px-3">Ngày đặt</th>
                <th className="px-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="rounded-lg bg-emerald-50/40 text-sm">
                  <td className="px-3 py-3 font-bold text-emerald-950">{order.id}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-emerald-900">{order.customer}</p>
                    <p className="text-xs text-emerald-700/70">{order.branch}</p>
                  </td>
                  <td className="px-3 py-3 font-semibold text-emerald-900">{order.product}</td>
                  <td className="px-3 py-3 text-emerald-900">{order.quantity}</td>
                  <td className="px-3 py-3 font-bold text-emerald-700">{order.value}</td>
                  <td className="px-3 py-3">
                    <SupplierStatusPill label={order.status} />
                  </td>
                  <td className="px-3 py-3 text-emerald-900">{order.orderDate}</td>
                  <td className="px-3 py-3">
                    <button className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">Chi tiết</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SupplierPanel>
    </SupplierShell>
  )
}
