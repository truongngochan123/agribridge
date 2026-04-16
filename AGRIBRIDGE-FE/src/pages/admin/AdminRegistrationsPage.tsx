import { AlertTriangle, Check, Eye, FileText, Mail, RotateCcw, Search, Send, X, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AdminShell } from '../../components/admin/AdminShell'
import {
  approveRegistrationProfile,
  fetchRegistrationProfiles,
  reopenRegistrationProfile,
  rejectRegistrationProfile,
  requestMoreInfoForRegistration,
} from '../../services/adminService'
import { canOpenUploadedFile, resolveUploadedFileUrl } from '../../services/uploadService'
import type { AdminRegistrationActionRequest, AdminRegistrationProfile, AdminRegistrationStatus } from '../../types/admin'

type ActionMode = 'need-more-info' | 'reject' | null

type ActionFormState = {
  reasonCodes: string[]
  note: string
  sendEmail: boolean
  sendNotification: boolean
}

const registrationTabs: Array<{ key: AdminRegistrationStatus; label: string }> = [
  { key: 'PENDING', label: 'Chờ duyệt' },
  { key: 'NEED_MORE_INFO', label: 'Yêu cầu bổ sung' },
  { key: 'REJECTED', label: 'Đã từ chối' },
  { key: 'APPROVED', label: 'Đã duyệt' },
]

const needMoreInfoReasons = [
  { code: 'missing_documents', label: 'Thiếu giấy tờ bắt buộc' },
  { code: 'blurred_documents', label: 'Giấy tờ không rõ nét' },
  { code: 'incorrect_company_information', label: 'Sai thông tin doanh nghiệp' },
  { code: 'missing_company_images', label: 'Thiếu ảnh doanh nghiệp' },
  { code: 'missing_contact_information', label: 'Cần bổ sung thông tin liên hệ' },
  { code: 'missing_verification_description', label: 'Cần bổ sung mô tả / thông tin xác minh' },
  { code: 'other', label: 'Khác' },
]

const rejectionReasons = [
  { code: 'fraudulent_documents', label: 'Giấy tờ giả / không hợp lệ' },
  { code: 'dishonest_information', label: 'Thông tin doanh nghiệp không trung thực' },
  { code: 'duplicate_company', label: 'Doanh nghiệp đã tồn tại trong hệ thống' },
  { code: 'duplicate_registration', label: 'Hồ sơ đăng ký trùng lặp' },
  { code: 'not_qualified', label: 'Không đủ điều kiện tham gia nền tảng' },
  { code: 'policy_violation', label: 'Vi phạm chính sách nền tảng' },
  { code: 'other', label: 'Khác' },
]

const statusTone: Record<AdminRegistrationStatus, 'amber' | 'sky' | 'red' | 'emerald'> = {
  PENDING: 'amber',
  NEED_MORE_INFO: 'sky',
  REJECTED: 'red',
  APPROVED: 'emerald',
}

const statusBadgeClass: Record<'amber' | 'sky' | 'red' | 'emerald' | 'slate', string> = {
  amber: 'bg-amber-100 text-amber-700',
  sky: 'bg-sky-100 text-sky-700',
  red: 'bg-red-100 text-red-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  slate: 'bg-slate-100 text-slate-700',
}

const companyTypeLabel = {
  supplier: 'Nhà cung cấp',
  buyer: 'Nhà buôn',
} as const

const businessTypeLabel = {
  business: 'Doanh nghiệp',
  individual: 'Cá nhân',
} as const

const emptyStateByTab: Record<AdminRegistrationStatus, string> = {
  PENDING: 'Không có hồ sơ nào đang chờ duyệt.',
  NEED_MORE_INFO: 'Không có hồ sơ nào đang cần bổ sung.',
  REJECTED: 'Không có hồ sơ nào đã bị từ chối.',
  APPROVED: 'Chưa có hồ sơ đã được duyệt trong lịch sử hiện tại.',
}

function createInitialActionState(selected?: AdminRegistrationProfile | null): ActionFormState {
  return {
    reasonCodes: selected?.reasonCodes ?? [],
    note: selected?.verificationNote ?? '',
    sendEmail: false,
    sendNotification: true,
  }
}

