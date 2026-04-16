import { IconBadge } from './IconBadge'
import type { StepItem } from '../types/home'

type HowItWorksSectionProps = {
  steps: StepItem[]
}

export function HowItWorksSection({ steps }: HowItWorksSectionProps) {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <p className="text-center text-xs font-bold uppercase tracking-[0.28em] text-emerald-600">
          Quy trình vận hành
        </p>
        <h2 className="mt-3 text-center text-3xl font-extrabold text-slate-900 md:text-5xl">
          AgriBridge hoạt động như thế nào
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {steps.map((step) => (
            <article key={step.stepNumber} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                  <IconBadge name={step.icon} className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold text-slate-300">{step.stepNumber}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
