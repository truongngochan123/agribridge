import { AlertCircle, Banknote, CheckCircle2, Clock3, RefreshCw, ReceiptText, Wallet, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  createBuyerWithdrawal,
  fetchBuyerWallet,
  fetchBuyerWalletLedger,
  type WalletLedgerItem,
  type WalletSummary,
} from '../../services/walletService'

const banks = ['Vietcombank', 'BIDV', 'VietinBank', 'Agribank', 'MB Bank', 'ACB', 'Sacombank', 'VPBank', 'TPBank']
const quickAmounts = [500_000, 1_000_000, 2_000_000, 5_000_000]

const ledgerTypeLabel: Record<string, string> = {
  REFUND: 'Hoàn tiền',
  WITHDRAW_REQUESTED: 'Tạo yêu cầu rút',
  WITHDRAW_FEE: 'Phí rút tiền',
  WITHDRAW_REJECTED: 'Hoàn lại yêu cầu rút',
  WITHDRAW_PAID: 'Đã chuyển khoản',
}

function money(value?: number | null) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + ' đ'
}

function numberInput(value: string) {
  return value.replace(/[^\d]/g, '')
}

export function BuyerWalletPage() {
  usePageTitle('Ví hoàn tiền')

  const [wallet, setWallet] = useState<WalletSummary | null>(null)
  const [ledger, setLedger] = useState<WalletLedgerItem[]>([])
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'ledger'>('withdrawals')
  const [amount, setAmount] = useState('')
  const [bankName, setBankName] = useState(banks[0])
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const amountValue = Number(amount || 0)
  const available = Number(wallet?.availableBalance || 0)
  const pending = Number(wallet?.pendingBalance || 0)
  const fee = Math.round(Math.max(amountValue, 0) * 0.01)
  const payout = Math.max(amountValue - fee, 0)
  const withdrawals = wallet?.withdrawals ?? []
  const canSubmit =
    amountValue > 0 &&
    amountValue <= available &&
    bankAccountNumber.trim().length >= 6 &&
    bankAccountName.trim().length >= 2 &&
    !submitting

  const progressText = useMemo(() => {
    if (amountValue <= 0) return 'Nhập số tiền muốn rút từ số dư hoàn tiền.'
    if (amountValue > available) return 'Số tiền rút lớn hơn số dư khả dụng.'
    return 'Yêu cầu sẽ được admin duyệt trước khi chuyển khoản.'
  }, [amountValue, available])

  async function load() {
    setLoading(true)
    try {
      const [summary, entries] = await Promise.all([fetchBuyerWallet(), fetchBuyerWalletLedger()])
      setWallet(summary)
      setLedger(entries)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function submitWithdrawal() {
    if (!canSubmit) {
      setToast({ msg: 'Vui lòng kiểm tra số tiền và thông tin tài khoản.', type: 'error' })
      return
    }
    setSubmitting(true)
    try {
      await createBuyerWithdrawal({
        amount: amountValue,
        bankName,
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountName: bankAccountName.trim().toUpperCase(),
        note,
      })
      setAmount('')
      setBankAccountNumber('')
      setBankAccountName('')
      setNote('')
      setActiveTab('withdrawals')
      setToast({ msg: 'Đã tạo yêu cầu rút tiền. Admin sẽ xử lý sớm nhất.', type: 'success' })
      await load()
    } catch {
      setToast({ msg: 'Không thể tạo yêu cầu rút tiền. Vui lòng thử lại.', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BuyerShell activeKey="wallet" title="Ví hoàn tiền" subtitle="Rút số tiền được admin hoàn về tài khoản ngân hàng">
      <div className="space-y-5">
        {toast ? (
          <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${
            toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{toast.msg}</span>
            <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => setToast(null)}><X className="h-4 w-4" /></button>
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3">
          <StatCard icon={<Wallet className="h-5 w-5 text-white" />} label="Khả dụng" value={money(available)} hint="Có thể rút ngay" color="from-emerald-500 to-teal-600" />
          <StatCard icon={<Clock3 className="h-5 w-5 text-white" />} label="Đang chờ rút" value={money(pending)} hint="Admin đang xử lý" color="from-amber-500 to-orange-500" />
          <StatCard icon={<ReceiptText className="h-5 w-5 text-white" />} label="Giao dịch ví" value={String(ledger.length)} hint="Refund và rút tiền" color="from-blue-500 to-indigo-600" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(360px,460px)_1fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 shadow">
                  <Banknote className="h-4 w-4 text-white" />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Tạo yêu cầu rút tiền</h2>
                  <p className="text-[11px] text-slate-500">Phí xử lý 1% trừ ngay khi tạo yêu cầu</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Số tiền muốn rút</span>
                <input
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-extrabold text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
                  inputMode="numeric"
                  value={amount ? Number(amount).toLocaleString('vi-VN') : ''}
                  onChange={(e) => setAmount(numberInput(e.target.value))}
                  placeholder="0"
                />
              </label>

              <div className="flex flex-wrap gap-1.5">
                {quickAmounts.map((item) => (
                  <button key={item} type="button" onClick={() => setAmount(String(item))} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
                    {money(item)}
                  </button>
                ))}
                <button type="button" onClick={() => setAmount(String(Math.floor(available)))} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  Rút tối đa
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <SummaryRow label="Số tiền trừ khỏi ví" value={money(amountValue)} />
                <SummaryRow label="Phí rút tiền 1%" value={money(fee)} />
                <SummaryRow label="Thực nhận" value={money(payout)} strong />
                <p className={`mt-3 text-xs font-semibold ${amountValue > available ? 'text-red-500' : 'text-slate-400'}`}>{progressText}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Ngân hàng</span>
                  <select value={bankName} onChange={(e) => setBankName(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400">
                    {banks.map((bank) => <option key={bank}>{bank}</option>)}
                  </select>
                </label>
                <TextField label="Số tài khoản" value={bankAccountNumber} onChange={setBankAccountNumber} placeholder="Ví dụ: 0123456789" />
              </div>
              <TextField label="Tên chủ tài khoản" value={bankAccountName} onChange={setBankAccountName} placeholder="NGUYEN VAN A" />
              <TextField label="Ghi chú cho admin" value={note} onChange={setNote} placeholder="Ví dụ: chuyển trong giờ hành chính" />

              <button onClick={submitWithdrawal} disabled={!canSubmit} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? 'Đang gửi...' : 'Tạo yêu cầu rút tiền'}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <TabButton active={activeTab === 'withdrawals'} onClick={() => setActiveTab('withdrawals')}>Yêu cầu rút</TabButton>
                <TabButton active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')}>Lịch sử ví</TabButton>
              </div>
              <button onClick={() => void load()} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              {activeTab === 'withdrawals'
                ? <WithdrawalTable items={withdrawals} loading={loading} />
                : <LedgerTable items={ledger} loading={loading} />}
            </div>
          </div>
        </section>
      </div>
    </BuyerShell>
  )
}

function StatCard({ icon, label, value, hint, color }: { icon: ReactNode; label: string; value: string; hint: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color}`}>{icon}</span>
      <div>
        <p className="text-base font-extrabold text-slate-900">{value}</p>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="text-[11px] text-slate-400">{hint}</p>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between py-1 ${strong ? 'border-t border-slate-200 pt-3 font-extrabold text-emerald-700' : 'text-slate-600'}`}><span>{label}</span><span>{value}</span></div>
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400" />
    </label>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`rounded-lg px-3 py-1.5 text-xs font-extrabold ${active ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-white'}`}>{children}</button>
}

function WithdrawalTable({ items, loading }: { items: NonNullable<WalletSummary['withdrawals']>; loading: boolean }) {
  if (!loading && items.length === 0) return <EmptyState text="Chưa có yêu cầu rút tiền" />
  return (
    <table className="w-full min-w-[640px] text-left text-sm">
      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase text-slate-400">
        <tr><th className="px-5 py-3">Số tiền</th><th className="px-4 py-3">Thực nhận</th><th className="px-4 py-3">Ngân hàng</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Ngày tạo</th></tr>
      </thead>
      <tbody>{items.map((item) => (
        <tr key={item.id} className="border-t border-slate-50">
          <td className="px-5 py-3 font-extrabold text-slate-900">{money(item.amount)}</td>
          <td className="px-4 py-3 font-bold text-emerald-700">{money(item.payoutAmount ?? item.amount)}</td>
          <td className="px-4 py-3 text-slate-600">{item.bankName} - {item.bankAccountNumber}</td>
          <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{item.status}</span></td>
          <td className="px-4 py-3 text-xs text-slate-400">{new Date(item.requestedAt).toLocaleString('vi-VN')}</td>
        </tr>
      ))}</tbody>
    </table>
  )
}

function LedgerTable({ items, loading }: { items: WalletLedgerItem[]; loading: boolean }) {
  if (!loading && items.length === 0) return <EmptyState text="Chưa có giao dịch ví nào" />
  return (
    <table className="w-full min-w-[560px] text-left text-sm">
      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase text-slate-400">
        <tr><th className="px-5 py-3">Loại</th><th className="px-4 py-3">Số tiền</th><th className="px-4 py-3">Số dư sau</th><th className="px-4 py-3">Mô tả</th><th className="px-4 py-3">Thời gian</th></tr>
      </thead>
      <tbody>{items.map((item) => (
        <tr key={item.id} className="border-t border-slate-50">
          <td className="px-5 py-3 font-bold text-slate-800">{ledgerTypeLabel[item.entryType] ?? item.entryType}</td>
          <td className={`px-4 py-3 font-extrabold ${item.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{item.amount > 0 ? '+' : ''}{money(item.amount)}</td>
          <td className="px-4 py-3 text-slate-600">{money(item.balanceAfter)}</td>
          <td className="px-4 py-3 text-slate-500">{item.description || '—'}</td>
          <td className="px-4 py-3 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
        </tr>
      ))}</tbody>
    </table>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
        <ReceiptText className="h-6 w-6 text-slate-400" />
      </span>
      <p className="text-sm font-bold text-slate-500">{text}</p>
    </div>
  )
}
