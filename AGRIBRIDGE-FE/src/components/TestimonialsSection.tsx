import { Star } from 'lucide-react'
import type { Testimonial } from '../types/home'

type TestimonialsSectionProps = {
  testimonials: Testimonial[]
}

export function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  return (
    <section className="bg-slate-50 py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          Đã chuyển đổi thành công
        </span>
        <h2 className="mt-4 max-w-xl text-3xl font-extrabold text-slate-900 md:text-5xl">
          Hơn 10,000 Doanh nghiệp Tin tưởng AgriBridge
        </h2>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {testimonials.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <img
                  src={item.avatar}
                  alt={item.name}
                  className="h-12 w-12 rounded-full object-cover"
                  loading="lazy"
                />
                <div>
                  <h3 className="font-semibold text-slate-900">{item.name}</h3>
                  <p className="text-xs text-slate-500">
                    {item.role} - {item.company}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-600">{item.comment}</p>
              <div className="mt-4 flex gap-1 text-amber-500">
                {Array.from({ length: item.rating }).map((_, idx) => (
                  <Star key={idx} className="h-4 w-4 fill-current" />
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
