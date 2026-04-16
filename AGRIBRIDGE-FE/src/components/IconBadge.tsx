import {
  FileSearch,
  FileText,
  MapPinned,
  MessagesSquare,
  ReceiptText,
  ShoppingCart,
  Store,
  Truck,
  Wallet,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { IconName } from '../types/icons'

const iconMap: Record<IconName, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  FileSearch,
  FileText,
  MessagesSquare,
  ShoppingCart,
  MapPinned,
  ReceiptText,
  Wallet,
  Store,
  Truck,
}

type IconBadgeProps = {
  name: IconName
  className?: string
}

export function IconBadge({ name, className }: IconBadgeProps) {
  const Icon = iconMap[name]
  return <Icon className={className} strokeWidth={2} />
}