export function AdminRegistrationsPage() {
  const [activeStatus, setActiveStatus] = useState<AdminRegistrationStatus>('PENDING')
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<AdminRegistrationProfile[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<'approve' | 'need-more-info' | 'reject' | 'reopen' | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [actionForm, setActionForm] = useState<ActionFormState>(createInitialActionState())

  useEffect(() => {
    let active = true
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true)
        setError('')
        const payload = await fetchRegistrationProfiles(activeStatus, query)
        if (!active) return
        setProfiles(payload)
        setSelectedId((current) => {
          if (current && payload.some((item) => item.companyId === current)) {
            return current
          }
          return payload[0]?.companyId ?? null
        })
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách hồ sơ đăng ký.')
      } finally {
        if (active) setLoading(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [activeStatus, query, reloadKey])

  const selected = useMemo(
    () => profiles.find((item) => item.companyId === selectedId) ?? profiles[0] ?? null,
    [profiles, selectedId],
  )

  function openActionModal(mode: Exclude<ActionMode, null>) {
    setActionMode(mode)
    setActionForm(createInitialActionState(selected))
  }

  function closeActionModal() {
    setActionMode(null)
    setActionForm(createInitialActionState(selected))
  }

  async function handleApprove() {
    if (!selected) return
    const confirmed = window.confirm(`Phê duyệt hồ sơ của "${selected.companyName}"?`)
    if (!confirmed) return
    try {
      setActionLoading('approve')
      setError('')
      const updated = await approveRegistrationProfile(selected.companyId, {
        adminUserId: getAdminUserId(),
        sendEmail: false,
        sendNotification: true,
      })
      syncProfileAfterMutation(updated)
      setReloadKey((current) => current + 1)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Không phê duyệt được hồ sơ.')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReopen() {
    if (!selected) return
    try {
      setActionLoading('reopen')
      setError('')
      const updated = await reopenRegistrationProfile(selected.companyId, {
        adminUserId: getAdminUserId(),
        note: 'Admin mở lại hồ sơ để xét duyệt lại.',
        sendEmail: false,
        sendNotification: true,
      })
      syncProfileAfterMutation(updated)
      setReloadKey((current) => current + 1)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Không mở lại được hồ sơ.')
    } finally {
      setActionLoading(null)
    }
  }

  async function submitActionModal() {
    if (!selected || !actionMode) return
    const hasReason = actionForm.reasonCodes.length > 0
    const hasNote = actionForm.note.trim().length > 0
    if (!hasReason && !hasNote) {
      setError('Vui lòng chọn ít nhất một lý do hoặc nhập ghi chú chi tiết.')
      return
    }

    const payload: AdminRegistrationActionRequest = {
      adminUserId: getAdminUserId(),
      reasonCodes: actionForm.reasonCodes,
      note: actionForm.note,
      sendEmail: actionForm.sendEmail,
      sendNotification: actionForm.sendNotification,
    }

    try {
      setActionLoading(actionMode)
      setError('')
      const updated =
        actionMode === 'need-more-info'
          ? await requestMoreInfoForRegistration(selected.companyId, payload)
          : await rejectRegistrationProfile(selected.companyId, payload)
      syncProfileAfterMutation(updated)
      setReloadKey((current) => current + 1)
      closeActionModal()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Không xử lý được hồ sơ.')
    } finally {
      setActionLoading(null)
    }
  }

  function syncProfileAfterMutation(updated: AdminRegistrationProfile) {
    setProfiles((current) => {
      if (updated.verificationStatus !== activeStatus) {
        return current.filter((item) => item.companyId !== updated.companyId)
      }
      const exists = current.some((item) => item.companyId === updated.companyId)
      return exists ? current.map((item) => (item.companyId === updated.companyId ? updated : item)) : [updated, ...current]
    })
    setSelectedId(updated.verificationStatus === activeStatus ? updated.companyId : null)
  }

  const reasonOptions = actionMode === 'reject' ? rejectionReasons : needMoreInfoReasons
  const modalTitle = actionMode === 'reject' ? 'Từ chối hồ sơ' : 'Yêu cầu bổ sung hồ sơ'
  const modalSubmitLabel = actionMode === 'reject' ? 'Xác nhận từ chối' : 'Gửi yêu cầu bổ sung'
  const modalPreview = buildPreviewMessage(actionMode, selected, actionForm)

  return (
    <AdminShell
      activeKey="registrations"
      title="Duyệt hồ sơ đăng ký"
      subtitle="Xử lý toàn bộ hồ sơ doanh nghiệp trước khi hoàn tất onboarding"
    >
      <section className="rounded-2xl border border-slate-200 bg-white">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">Hồ sơ đăng ký doanh nghiệp</h2>
              <p className="mt-1 text-sm text-slate-500">
                Theo dõi các hồ sơ đang chờ duyệt, cần bổ sung hoặc đã bị từ chối.
              </p>
            </div>
            <label className="relative block w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo doanh nghiệp, email, số điện thoại"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none ring-emerald-200 focus:ring-2"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {registrationTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveStatus(tab.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  tab.key === activeStatus ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="grid min-h-[560px] xl:grid-cols-[340px_1fr]">
          <aside className="border-r border-slate-200 bg-slate-50/60">
            <div className="max-h-[680px] overflow-y-auto p-4">
              {loading ? <StateMessage>Đang tải hồ sơ...</StateMessage> : null}
              {!loading && error ? <StateMessage tone="error">{error}</StateMessage> : null}
              {!loading && !error && profiles.length === 0 ? <StateMessage>{emptyStateByTab[activeStatus]}</StateMessage> : null}

              {!loading && !error ? (
                <div className="space-y-2">
                  {profiles.map((profile) => {
                    const active = selected?.companyId === profile.companyId
                    return (
                      <button
                        key={profile.companyId}
                        onClick={() => setSelectedId(profile.companyId)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          active ? 'border-emerald-300 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900">{profile.companyName}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {companyTypeLabel[profile.companyType]} • {businessTypeLabel[profile.businessType]}
                            </p>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass[statusTone[profile.verificationStatus]]}`}
                          >
                            {formatVerificationStatusLabel(profile)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-700">{profile.ownerName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{profile.email || 'Chưa có email'} • {profile.phone}</p>
                        <p className="mt-2 text-xs text-slate-400">Đăng ký lúc {profile.createdAt || 'N/A'}</p>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </aside>

          <section className="p-5">
            {selected ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">{selected.companyName}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Hồ sơ {selected.id} • {companyTypeLabel[selected.companyType]} • {businessTypeLabel[selected.businessType]}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass[statusTone[selected.verificationStatus]]}`}
                  >
                    {formatVerificationStatusLabel(selected)}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <InfoCard title="Thông tin doanh nghiệp">
                    <InfoRow label="Tên doanh nghiệp" value={selected.companyName} />
                    <InfoRow label="Người đại diện" value={selected.ownerName} />
                    <InfoRow label="Loại doanh nghiệp" value={companyTypeLabel[selected.companyType]} />
                    <InfoRow label="Hình thức" value={businessTypeLabel[selected.businessType]} />
                    <InfoRow label="Mã số thuế" value={selected.taxCode || 'Chưa cung cấp'} />
                    <InfoRow label="Số đăng ký" value={selected.registrationNumber || 'Chưa cung cấp'} />
                    <InfoRow label="CCCD / CMND" value={selected.citizenId || 'Chưa cung cấp'} />
                    <InfoRow label="Địa chỉ" value={selected.address} />
                    <InfoRow label="Tỉnh / Thành" value={selected.province} />
                    <InfoRow label="Quận / Huyện" value={selected.district || 'Chưa cung cấp'} />
                    <InfoRow label="Mô tả" value={selected.description || 'Chưa có mô tả'} />
                  </InfoCard>

                  <InfoCard title="Thông tin liên hệ và xử lý">
                    <InfoRow label="Họ tên tài khoản" value={selected.fullName} />
                    <InfoRow label="Vai trò" value={selected.role} />
                    <InfoRow label="Email" value={selected.email || 'Chưa cung cấp'} />
                    <InfoRow label="Số điện thoại" value={selected.phone} />
                    <InfoRow label="Ngày đăng ký" value={selected.createdAt || 'N/A'} />
                    <InfoRow label="Người xử lý" value={selected.lastProcessedByName || 'Chưa có'} />
                    <InfoRow label="Thời gian xử lý" value={selected.lastProcessedAt || 'Chưa có'} />
                    <InfoRow label="Ghi chú" value={selected.verificationNote || 'Chưa có ghi chú'} />
                  </InfoCard>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <InfoCard title="Giấy tờ đã upload">
                    {selected.documents.length > 0 ? (
                      <div className="space-y-3">
                        {selected.documents.map((document) => (
                          <article key={document.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{document.fileName}</p>
                                <p className="mt-0.5 text-xs text-slate-500">Upload lúc {document.uploadedAt || 'N/A'}</p>
                              </div>
                              <FileText className="h-4 w-4 text-slate-500" />
                            </div>
                            {canOpenUploadedFile(document.fileUrl) ? (
                              <a
                                href={resolveUploadedFileUrl(document.fileUrl) ?? undefined}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600"
                              >
                                <Eye className="h-3.5 w-3.5" /> Xem tệp
                              </a>
                            ) : (
                              <p className="mt-2 text-xs font-medium text-amber-700">
                                Tệp cũ không còn khả dụng để xem. Vui lòng upload lại.
                              </p>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Chưa có giấy tờ nào được upload.</p>
                    )}
                  </InfoCard>

                  <InfoCard title="Ảnh doanh nghiệp / logo">
                    {selected.companyImages.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selected.companyImages.map((imageUrl) => {
                          const resolvedImageUrl = resolveUploadedFileUrl(imageUrl)
                          return resolvedImageUrl ? (
                            <img
                              key={imageUrl}
                              src={resolvedImageUrl}
                              alt="Ảnh doanh nghiệp"
                              className="h-32 w-full rounded-xl border border-slate-200 object-cover"
                            />
                          ) : (
                            <div
                              key={imageUrl}
                              className="flex h-32 items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 text-center text-xs font-medium text-amber-700"
                            >
                              Ảnh cũ không còn khả dụng. Cần upload lại để xem.
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Chưa có ảnh doanh nghiệp hoặc logo.</p>
                    )}
                  </InfoCard>
                </div>

                {selected.reasonCodes.length > 0 ? (
                  <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="text-sm font-semibold text-slate-900">Lý do gần nhất</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selected.reasonCodes.map((reason) => (
                        <span
                          key={reason}
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass.slate}`}
                        >
                          {humanizeReasonCode(reason)}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}

                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                  {(selected.verificationStatus === 'PENDING' || selected.verificationStatus === 'NEED_MORE_INFO') && (
                    <ActionButton icon={Check} onClick={handleApprove} tone="success" disabled={actionLoading !== null}>
                      {actionLoading === 'approve' ? 'Đang phê duyệt...' : 'Phê duyệt'}
                    </ActionButton>
                  )}

                  {(selected.verificationStatus === 'PENDING' || selected.verificationStatus === 'NEED_MORE_INFO') && (
                    <ActionButton icon={Mail} onClick={() => openActionModal('need-more-info')} tone="info" disabled={actionLoading !== null}>
                      {selected.verificationStatus === 'NEED_MORE_INFO' ? 'Cập nhật yêu cầu' : 'Yêu cầu bổ sung'}
                    </ActionButton>
                  )}

                  {(selected.verificationStatus === 'PENDING' || selected.verificationStatus === 'NEED_MORE_INFO') && (
                    <ActionButton icon={X} onClick={() => openActionModal('reject')} tone="danger" disabled={actionLoading !== null}>
                      Từ chối
                    </ActionButton>
                  )}

                  {selected.verificationStatus === 'REJECTED' && (
                    <>
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                        Hồ sơ đã bị từ chối. Có thể mở lại nếu muốn xét duyệt lại.
                      </div>
                      <ActionButton icon={RotateCcw} onClick={handleReopen} tone="warning" disabled={actionLoading !== null}>
                        {actionLoading === 'reopen' ? 'Đang mở lại...' : 'Mở lại hồ sơ'}
                      </ActionButton>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                Chọn một hồ sơ ở danh sách bên trái để xem chi tiết.
              </div>
            )}
          </section>
        </div>
      </section>

      {actionMode ? (
        <ActionModal
          title={modalTitle}
          submitLabel={modalSubmitLabel}
          danger={actionMode === 'reject'}
          options={reasonOptions}
          form={actionForm}
          preview={modalPreview}
          loading={actionLoading === actionMode}
          warning={
            actionMode === 'reject'
              ? 'Hành động này sẽ buộc người dùng đăng ký lại bằng hồ sơ mới.'
              : 'Hồ sơ sẽ chuyển sang trạng thái cần bổ sung để người dùng cập nhật.'
          }
          onClose={closeActionModal}
          onSubmit={submitActionModal}
          onToggleReason={(reasonCode) => {
            setActionForm((current) => ({
              ...current,
              reasonCodes: current.reasonCodes.includes(reasonCode)
                ? current.reasonCodes.filter((item) => item !== reasonCode)
                : [...current.reasonCodes, reasonCode],
            }))
          }}
          onChangeNote={(note) => setActionForm((current) => ({ ...current, note }))}
          onToggleSendEmail={() => setActionForm((current) => ({ ...current, sendEmail: !current.sendEmail }))}
          onToggleSendNotification={() => setActionForm((current) => ({ ...current, sendNotification: !current.sendNotification }))}
        />
      ) : null}
    </AdminShell>
  )
}

function ActionButton({
  icon: Icon,
  children,
  onClick,
  tone,
  disabled,
}: {
  icon: LucideIcon
  children: ReactNode
  onClick: () => void
  tone: 'success' | 'info' | 'danger' | 'warning'
  disabled?: boolean
}) {
  const classes = {
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    info: 'border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  }[tone]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  )
}

function ActionModal({
  title,
  submitLabel,
  warning,
  options,
  form,
  preview,
  danger,
  loading,
  onClose,
  onSubmit,
  onToggleReason,
  onChangeNote,
  onToggleSendEmail,
  onToggleSendNotification,
}: {
  title: string
  submitLabel: string
  warning: string
  options: Array<{ code: string; label: string }>
  form: ActionFormState
  preview: string
  danger: boolean
  loading: boolean
  onClose: () => void
  onSubmit: () => void
  onToggleReason: (reasonCode: string) => void
  onChangeNote: (value: string) => void
  onToggleSendEmail: () => void
  onToggleSendNotification: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className={`rounded-2xl border px-4 py-3 text-sm ${danger ? 'border-red-200 bg-red-50 text-red-700' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <p>{warning}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Lý do mẫu</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {options.map((option) => {
                const checked = form.reasonCodes.includes(option.code)
                return (
                  <label
                    key={option.code}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-sm transition ${
                      checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleReason(option.code)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-600"
                    />
                    <span className="font-medium text-slate-700">{option.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-900">Ghi chú chi tiết</label>
            <textarea
              value={form.note}
              onChange={(event) => onChangeNote(event.target.value)}
              rows={4}
              placeholder="Nhập hướng dẫn chi tiết hoặc lý do xử lý..."
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-emerald-200 focus:ring-2"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.sendEmail} onChange={onToggleSendEmail} className="h-4 w-4 accent-emerald-600" />
              Gửi email
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={form.sendNotification} onChange={onToggleSendNotification} className="h-4 w-4 accent-emerald-600" />
              Gửi thông báo
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Preview</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{preview}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button onClick={onClose} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition">
            Hủy
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-sky-600 hover:bg-sky-700'
            }`}
          >
            <Send className="h-4 w-4" /> {loading ? 'Đang gửi...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function buildPreviewMessage(actionMode: ActionMode, selected: AdminRegistrationProfile | null, form: ActionFormState): string {
  const companyName = selected?.companyName || 'Doanh nghiệp của bạn'
  const title = actionMode === 'reject' ? 'Thông báo từ chối hồ sơ' : 'Yêu cầu bổ sung hồ sơ'
  const reasons = form.reasonCodes.map(humanizeReasonCode)
  const reasonText = reasons.length > 0 ? `Lý do: ${reasons.join(', ')}.` : ''
  const noteText = form.note.trim() ? `\nChi tiết: ${form.note.trim()}` : ''
  return `${title}\n${companyName}\n${reasonText}${noteText}`.trim()
}

function humanizeReasonCode(reasonCode: string): string {
  return reasonCode
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getAdminUserId(): number | undefined {
  const raw = sessionStorage.getItem('agribridge.auth.userId')
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function formatVerificationStatusLabel(profile: AdminRegistrationProfile): string {
  if (profile.verificationStatus === 'PENDING') return 'Chờ duyệt'
  if (profile.verificationStatus === 'NEED_MORE_INFO') return 'Yêu cầu bổ sung'
  if (profile.verificationStatus === 'REJECTED') return 'Đã từ chối'
  if (profile.verificationStatus === 'APPROVED') return 'Đã duyệt'
  return profile.verificationStatusLabel
}

function StateMessage({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'error' }) {
  return (
    <div className={`rounded-xl border px-4 py-5 text-center text-sm ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-500'}`}>
      {children}
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      <div className="mt-3 space-y-2">{children}</div>
    </article>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[144px_1fr] gap-3 text-sm">
      <p className="font-medium text-slate-500">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  )
}
