import type { IconName } from './icons'

export type HeroStats = {
  supplierCount: string
  buyerCount: string
  transactionValue: string
  rfqCount: string
}

export type FeatureItem = {
  id: number
  icon: IconName
  title: string
  description: string
}

export type StepItem = {
  stepNumber: string
  title: string
  description: string
  icon: IconName
}

export type Testimonial = {
  id: number
  name: string
  role: string
  company: string
  avatar: string
  rating: number
  comment: string
}

export type MarketPrice = {
  id: number
  name: string
  image: string
  price: string
  unit: string
  region: string
  trend: string
}

export type CtaBlock = {
  title: string
  subtitle: string
  ctaText: string
  stats: string[]
}

export type CtaSummary = {
  supplier: CtaBlock
  buyer: CtaBlock
}
