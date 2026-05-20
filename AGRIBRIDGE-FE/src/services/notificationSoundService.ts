import type { AppNotification } from './notificationService'

const STORAGE_KEY = 'agribridge.notification.soundEnabled'
const SOUND_THROTTLE_MS = 3000
const SOUND_VOLUME = 0.3

const importantNotificationTypes = new Set([
  'ORDER_CREATED_FOR_SUPPLIER',
  'ORDER_DELIVERED_NEED_CONFIRMATION',
  'DEBT_REMINDER',
  'DEBT_CREDIT_LIMIT_GRANTED',
  'PAYMENT_DUE',
  'PAYMENT_REMAINING_REQUIRED',
  'DEBT_OVERDUE_FOR_SUPPLIER',
  'DELIVERY_FAILED',
  'SHIPMENT_INCIDENT',
  'DELIVERY_DISPUTE',
  'BUYER_COMPLAINT',
  'COMPLAINT_CREATED_FOR_SUPPLIER',
  'RFQ_CREATED_FOR_SUPPLIER',
])

let lastPlayedAt = 0

export function getNotificationSoundEnabled() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function setNotificationSoundEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
}

export function isImportantNotification(notification: AppNotification) {
  return Boolean(notification.type && importantNotificationTypes.has(notification.type))
}

export function playNotificationSound(notification: AppNotification, soundEnabled: boolean) {
  if (!soundEnabled || !isImportantNotification(notification)) return

  const now = Date.now()
  if (now - lastPlayedAt < SOUND_THROTTLE_MS) return
  lastPlayedAt = now

  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const audioContext = new AudioContextClass()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const startedAt = audioContext.currentTime
    const duration = 0.28

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, startedAt)
    oscillator.frequency.exponentialRampToValueAtTime(1320, startedAt + 0.08)
    oscillator.frequency.exponentialRampToValueAtTime(990, startedAt + duration)

    gain.gain.setValueAtTime(0.0001, startedAt)
    gain.gain.exponentialRampToValueAtTime(SOUND_VOLUME * 0.18, startedAt + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + duration)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(startedAt)
    oscillator.stop(startedAt + duration)

    oscillator.onended = () => {
      void audioContext.close().catch(() => undefined)
    }
  } catch {
    // Browsers may block audio until a user gesture; notification UI should keep working.
  }
}
