import { useEffect, useState } from 'react'
import { fetchSupplierDashboard } from '../../services/supplierService'
import type { SupplierDashboardPayload } from '../../types/supplierDashboard'

export function useSupplierDashboardData() {
  const [data, setData] = useState<SupplierDashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const payload = await fetchSupplierDashboard()
        if (!active) return
        setData(payload)
      } catch {
        if (!active) return
        setError('Không thể tải dữ liệu realtime. Vui lòng thử lại.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [])

  return {
    data,
    loading,
    error,
  }
}
