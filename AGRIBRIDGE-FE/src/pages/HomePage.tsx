import { useEffect, useState } from 'react'
import { ChallengesSection } from '../components/ChallengesSection'
import { usePageTitle } from '../hooks/usePageTitle'
import { DualCTASection } from '../components/DualCTASection'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { HeroSection } from '../components/HeroSection'
import { HowItWorksSection } from '../components/HowItWorksSection'
import { LoadingState } from '../components/LoadingState'
import { MarketPriceSection } from '../components/MarketPriceSection'
import { SolutionsSection } from '../components/SolutionsSection'
import { TestimonialsSection } from '../components/TestimonialsSection'
import { fallbackFeatures } from '../data/features'
import { fallbackMarketPrices } from '../data/marketPrices'
import { fallbackStats, fallbackCtaSummary } from '../data/stats'
import { fallbackSteps } from '../data/steps'
import { fallbackTestimonials } from '../data/testimonials'
import {
  getCtaSummary,
  getFeatures,
  getHeroStats,
  getMarketPrices,
  getSteps,
  getTestimonials,
} from '../services/homeService'
import type {
  CtaSummary,
  FeatureItem,
  HeroStats,
  MarketPrice,
  StepItem,
  Testimonial,
} from '../types/home'

export function HomePage() {
  usePageTitle('Nền tảng nông sản sạch AgriBridge')
  const [stats, setStats] = useState<HeroStats>(fallbackStats)
  const [features, setFeatures] = useState<FeatureItem[]>(fallbackFeatures)
  const [steps, setSteps] = useState<StepItem[]>(fallbackSteps)
  const [testimonials, setTestimonials] = useState<Testimonial[]>(fallbackTestimonials)
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>(fallbackMarketPrices)
  const [ctaSummary, setCtaSummary] = useState<CtaSummary>(fallbackCtaSummary)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'AgriBridge - Nền tảng giao thương Nông Hải sản B2B'
    const description =
      'AgriBridge kết nối nhà cung cấp và nhà buôn với RFQ, báo giá, logistics, công nợ và giá thị trường realtime.'

    let metaDescription = document.querySelector('meta[name="description"]')
    if (!metaDescription) {
      metaDescription = document.createElement('meta')
      metaDescription.setAttribute('name', 'description')
      document.head.appendChild(metaDescription)
    }
    metaDescription.setAttribute('content', description)

    const loadHomeData = async () => {
      setLoading(true)
      const [statsData, featuresData, stepsData, testimonialsData, pricesData, ctaData] = await Promise.all([
        getHeroStats(),
        getFeatures(),
        getSteps(),
        getTestimonials(),
        getMarketPrices(),
        getCtaSummary(),
      ])

      setStats(statsData)
      setFeatures(featuresData)
      setSteps(stepsData)
      setTestimonials(testimonialsData)
      setMarketPrices(pricesData)
      setCtaSummary(ctaData)
      setLoading(false)
    }

    void loadHomeData()
  }, [])

  if (loading) {
    return <LoadingState />
  }

  return (
    <>
      <Header />
      <main>
        <HeroSection stats={stats} />
        <ChallengesSection />
        <SolutionsSection features={features} />
        <HowItWorksSection steps={steps} />
        <TestimonialsSection testimonials={testimonials} />
        <DualCTASection summary={ctaSummary} />
        <MarketPriceSection marketPrices={marketPrices} />
      </main>
      <Footer />
    </>
  )
}
