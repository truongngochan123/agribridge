import { AlertCircle, Banknote, Clock3, CreditCard, ReceiptText, ShieldCheck, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import {
  createSupplierWithdrawal,
  fetchSupplierWallet,
  fetchSupplierWalletLedger,
  type WalletLedgerItem,
  type WalletSummary,
  type WithdrawalItem,
} from '../../services/walletService'

const banks = [
  'Vietcombank',
  'BIDV',
  'VietinBank',
  'Agribank',
  'Techcombank',
  'MB Bank',
  'ACB',
  'Sacombank',
  'VPBank',
  'TPBank',
]

const quickAmounts = [500000, 1000000, 2000000, 5000000]

type SavedWithdrawalAccount = {
  key: string
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
  lastUsedAt: string
}

const ledgerTypeLabel: Record<string, string> = {
  ESCROW_RELEASED: 'Giải ngân ký quỹ',
  WITHDRAW_REQUESTED: 'Tạo yêu cầu rút',
  WITHDRAW_FEE: 'Phí rút tiền',
  WITHDRAW_REJECTED: 'Hoàn tiền rút',
  WITHDRAW_PAID: 'Đã chuyển tiền',
  WITHDRAW_APPROVED: 'Đã chuyển tiền',
}

const statusLabel: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  PAID: 'Đã chuyển',
  REJECTED: 'Từ chối',
}

function money(value?: number | null) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function numberInput(value: string) {
  return value.replace(/[^\d]/g, '')
}

function formatAccount(value?: string | null) {
  if (!value) return '-'
  return value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()
}

function accountKey(bankName?: string | null, bankAccountNumber?: string | null) {
  return `${String(bankName || '').trim().toLowerCase()}|${String(bankAccountNumber || '').replace(/\s/g, '')}`
}

function statusClass(status: string) {
  switch (status) {
    case 'PAID':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'APPROVED':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'REJECTED':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700'
  }
}

