import { ArrowLeft, PackageSearch } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { BuyerPanel } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'

export function BuyerProductBatchesPlaceholderPage() {
  const { productId } = useParams()

  return (
    <BuyerShell activeKey="sourcing" title="Lô hàng của sản phẩm" subtitle={`Danh sách lô khả dụng cho sản phẩm #${productId ?? ''}`}>
      <BuyerPanel>
        <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
          <PackageSearch className="mb-3 h-12 w-12 text-emerald-500" />
          <h2 className="text-2xl font-extrabold text-emerald-950">Danh sách lô hàng sẽ được hoàn thiện ở bước sau</h2>
          <p className="mt-2 max-w-xl text-sm text-emerald-700/75">
            Buyer đã được điều hướng đúng theo product. Khi triển khai tiếp, trang này sẽ hiển thị các batch AVAILABLE để chọn lô trước khi đặt hàng.
          </p>
          <Link to="/buyer/sourcing" className="mt-5 inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
            <ArrowLeft className="h-4 w-4" />
            Quay lại tìm nguồn hàng
          </Link>
        </div>
      </BuyerPanel>
    </BuyerShell>
  )
}
