import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HeroStats } from '../types/home'

type HeroSectionProps = {
  stats: HeroStats
}

export function HeroSection({ stats }: HeroSectionProps) {
  const heroBackgrounds = [
    '/images/background.png',
    '/images/background2.jpg',
    '/images/background3.jpg',
    '/images/background4.jpg',
  ]
  const [activeBackground, setActiveBackground] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveBackground((prev) => (prev + 1) % heroBackgrounds.length)
    }, 4500)

    return () => {
      window.clearInterval(timer)
    }
  }, [heroBackgrounds.length])

  const metrics = [
    { label: 'Nhà cung cấp', value: stats.supplierCount },
    { label: 'Nhà buôn', value: stats.buyerCount },
    { label: 'Giao dịch', value: stats.transactionValue },
    { label: 'RFQ / Báo giá', value: stats.rfqCount },
  ]

  return (
    <section id="hero-section" className="relative min-h-screen overflow-hidden">
      {heroBackgrounds.map((image, index) => (
        <img
          key={image}
          src={image}
          alt="Nền nông nghiệp và hải sản"
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-[1600ms] ${
            index === activeBackground
              ? 'scale-105 opacity-100'
              : 'scale-100 opacity-0'
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-slate-950/55" />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-20 text-white md:px-8 lg:pt-24">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex rounded-full border border-emerald-200/40 bg-emerald-300/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-100"
        >
          Nền tảng B2B về Nông Hải sản
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5 max-w-3xl text-5xl font-extrabold leading-tight md:text-6xl lg:text-7xl"
        >
          Kết nối Nguồn hàng Tối ưu Giao thương
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-100 md:text-xl"
        >
          AgriBridge kết nối nhà cung cấp và nhà buôn trong một hệ sinh thái vận hành đồng bộ: RFQ,
          báo giá, logistics, công nợ và minh bạch chất lượng theo từng lô hàng.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-wrap gap-4"
        >
          <Link
            to="/onboarding/supplier/business-info"
            className="rounded-full bg-emerald-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-400"
          >
            Đăng ký Nhà cung cấp
          </Link>
          <Link
            to="/onboarding/buyer/business-info"
            className="rounded-full border border-white/40 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            Đăng ký Nhà buôn
          </Link>
        </motion.div>

        <div className="mt-12 grid gap-4 rounded-2xl border border-white/10 bg-slate-900/35 p-5 backdrop-blur md:grid-cols-4 md:p-6">
          {metrics.map((item) => (
            <div key={item.label} className="border-l border-white/10 pl-4 first:border-none first:pl-0">
              <p className="text-3xl font-bold md:text-4xl">{item.value}</p>
              <p className="text-sm uppercase tracking-wider text-slate-300">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
