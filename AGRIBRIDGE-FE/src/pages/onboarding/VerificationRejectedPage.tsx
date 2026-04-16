import { Ban, LifeBuoy, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clearAuthSession, getStoredAuthSession } from '../../services/authSession'

export function VerificationRejectedPage() {
  const navigate = useNavigate()
  const payload = getStoredAuthSession()
  const verificationNote = payload?.verificationNote?.trim() || 'Admin chua d? l?i lý do chi ti?t.'
  const companyType = payload?.companyType === 'buyer' ? 'buyer' : 'supplier'

  function handleRegisterAgain() {
    clearAuthSession()
    navigate(`/onboarding/${companyType}/business-info`, { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-red-100 p-3 text-red-700">
            <Ban className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-600">H? so dã b? t? ch?i</p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-900">B?n không th? ti?p t?c dùng h? so hi?n t?i</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              H? so doanh nghi?p này dã b? t? ch?i và không còn n?m trong quy trình onboarding hi?n t?i. Khác v?i tr?ng thái
              c?n b? sung, b?n không th? s?a ti?p h? so này mà c?n dang ký l?i t? d?u n?u mu?n tham gia n?n t?ng.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="font-bold text-slate-900">Lý do t? ch?i g?n nh?t</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{verificationNote}</p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <button
            onClick={handleRegisterAgain}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <RotateCcw className="h-4 w-4" /> Ðang ký l?i
          </button>
          <button
            onClick={() => navigate('/support')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            <LifeBuoy className="h-4 w-4" /> Liên h? h? tr?
          </button>
        </div>
      </div>
    </div>
  )
}
