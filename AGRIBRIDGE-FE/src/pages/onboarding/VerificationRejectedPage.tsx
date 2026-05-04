import { Ban, LifeBuoy, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clearAuthSession, getStoredAuthSession } from '../../services/authSession'
import { usePageTitle } from '../../hooks/usePageTitle'

export function VerificationRejectedPage() {
  usePageTitle('Hồ sơ bị từ chối')
  const navigate = useNavigate()
  const payload = getStoredAuthSession()
  const verificationNote = payload?.verificationNote?.trim() || 'Admin chua de lai ly do chi tiet.'
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-600">Ho so da bi tu choi</p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Ban khong the tiep tuc dung ho so hien tai</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Ho so doanh nghiep nay da bi tu choi va khong con nam trong quy trinh onboarding hien tai. Khac voi trang thai
              can bo sung, ban khong the sua tiep ho so nay ma can dang ky lai tu dau neu muon tham gia nen tang.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="font-bold text-slate-900">Ly do tu choi gan nhat</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{verificationNote}</p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <button
            onClick={handleRegisterAgain}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <RotateCcw className="h-4 w-4" /> Dang ky lai
          </button>
          <button
            onClick={() => navigate('/support')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            <LifeBuoy className="h-4 w-4" /> Lien he ho tro
          </button>
        </div>
      </div>
    </div>
  )
}
