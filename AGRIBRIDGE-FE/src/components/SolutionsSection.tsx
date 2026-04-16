import { motion } from 'framer-motion'
import { IconBadge } from './IconBadge'
import type { FeatureItem } from '../types/home'

type SolutionsSectionProps = {
  features: FeatureItem[]
}

const solutionImages = [
  '/images/giaiphap1.png',
  '/images/giaiphap2.png',
  '/images/giaiphap3.png',
  '/images/giaiphap4.png',
]

export function SolutionsSection({ features }: SolutionsSectionProps) {
  const items = features.map((feature, index) => ({
    ...feature,
    image: solutionImages[index % solutionImages.length],
  }))

  const movingItems = [...items, ...items]

  return (
    <section className="bg-slate-100 py-12 md:py-14">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <h2 className="text-2xl font-extrabold leading-tight text-slate-900 md:text-4xl">
            Giải pháp Toàn diện cho Giao thương B2B
          </h2>
          <p className="max-w-xl text-sm text-slate-600 md:text-base">
            Hệ sinh thái đầy đủ từ tìm kiếm nguồn hàng, tạo RFQ, đặt hàng đến quản lý công nợ và vận
            chuyển. Tất cả trong một nền tảng duy nhất.
          </p>
        </div>
      </div>

      <div className="relative mt-8 overflow-hidden">
        <motion.div
          className="flex gap-4 px-4 md:px-8"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        >
          {movingItems.map((item, index) => (
            <article
              key={`${item.id}-${index}`}
              className="w-[78vw] shrink-0 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm md:w-[54vw] lg:w-[36vw] xl:w-[30vw]"
            >
              <div className="p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="inline-flex rounded-xl bg-emerald-600/10 p-2.5 text-emerald-700">
                    <IconBadge name={item.icon} className="h-4 w-4" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 md:text-2xl">{item.title}</h3>
                </div>
                <p className="mt-2 text-base text-slate-600 md:text-lg">{item.description}</p>
              </div>

              <img
                src={item.image}
                alt={item.title}
                className="h-[220px] w-full border-t border-slate-100 object-cover md:h-[260px]"
              />
            </article>
          ))}
        </motion.div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-100 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-100 to-transparent" />
      </div>
    </section>
  )
}
