import { ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchPublicBatchTrace } from '../../services/supplierService'
import type { PublicBatchTraceResponse } from '../../types/supplierTrace'

export function PublicBatchTracePage() {
  const { batchId } = useParams<{ batchId: string }>()
  const [data, setData] = useState<PublicBatchTraceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!batchId) {
      setError('Không tìm thấy mã lô hàng.')
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const payload = await fetchPublicBatchTrace(Number(batchId))
        setData(payload)
      } catch {
        setError('Không thể tải dữ liệu truy xuất nguồn gốc.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [batchId])

  if (loading) {
    return <div className="mx-auto max-w-3xl p-4 text-sm font-semibold text-emerald-700">Đang tải dữ liệu truy xuất...</div>
  }

  if (error || !data) {
    return <div className="mx-auto max-w-3xl p-4 text-sm font-semibold text-rose-600">{error || 'Không có dữ liệu'}</div>
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 md:p-6">
      <section className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-xl border border-emerald-200 bg-white p-4">
          <h1 className="text-xl font-extrabold text-emerald-900">Truy xuất nguồn gốc lô hàng</h1>
          <p className="mt-1 text-sm text-slate-600">Mã lô: {data.batch.batchCode}</p>
          <a
            href={data.batch.qrCode}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Mở link QR public
          </a>
        </header>

        <InfoCard title="Thông tin sản phẩm">
          <InfoRow label="Tên sản phẩm" value={data.product.name} />
          <InfoRow label="Danh mục" value={data.product.category} />
          <InfoRow label="Xuất xứ" value={data.product.originProvince} />
          <InfoRow label="Đơn vị" value={data.product.unit} />
          <InfoRow label="Mô tả" value={data.product.description || 'N/A'} />
        </InfoCard>

        <InfoCard title="Thông tin lô hàng">
          <InfoRow label="Batch code" value={data.batch.batchCode} />
          <InfoRow label="Ngày thu hoạch" value={data.batch.harvestDate || 'N/A'} />
          <InfoRow label="Hạn sử dụng" value={data.batch.expiryDate || 'N/A'} />
          <InfoRow label="Grade" value={data.batch.grade || 'N/A'} />
          <InfoRow label="Size" value={data.batch.size || 'N/A'} />
          <InfoRow label="Tồn kho" value={`${data.batch.quantity} ${data.product.unit}`} />
          <InfoRow label="MOQ" value={`${data.batch.moq} ${data.product.unit}`} />
          <InfoRow label="Giá" value={String(data.batch.price)} />
          <InfoRow label="Nhiệt độ" value={data.batch.storageTemp || 'N/A'} />
          <InfoRow label="Video" value={data.batch.videoUrl || 'N/A'} />
        </InfoCard>

        <InfoCard title="Kiểm định QC">
          <InfoRow label="Kết quả" value={data.qc?.result || 'N/A'} />
          <InfoRow label="File QC" value={data.qc?.documentUrl || 'N/A'} />
          <InfoRow label="Ghi chú" value={data.qc?.notes || 'N/A'} />
        </InfoCard>

        <InfoCard title="Chứng nhận sản phẩm">
          {data.certifications.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có chứng nhận.</p>
          ) : (
            <div className="space-y-3">
              {data.certifications.map((certification, index) => (
                <div key={`${certification.name}-${index}`} className="rounded-lg border border-slate-200 p-3">
                  <InfoRow label="Tên" value={certification.name} />
                  <InfoRow label="Đơn vị cấp" value={certification.issuedBy || 'N/A'} />
                  <InfoRow label="Ngày cấp" value={certification.issuedDate || 'N/A'} />
                  <InfoRow label="Ngày hết hạn" value={certification.expiryDate || 'N/A'} />
                  <InfoRow label="File" value={certification.documentUrl || 'N/A'} />
                </div>
              ))}
            </div>
          )}
        </InfoCard>
      </section>
    </main>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-base font-bold text-slate-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className="col-span-2 break-words text-slate-900">{value}</span>
    </div>
  )
}
