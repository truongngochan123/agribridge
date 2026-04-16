import { apiClient } from './apiClient'
import { fallbackFeatures } from '../data/features'
import { fallbackSteps } from '../data/steps'
import { fallbackTestimonials } from '../data/testimonials'
import { fallbackMarketPrices } from '../data/marketPrices'
import { fallbackCtaSummary, fallbackStats } from '../data/stats'
import type {
  CtaSummary,
  FeatureItem,
  HeroStats,
  MarketPrice,
  StepItem,
  Testimonial,
} from '../types/home'

const withFallback = async <T>(request: Promise<{ data: T }>, fallbackData: T) => {
  try {
    const response = await request
    return response.data
  } catch {
    return fallbackData
  }
}

export const getHeroStats = () =>
  withFallback<HeroStats>(apiClient.get('/api/home/stats'), fallbackStats)

export const getFeatures = () =>
  withFallback<FeatureItem[]>(apiClient.get('/api/home/features'), fallbackFeatures)

export const getSteps = () =>
  withFallback<StepItem[]>(apiClient.get('/api/home/steps'), fallbackSteps)

export const getTestimonials = () =>
  withFallback<Testimonial[]>(
    apiClient.get('/api/home/testimonials'),
    fallbackTestimonials,
  )

export const getMarketPrices = () =>
  withFallback<MarketPrice[]>(
    apiClient.get('/api/home/market-prices'),
    fallbackMarketPrices,
  )

export const getCtaSummary = () =>
  withFallback<CtaSummary>(apiClient.get('/api/home/cta-summary'), fallbackCtaSummary)
