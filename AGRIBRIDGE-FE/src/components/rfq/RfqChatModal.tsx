import { Loader2, Send, Wifi, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Client } from '@stomp/stompjs'
import { createRfqChatClient, fetchRfqMessages, sendRfqMessage } from '../../services/rfqChatService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'
import type { RfqMessage } from '../../types/rfqChat'

type RfqChatModalProps = {
  rfqId: number
  supplierCompanyId?: number | null
  rfqCode: string
  title: string
  subtitle?: string
  onClose: () => void
}

function appendUnique(messages: RfqMessage[], next: RfqMessage) {
  return messages.some((item) => item.id === next.id) ? messages : [...messages, next]
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Hôm nay'
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua'
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function currentSession() {
  const companyId = Number(localStorage.getItem('agribridge.auth.companyId') || '')
  const userId = Number(localStorage.getItem('agribridge.auth.userId') || '')
  return {
    companyId: Number.isFinite(companyId) && companyId > 0 ? companyId : null,
    userId: Number.isFinite(userId) && userId > 0 ? userId : null,
  }
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function RfqChatModal({ rfqId, supplierCompanyId, rfqCode, title, subtitle, onClose }: RfqChatModalProps) {
  const [messages, setMessages] = useState<RfqMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const clientRef = useRef<Client | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const session = useMemo(currentSession, [])
  const conversationSupplierId = supplierCompanyId ?? session.companyId

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setConnected(false)
    setError('')

    if (!conversationSupplierId) {
      setLoading(false)
      setError('Không xác định được nhà cung cấp cho cuộc chat này.')
      return
    }

    void fetchRfqMessages(rfqId, conversationSupplierId)
      .then((history) => {
        if (!cancelled) setMessages(history)
      })
      .catch((requestError) => {
        if (!cancelled) setError(readApiErrorMessage(requestError) || 'Không thể tải lịch sử chat.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const client = createRfqChatClient(
      rfqId,
      conversationSupplierId,
      (message) => setMessages((prev) => appendUnique(prev, message)),
      (message) => setError(message),
      () => {
        setConnected(true)
        setError('')
      },
    )
    clientRef.current = client
    client.activate()

    return () => {
      cancelled = true
      setConnected(false)
      void client.deactivate()
      if (clientRef.current === client) clientRef.current = null
    }
  }, [conversationSupplierId, rfqId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  async function submit() {
    const message = input.trim()
    if (!message || sending || !conversationSupplierId) return
    setSending(true)
    setError('')
    try {
      const saved = await sendRfqMessage(rfqId, { supplierCompanyId: conversationSupplierId, message })
      setMessages((prev) => appendUnique(prev, saved))
      setInput('')
    } catch (requestError) {
      setError(readApiErrorMessage(requestError) || 'Không thể gửi tin nhắn.')
    } finally {
      setSending(false)
    }
  }

  // Group messages by date
  const grouped = useMemo(() => {
    const result: Array<{ label: string; messages: RfqMessage[] }> = []
    let lastLabel = ''
    messages.forEach((msg) => {
      const label = formatDateLabel(msg.createdAt)
      if (label !== lastLabel) {
        result.push({ label, messages: [msg] })
        lastLabel = label
      } else {
        result[result.length - 1]?.messages.push(msg)
      }
    })
    return result
  }, [messages])

  const shortTitle = title.length > 36 ? `${title.slice(0, 33)}...` : title

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[min(700px,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-[0_32px_80px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600">
          <div
            className="pointer-events-none absolute inset-0 opacity-15"
            style={{ backgroundImage: 'radial-gradient(ellipse at 80% 0%, rgba(255,255,255,0.8) 0%, transparent 55%)' }}
          />
          <div className="relative flex items-start gap-3 px-4 py-4">
            {/* Avatar */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30">
              <span className="text-sm font-black text-white">{initials(title.replace(/^Chat với /, ''))}</span>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-black text-white drop-shadow">{shortTitle}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white/80 ring-1 ring-white/20">
                  {rfqCode}
                </span>
                {subtitle ? (
                  <span className="max-w-[160px] truncate rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/70 ring-1 ring-white/15">
                    {subtitle}
                  </span>
                ) : null}
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${connected ? 'bg-emerald-400/25 text-emerald-100 ring-emerald-300/30' : 'bg-amber-400/25 text-amber-100 ring-amber-300/30'}`}>
                  {connected ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
                  {connected ? 'Đã kết nối' : 'Đang kết nối...'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white/80 transition hover:bg-white/25"
              aria-label="Đóng chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div
          className="flex-1 space-y-1 overflow-y-auto px-4 py-4"
          style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-slate-500">Đang tải lịch sử chat...</p>
            </div>
          ) : null}

          {!loading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md">
                <span className="text-3xl">💬</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Chưa có tin nhắn nào</p>
                <p className="mt-0.5 text-xs text-slate-400">Hãy gửi tin nhắn để bắt đầu cuộc trò chuyện</p>
              </div>
            </div>
          ) : null}

          {grouped.map((group) => (
            <div key={group.label}>
              {/* Date separator */}
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-slate-400 shadow-sm ring-1 ring-slate-200">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="space-y-2">
                {group.messages.map((message, idx) => {
                  const isMine = message.senderCompanyId === session.companyId || message.senderUserId === session.userId
                  const senderLabel = isMine ? 'Bạn' : message.senderRole === 'BUYER' ? 'Nhà buôn' : 'Nhà cung cấp'
                  const prevMsg = group.messages[idx - 1]
                  const isSameAsLast = prevMsg && (prevMsg.senderCompanyId === message.senderCompanyId || prevMsg.senderUserId === message.senderUserId)

                  return (
                    <div key={message.id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar — only show if first in a run */}
                      {!isMine ? (
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white transition ${isSameAsLast ? 'invisible' : 'bg-gradient-to-br from-emerald-500 to-teal-400 shadow-sm'}`}>
                          {initials(senderLabel)}
                        </div>
                      ) : null}

                      <div className={`group flex max-w-[72%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                        {/* Sender name — only first in run */}
                        {!isSameAsLast && !isMine ? (
                          <p className="mb-1 ml-1 text-[10px] font-bold text-slate-500">{senderLabel}</p>
                        ) : null}

                        {/* Bubble */}
                        <div
                          className={`relative rounded-2xl px-3.5 py-2.5 shadow-sm ${
                            isMine
                              ? 'bg-gradient-to-br from-emerald-600 to-teal-500 text-white'
                              : 'bg-white text-slate-800 ring-1 ring-slate-100'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</p>

                          {/* Timestamp */}
                          <p className={`mt-1 text-right text-[10px] ${isMine ? 'text-emerald-100/80' : 'text-slate-400'}`}>
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* My avatar placeholder */}
                      {isMine ? (
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-500 text-[10px] font-black text-white shadow-sm ${isSameAsLast ? 'invisible' : ''}`}>
                          B
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div ref={endRef} />
        </div>

        {/* ── Error Banner ── */}
        {error ? (
          <div className="flex shrink-0 items-center gap-2 border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {error}
          </div>
        ) : null}

        {/* ── Input Area ── */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-3 py-3">
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                placeholder="Nhập tin nhắn..."
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px', overflowY: 'auto' }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void submit()
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-md transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!input.trim() || sending || !conversationSupplierId}
              onClick={() => void submit()}
              aria-label="Gửi tin nhắn"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-slate-400">
            Nhấn <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] font-bold">Enter</kbd> để gửi · <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] font-bold">Shift+Enter</kbd> xuống dòng
          </p>
        </div>
      </div>
    </div>
  )
}