export function SupplierWalletPage() {
  const [wallet, setWallet] = useState<WalletSummary | null>(null)
  const [ledger, setLedger] = useState<WalletLedgerItem[]>([])
  const [activeTab, setActiveTab] = useState<'ledger' | 'withdrawals'>('withdrawals')
  const [amount, setAmount] = useState('')
  const [bankName, setBankName] = useState(banks[0])
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const amountValue = Number(amount || 0)
  const available = Number(wallet?.availableBalance || 0)
  const fee = Math.round(Math.max(amountValue, 0) * 0.01)
  const payout = Math.max(amountValue - fee, 0)
  const withdrawals = wallet?.withdrawals ?? []
  const hasPendingWithdrawal = withdrawals.some((item) => item.status === 'PENDING' || item.status === 'APPROVED')
  const canSubmit = amountValue > 0 && amountValue <= available && bankName && bankAccountNumber.trim().length >= 6 && bankAccountName.trim().length >= 2 && !submitting

  const savedAccounts = useMemo<SavedWithdrawalAccount[]>(() => {
    const accounts = new Map<string, SavedWithdrawalAccount>()
    for (const item of withdrawals) {
      const normalizedBank = item.bankName?.trim()
      const normalizedNumber = item.bankAccountNumber?.replace(/\s/g, '')
      const normalizedName = item.bankAccountName?.trim()
      if (!normalizedBank || !normalizedNumber || !normalizedName) continue
      const key = accountKey(normalizedBank, normalizedNumber)
      if (!accounts.has(key)) {
        accounts.set(key, {
          key,
          bankName: normalizedBank,
          bankAccountNumber: normalizedNumber,
          bankAccountName: normalizedName,
          lastUsedAt: item.requestedAt,
        })
      }
    }
    return Array.from(accounts.values()).slice(0, 3)
  }, [withdrawals])

  const progressText = useMemo(() => {
    if (amountValue <= 0) return 'Nhập số tiền để xem phí và số thực nhận.'
    if (amountValue > available) return 'Số tiền rút lớn hơn số dư khả dụng.'
    return 'Yêu cầu sẽ được admin duyệt trước khi chuyển khoản.'
  }, [amountValue, available])

  async function load() {
    setLoading(true)
    try {
      const [summary, entries] = await Promise.all([fetchSupplierWallet(), fetchSupplierWalletLedger()])
      setWallet(summary)
      setLedger(entries)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function submitWithdrawal() {
    if (!canSubmit) {
      setMessage('Vui lòng kiểm tra số tiền và thông tin tài khoản nhận.')
      return
    }

    setSubmitting(true)
    setMessage('')
    try {
      await createSupplierWithdrawal({
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
      setMessage('Đã tạo yêu cầu rút tiền. Admin sẽ xử lý trong thời gian sớm nhất.')
      setActiveTab('withdrawals')
      await load()
    } catch {
      setMessage('Không thể tạo yêu cầu rút tiền. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSavedAccount(account: SavedWithdrawalAccount) {
    setBankName(account.bankName)
    setBankAccountNumber(account.bankAccountNumber)
    setBankAccountName(account.bankAccountName)
    setMessage('')
  }

  return (
    <SupplierShell activeKey="wallet" title="Ví số dư" subtitle="Rút tiền về tài khoản ngân hàng và theo dõi giao dịch ví">
      <div className="space-y-5">
        {loading ? <p className="text-sm font-semibold text-slate-500">Đang tải dữ liệu ví...</p> : null}

        <section className="grid gap-4 md:grid-cols-4">
          <Stat icon={<Wallet className="h-4 w-4" />} label="Khả dụng" value={money(wallet?.availableBalance)} tone="emerald" />
          <Stat icon={<Clock3 className="h-4 w-4" />} label="Đang chờ rút" value={money(wallet?.pendingBalance)} tone="amber" />
          <Stat icon={<ReceiptText className="h-4 w-4" />} label="Đã nhận" value={money(wallet?.totalEarned)} tone="blue" />
          <Stat icon={<Banknote className="h-4 w-4" />} label="Đã chuyển" value={money(wallet?.totalWithdrawn)} tone="slate" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(420px,520px)_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-extrabold text-slate-900">Tạo yêu cầu rút tiền</h2>
              <p className="mt-1 text-sm text-slate-500">Phí xử lý 1% được trừ ngay khi tạo yêu cầu.</p>
            </div>

            <div className="grid gap-4 p-5">
              {hasPendingWithdrawal ? (
                <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Bạn đang có yêu cầu chờ xử lý. Có thể tạo thêm yêu cầu nếu vẫn còn số dư khả dụng.</span>
                </div>
              ) : null}

              {savedAccounts.length > 0 ? (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-extrabold text-emerald-900">Tài khoản đã dùng gần đây</p>
                    <span className="text-xs font-semibold text-emerald-700">Bấm để điền nhanh</span>
                  </div>
                  <div className="grid gap-2">
                    {savedAccounts.map((account) => (
                      <button
                        key={account.key}
                        type="button"
                        onClick={() => handleSavedAccount(account)}
                        className="flex items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-left transition hover:border-emerald-300 hover:shadow-sm"
                      >
                        <span>
                          <span className="block text-sm font-extrabold text-slate-900">{account.bankName}</span>
                          <span className="block text-xs font-semibold text-slate-500">{formatAccount(account.bankAccountNumber)} - {account.bankAccountName}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-extrabold text-emerald-700">Dùng lại</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <Field label="Số tiền muốn rút">
                <div className="relative">
                  <input
                    className="h-12 w-full rounded-lg border border-slate-200 px-3 pr-14 text-lg font-extrabold text-slate-900 outline-none ring-emerald-200 focus:ring-2"
                    inputMode="numeric"
                    value={amount ? Number(amount).toLocaleString('vi-VN') : ''}
                    onChange={(event) => setAmount(numberInput(event.target.value))}
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VND</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {quickAmounts.map((item) => (
                    <button key={item} type="button" onClick={() => setAmount(String(item))} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
                      {money(item)}
                    </button>
                  ))}
                  <button type="button" onClick={() => setAmount(String(Math.floor(available)))} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Rút tối đa
                  </button>
                </div>
              </Field>

              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <SummaryRow label="Số tiền trừ khỏi ví" value={money(amountValue)} />
                <SummaryRow label="Phí rút tiền 1%" value={money(fee)} />
                <SummaryRow label="Thực nhận" value={money(payout)} strong />
                <p className={`text-xs font-semibold ${amountValue > available ? 'text-rose-600' : 'text-slate-500'}`}>{progressText}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Ngân hàng">
                  <select value={bankName} onChange={(event) => setBankName(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none ring-emerald-200 focus:ring-2">
                    {banks.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
                  </select>
                </Field>
                <Field label="Số tài khoản">
                  <input className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none ring-emerald-200 focus:ring-2" value={bankAccountNumber} onChange={(event) => setBankAccountNumber(numberInput(event.target.value))} placeholder="Ví dụ: 0123456789" />
                </Field>
              </div>

              <Field label="Tên chủ tài khoản">
                <input className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm uppercase outline-none ring-emerald-200 focus:ring-2" value={bankAccountName} onChange={(event) => setBankAccountName(event.target.value)} placeholder="NGUYEN VAN A" />
              </Field>

              <Field label="Ghi chú cho admin">
                <textarea className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-200 focus:ring-2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: chuyển trong giờ hành chính" />
              </Field>

              {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{message}</p> : null}
              <button type="button" disabled={!canSubmit} onClick={() => void submitWithdrawal()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                <ShieldCheck className="h-4 w-4" />
                {submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu rút tiền'}
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Thông tin chuyển khoản</h2>
                  <p className="mt-1 text-sm text-slate-500">Nội dung này giúp admin chuyển đúng tài khoản nhận.</p>
                </div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <CreditCard className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-4 grid gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <SummaryRow label="Ngân hàng" value={bankName || '-'} />
                <SummaryRow label="Số tài khoản" value={formatAccount(bankAccountNumber)} />
                <SummaryRow label="Chủ tài khoản" value={bankAccountName.trim().toUpperCase() || '-'} />
                <SummaryRow label="Số tiền chuyển" value={money(payout)} strong />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <TabButton active={activeTab === 'withdrawals'} onClick={() => setActiveTab('withdrawals')}>Yêu cầu rút</TabButton>
                  <TabButton active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')}>Lịch sử ví</TabButton>
                </div>
                <p className="text-xs font-semibold text-slate-400">{activeTab === 'withdrawals' ? `${withdrawals.length} yêu cầu` : `${ledger.length} giao dịch`}</p>
              </div>

              <div className="overflow-x-auto">
                {activeTab === 'withdrawals' ? <WithdrawalTable items={withdrawals} /> : <LedgerTable items={ledger} />}
              </div>
            </div>
          </div>
        </section>
      </div>
    </SupplierShell>
  )
}

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: 'emerald' | 'amber' | 'blue' | 'slate' }) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-100 text-slate-700',
  }[tone]
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>{icon}</span>
      </div>
      <p className="mt-2 text-xl font-extrabold text-slate-900">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-800">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  )
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? 'text-base font-extrabold text-emerald-700' : 'font-bold text-slate-900'}>{value}</span>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-md px-3 py-1.5 text-xs font-extrabold transition ${active ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
      {children}
    </button>
  )
}

function WithdrawalTable({ items }: { items: WithdrawalItem[] }) {
  if (items.length === 0) {
    return <p className="p-5 text-sm font-semibold text-slate-500">Chưa có yêu cầu rút tiền.</p>
  }
  return (
    <table className="w-full min-w-[760px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th className="px-5 py-3">Mã yêu cầu</th>
          <th>Số tiền</th>
          <th>Phí</th>
          <th>Thực nhận</th>
          <th>Ngân hàng</th>
          <th>Trạng thái</th>
          <th>Thời gian</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-t border-slate-100">
            <td className="px-5 py-3 font-extrabold text-slate-900">WD-{item.id}</td>
            <td>{money(item.amount)}</td>
            <td>{money(item.feeAmount)}</td>
            <td className="font-bold text-emerald-700">{money(item.payoutAmount ?? item.amount)}</td>
            <td>
              <p className="font-bold text-slate-900">{item.bankName || '-'}</p>
              <p className="text-xs text-slate-500">{formatAccount(item.bankAccountNumber)}</p>
            </td>
            <td><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-extrabold ${statusClass(item.status)}`}>{statusLabel[item.status] ?? item.status}</span></td>
            <td className="text-slate-500">{new Date(item.requestedAt).toLocaleString('vi-VN')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LedgerTable({ items }: { items: WalletLedgerItem[] }) {
  if (items.length === 0) {
    return <p className="p-5 text-sm font-semibold text-slate-500">Chưa có giao dịch ví.</p>
  }
  return (
    <table className="w-full min-w-[720px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          <th className="px-5 py-3">Loại</th>
          <th>Số tiền</th>
          <th>Số dư sau</th>
          <th>Đơn</th>
          <th>Thời gian</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-t border-slate-100">
            <td className="px-5 py-3 font-semibold">{ledgerTypeLabel[item.entryType] ?? item.entryType}</td>
            <td className={item.amount < 0 ? 'font-bold text-rose-600' : 'font-bold text-emerald-700'}>{money(item.amount)}</td>
            <td>{money(item.balanceAfter)}</td>
            <td>{item.orderId ? `ORD-${item.orderId}` : '-'}</td>
            <td className="text-slate-500">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
