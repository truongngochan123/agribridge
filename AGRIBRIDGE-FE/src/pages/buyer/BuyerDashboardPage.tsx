import { Link } from 'react-router-dom'
import { buyerDashboardAlerts, buyerDashboardKpis, buyerRecentOrders } from '../../data/buyerDashboardData'
import { BuyerAlertCards, BuyerKpiCards, BuyerOrdersTable, BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'

export function BuyerDashboardPage() {
  return (
    <BuyerShell activeKey="overview" title="Tổng quan" subtitle="Theo dõi hoạt động mua hàng của bạn">
      <BuyerKpiCards items={buyerDashboardKpis} />

      <div className="mt-5">
        <h2 className="mb-3 text-xl font-bold text-emerald-950">Cảnh báo vận hành</h2>
        <BuyerAlertCards items={buyerDashboardAlerts} />
      </div>

      <div className="mt-5">
        <BuyerPanel title="Đơn hàng gần đây" right={<Link to="/buyer/orders" className="text-sm font-semibold text-emerald-700">Xem tất cả</Link>}>
          <BuyerOrdersTable rows={buyerRecentOrders} />
        </BuyerPanel>
      </div>
    </BuyerShell>
  )
}
