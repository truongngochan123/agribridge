import {
  AlertCircle,
  ArrowDownLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import {
  createSupplierWithdrawal,
  fetchSupplierWallet,
  fetchSupplierWalletLedger,
  type WalletLedgerItem,
  type WalletSummary,
  type WithdrawalItem,
} from '../../services/walletService'

/* ─── constants ─────────────────────────────────────────────── */
const banks = [
  'Vietcombank', 'BIDV', 'VietinBank', 'Agribank', 'Techcombank',
  'MB Bank', 'ACB', 'Sacombank', 'VPBank', 'TPBank',
]
const quickAmounts = [500_000, 1_000_000, 2_000_000, 5_000_000]

const ledgerTypeLabel: Record<string, string> = {
  ESCROW_RELEASED:   'Giải ngân ký quỹ',
  WITHDRAW_REQUESTED:'Tạo yêu cầu rút',
  WITHDRAW_FEE:      'Phí rút tiền',
  WITHDRAW_REJECTED: 'Hoàn tiền rút',
  WITHDRAW_PAID:     'Đã chuyển tiền',
  WITHDRAW_APPROVED: 'Đã chuyển tiền',
}

const statusConfig: Record<string, { label: string; badge: string; dot: string }> = {
  PENDING:  { label: 'Chờ duyệt', badge: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500'   },
  APPROVED: { label: 'Đã duyệt',  badge: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-500'    },
  PAID:     { label: 'Đã chuyển', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED: { label: 'Từ chối',   badge: 'bg-red-100 text-red-700',        dot: 'bg-red-500'     },
}

/* ─── helpers ───────────────────────────────────────────────── */
type SavedAccount = {
  key: string; bankName: string; bankAccountNumber: string
  bankAccountName: string; lastUsedAt: string
}

function money(value?: number | null) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(Number(value || 0))
}
function numberInput(v: string) { return v.replace(/[^\d]/g, '') }
function formatAccount(v?: string | null) {
  if (!v) return '—'
  return v.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()
}
function accountKey(bank?: string | null, num?: string | null) {
  return `${String(bank || '').trim().toLowerCase()}|${String(num || '').replace(/\s/g, '')}`
}
function scFor(status: string) {
  return statusConfig[status] ?? { label: status, badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
}

/* ─── shimmer skeleton ───────────────────────────────────────── */
function Pulse({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-100 ${className ?? ''}`}>
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent)',
          animation: 'shimmer 1.6s infinite',
        }}
      />
    </div>
  )
}

/* ─── toast ─────────────────────────────────────────────────── */
function Toast({
  message, type, onDone,
}: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div
      className={`fixed bottom-5 right-5 z-[300] flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-2xl ${
        type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
      style={{ animation: 'slideUp 0.35s cubic-bezier(.34,1.56,.64,1) both' }}
    >
      {type === 'success'
        ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        : <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />}
      <p className="text-sm font-bold">{message}</p>
      <button onClick={onDone} className="ml-2 opacity-50 hover:opacity-80"><X className="h-4 w-4" /></button>
    </div>
  )
}

/* ─── main page ─────────────────────────────────────────────── */
export function SupplierWalletPage() {
  const [wallet, setWallet]   = useState<WalletSummary | null>(null)
  const [ledger, setLedger]   = useState<WalletLedgerItem[]>([])
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'ledger'>('withdrawals')
  const [amount, setAmount]   = useState('')
  const [bankName, setBankName]   = useState(banks[0])
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName]     = useState('')
  const [note, setNote]       = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const amountValue = Number(amount || 0)
  const available   = Number(wallet?.availableBalance || 0)
  const fee         = Math.round(Math.max(amountValue, 0) * 0.01)
  const payout      = Math.max(amountValue - fee, 0)
  const withdrawals = wallet?.withdrawals ?? []
  const hasPending  = withdrawals.some((w) => w.status === 'PENDING' || w.status === 'APPROVED')
  const canSubmit   =
    amountValue > 0 && amountValue <= available &&
    bankName && bankAccountNumber.trim().length >= 6 &&
    bankAccountName.trim().length >= 2 && !submitting

  const savedAccounts = useMemo<SavedAccount[]>(() => {
    const map = new Map<string, SavedAccount>()
    for (const item of withdrawals) {
      const nb = item.bankName?.trim()
      const nn = item.bankAccountNumber?.replace(/\s/g, '')
      const na = item.bankAccountName?.trim()
      if (!nb || !nn || !na) continue
      const key = accountKey(nb, nn)
      if (!map.has(key)) map.set(key, { key, bankName: nb, bankAccountNumber: nn, bankAccountName: na, lastUsedAt: item.requestedAt })
    }
    return Array.from(map.values()).slice(0, 3)
  }, [withdrawals])

  const progressText = useMemo(() => {
    if (amountValue <= 0) return 'Nhập số tiền để xem phí và số thực nhận.'
    if (amountValue > available) return 'Số tiền rút lớn hơn số dư khả dụng.'
    return 'Yêu cầu sẽ được admin duyệt trước khi chuyển khoản.'
  }, [amountValue, available])

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [summary, entries] = await Promise.all([fetchSupplierWallet(), fetchSupplierWalletLedger()])
      setWallet(summary)
      setLedger(entries)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function submitWithdrawal() {
    if (!canSubmit) { setToast({ msg: 'Vui lòng kiểm tra số tiền và thông tin tài khoản.', type: 'error' }); return }
    setSubmitting(true)
    try {
      await createSupplierWithdrawal({
        amount: amountValue, bankName,
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountName: bankAccountName.trim().toUpperCase(),
        note,
      })
      setAmount(''); setBankAccountNumber(''); setBankAccountName(''); setNote('')
      setActiveTab('withdrawals')
      setToast({ msg: 'Đã tạo yêu cầu rút tiền. Admin sẽ xử lý sớm nhất.', type: 'success' })
      await load(true)
    } catch {
      setToast({ msg: 'Không thể tạo yêu cầu rút tiền. Vui lòng thử lại.', type: 'error' })
    } finally { setSubmitting(false) }
  }

  function fillSaved(acc: SavedAccount) {
    setBankName(acc.bankName)
    setBankAccountNumber(acc.bankAccountNumber)
    setBankAccountName(acc.bankAccountName)
  }

  /* stat card config */
  const statCards = [
    {
      label: 'Khả dụng',    value: money(wallet?.availableBalance),
      gradient: 'from-emerald-500 to-teal-600', icon: <Wallet className="h-5 w-5 text-white" />,
      hint: 'Có thể rút ngay',
    },
    {
      label: 'Đang chờ rút', value: money(wallet?.pendingBalance),
      gradient: 'from-amber-500 to-orange-500', icon: <Clock3 className="h-5 w-5 text-white" />,
      hint: 'Đang xử lý',
    },
    {
      label: 'Tổng đã nhận', value: money(wallet?.totalEarned),
      gradient: 'from-blue-500 to-indigo-600',  icon: <TrendingUp className="h-5 w-5 text-white" />,
      hint: 'Từ các đơn hàng',
    },
    {
      label: 'Đã chuyển khoản', value: money(wallet?.totalWithdrawn),
      gradient: 'from-violet-500 to-purple-600', icon: <ArrowDownLeft className="h-5 w-5 text-white" />,
      hint: 'Tích lũy đã rút',
    },
  ]

  return (
    <SupplierShell activeKey="wallet" title="Ví số dư" subtitle="Rút tiền về tài khoản ngân hàng và theo dõi giao dịch ví">
      <style>{`
        @keyframes shimmer { 100% { transform: translateX(200%); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="space-y-5">
        {/* ── Stat cards ─────────────────────────────────────────── */}
        <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {statCards.map((card, i) =>
            loading ? (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <Pulse className="h-3.5 w-20" />
                  <Pulse className="h-9 w-9 rounded-xl" />
                </div>
                <Pulse className="h-6 w-28" />
                <Pulse className="h-3 w-16" />
              </div>
            ) : (
              <div
                key={card.label}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:shadow-md"
                style={{ animation: `fadeInUp 0.35s ease ${i * 55}ms both` }}
              >
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow`}>
                  {card.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-slate-900 sm:text-base">{card.value}</p>
                  <p className="text-[11px] font-medium text-slate-400">{card.label}</p>
                  <p className="hidden text-[10px] text-slate-300 sm:block">{card.hint}</p>
                </div>
              </div>
            )
          )}
        </section>

        {/* ── Body: form + right panel ────────────────────────────── */}
        <section className="grid gap-5 xl:grid-cols-[minmax(380px,480px)_1fr]">

          {/* ── Left: Withdrawal form ─────────────────────────────── */}
          <div
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            style={{ animation: 'fadeInUp 0.4s ease 220ms both' }}
          >
            {/* Form header */}
            <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow">
                  <Banknote className="h-4 w-4 text-white" />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Tạo yêu cầu rút tiền</h2>
                  <p className="text-[11px] text-slate-500">Phí xử lý 1% trừ ngay khi tạo yêu cầu</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {/* Pending warning */}
              {hasPending && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Bạn đang có yêu cầu chờ xử lý. Vẫn có thể tạo thêm nếu còn số dư.
                </div>
              )}

              {/* Saved accounts */}
              {savedAccounts.length > 0 && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-xs font-extrabold text-emerald-900">Tài khoản đã dùng gần đây</p>
                    <span className="text-[10px] font-bold text-emerald-600">Bấm để điền nhanh</span>
                  </div>
                  <div className="space-y-2">
                    {savedAccounts.map((acc) => (
                      <button
                        key={acc.key}
                        type="button"
                        onClick={() => fillSaved(acc)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-left transition hover:border-emerald-300 hover:shadow-sm"
                      >
                        <span>
                          <span className="block text-xs font-extrabold text-slate-900">{acc.bankName}</span>
                          <span className="block text-[11px] font-mono text-slate-500">
                            {formatAccount(acc.bankAccountNumber)} · {acc.bankAccountName}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                          Dùng lại
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount input */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Số tiền muốn rút
                </label>
                <div className="relative">
                  <input
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-14 text-lg font-extrabold text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
                    inputMode="numeric"
                    value={amount ? Number(amount).toLocaleString('vi-VN') : ''}
                    onChange={(e) => setAmount(numberInput(e.target.value))}
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₫</span>
                </div>
                {/* Quick amounts */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {quickAmounts.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setAmount(String(item))}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
                    >
                      {money(item)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAmount(String(Math.floor(available)))}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Rút tối đa
                  </button>
                </div>
              </div>

              {/* Fee summary */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                <SummaryRow label="Số tiền trừ khỏi ví" value={money(amountValue)} />
                <SummaryRow label="Phí rút tiền 1%" value={money(fee)} />
                <div className="border-t border-slate-200 pt-2">
                  <SummaryRow label="Thực nhận" value={money(payout)} strong />
                </div>
                <p className={`text-[11px] font-semibold ${amountValue > available ? 'text-rose-600' : 'text-slate-400'}`}>
                  {progressText}
                </p>
              </div>

              {/* Bank fields */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Ngân hàng</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                  >
                    {banks.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Số tài khoản</label>
                  <input
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-mono outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(numberInput(e.target.value))}
                    placeholder="Ví dụ: 0123456789"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Tên chủ tài khoản</label>
                <input
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm uppercase font-semibold outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="NGUYEN VAN A"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Ghi chú cho admin</label>
                <textarea
                  className="min-h-[72px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: chuyển trong giờ hành chính"
                />
              </div>

              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => void submitWithdrawal()}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-sm font-extrabold text-white shadow-md shadow-emerald-200 transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu rút tiền'}
              </button>
            </div>
          </div>

          {/* ── Right: Preview + History ──────────────────────────── */}
          <div className="space-y-4" style={{ animation: 'fadeInUp 0.4s ease 280ms both' }}>

            {/* Live transfer preview */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-sm">
                  <CreditCard className="h-4 w-4 text-white" />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Thông tin chuyển khoản</h2>
                  <p className="text-[11px] text-slate-400">Nội dung admin dùng để chuyển tiền đúng tài khoản</p>
                </div>
              </div>
              <div className="divide-y divide-slate-50 px-5 py-2">
                <InfoRow label="Ngân hàng"     value={bankName || '—'} />
                <InfoRow label="Số tài khoản"  value={formatAccount(bankAccountNumber)} mono />
                <InfoRow label="Chủ tài khoản" value={bankAccountName.trim().toUpperCase() || '—'} bold />
                <InfoRow
                  label="Số tiền chuyển"
                  value={payout > 0 ? money(payout) : '—'}
                  highlight={payout > 0}
                />
              </div>
            </div>

            {/* Withdrawals + Ledger tabs */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Tab header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 gap-1">
                  {(
                    [
                      { key: 'withdrawals', label: 'Yêu cầu rút' },
                      { key: 'ledger', label: 'Lịch sử ví' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                        activeTab === tab.key
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {activeTab === 'withdrawals' ? `${withdrawals.length} yêu cầu` : `${ledger.length} giao dịch`}
                  </span>
                  <button
                    onClick={() => void load(true)}
                    disabled={refreshing}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Table (scroll on mobile) */}
              <div className="overflow-x-auto">
                {activeTab === 'withdrawals'
                  ? <WithdrawalTable items={withdrawals} loading={loading} />
                  : <LedgerTable items={ledger} loading={loading} />}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </SupplierShell>
  )
}

/* ─── sub-components ─────────────────────────────────────────── */
function InfoRow({
  label, value, mono = false, bold = false, highlight = false,
}: { label: string; value: string; mono?: boolean; bold?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-right text-xs ${
        highlight ? 'text-base font-extrabold text-emerald-700'
        : bold    ? 'font-bold text-slate-900 uppercase tracking-wide'
        : mono    ? 'font-mono font-semibold text-slate-700'
        : 'font-semibold text-slate-700'
      }`}>
        {value}
      </span>
    </div>
  )
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={strong
        ? 'text-sm font-extrabold text-emerald-700'
        : 'text-xs font-bold text-slate-800'
      }>
        {value}
      </span>
    </div>
  )
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr key={i} className="border-t border-slate-50">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3.5">
              <Pulse className="h-3.5 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function WithdrawalTable({ items, loading }: { items: WithdrawalItem[]; loading: boolean }) {
  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <Wallet className="h-6 w-6 text-slate-400" />
        </span>
        <p className="text-sm font-bold text-slate-500">Chưa có yêu cầu rút tiền</p>
      </div>
    )
  }
  return (
    <table className="w-full min-w-[640px] text-left text-sm">
      <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        <tr>
          <th className="px-5 py-3.5 whitespace-nowrap">Mã yêu cầu</th>
          <th className="px-4 py-3.5 whitespace-nowrap">Số tiền</th>
          <th className="px-4 py-3.5 whitespace-nowrap">Phí</th>
          <th className="px-4 py-3.5 whitespace-nowrap">Thực nhận</th>
          <th className="px-4 py-3.5 whitespace-nowrap">Ngân hàng</th>
          <th className="px-4 py-3.5 whitespace-nowrap">Trạng thái</th>
          <th className="px-4 py-3.5 whitespace-nowrap">Thời gian</th>
        </tr>
      </thead>
      <tbody>
        {loading ? <TableSkeleton cols={7} /> : items.map((item, idx) => {
          const sc = scFor(item.status)
          return (
            <tr
              key={item.id}
              className="border-t border-slate-50 transition hover:bg-slate-50/50"
              style={{ animation: `fadeInUp 0.3s ease ${idx * 35}ms both` }}
            >
              <td className="px-5 py-3.5 font-extrabold text-slate-900">WD-{item.id}</td>
              <td className="px-4 py-3.5 text-slate-700">{money(item.amount)}</td>
              <td className="px-4 py-3.5 text-amber-600">{money(item.feeAmount)}</td>
              <td className="px-4 py-3.5 font-extrabold text-emerald-700">{money(item.payoutAmount ?? item.amount)}</td>
              <td className="px-4 py-3.5">
                <p className="font-bold text-slate-800">{item.bankName || '—'}</p>
                <p className="font-mono text-[11px] text-slate-400">{formatAccount(item.bankAccountNumber)}</p>
              </td>
              <td className="px-4 py-3.5">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${sc.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                  {sc.label}
                </span>
              </td>
              <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                {new Date(item.requestedAt).toLocaleString('vi-VN')}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function LedgerTable({ items, loading }: { items: WalletLedgerItem[]; loading: boolean }) {
  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <ReceiptText className="h-6 w-6 text-slate-400" />
        </span>
        <p className="text-sm font-bold text-slate-500">Chưa có giao dịch ví nào</p>
      </div>
    )
  }
  return (
    <table className="w-full min-w-[560px] text-left text-sm">
      <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        <tr>
          <th className="px-5 py-3.5">Loại giao dịch</th>
          <th className="px-4 py-3.5">Số tiền</th>
          <th className="px-4 py-3.5">Số dư sau</th>
          <th className="px-4 py-3.5">Đơn hàng</th>
          <th className="px-4 py-3.5">Thời gian</th>
        </tr>
      </thead>
      <tbody>
        {loading ? <TableSkeleton cols={5} /> : items.map((item, idx) => (
          <tr
            key={item.id}
            className="border-t border-slate-50 transition hover:bg-slate-50/50"
            style={{ animation: `fadeInUp 0.3s ease ${idx * 35}ms both` }}
          >
            <td className="px-5 py-3.5 font-semibold text-slate-800">
              {ledgerTypeLabel[item.entryType] ?? item.entryType}
            </td>
            <td className={`px-4 py-3.5 font-extrabold ${item.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {item.amount > 0 ? '+' : ''}{money(item.amount)}
            </td>
            <td className="px-4 py-3.5 text-slate-600">{money(item.balanceAfter)}</td>
            <td className="px-4 py-3.5 text-xs font-mono text-slate-400">
              {item.orderId ? `ORD-${item.orderId}` : '—'}
            </td>
            <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
              {new Date(item.createdAt).toLocaleString('vi-VN')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
