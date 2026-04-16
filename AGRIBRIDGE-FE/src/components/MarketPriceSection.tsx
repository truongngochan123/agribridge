import type { MarketPrice } from '../types/home'

type MarketPriceSectionProps = {
  marketPrices: MarketPrice[]
}

export function MarketPriceSection({ marketPrices }: MarketPriceSectionProps) {
  return (
    <section className="bg-gradient-to-b from-slate-900 to-slate-950 py-16 text-white md:py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <span className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">
          Cập nhật hàng ngày
        </span>
        <h2 className="mt-4 max-w-lg text-3xl font-extrabold leading-tight md:text-5xl">
          Giá Tham khảo Thị trường Realtime
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {marketPrices.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl bg-white/95 text-slate-900">
              <img src={item.image} alt={item.name} className="h-40 w-full object-cover" loading="lazy" />
              <div className="p-4">
                <h3 className="font-bold">{item.name}</h3>
                <p className="mt-2 text-2xl font-extrabold text-emerald-600">
                  {item.price}d
                  <span className="ml-1 text-sm font-semibold text-slate-500">/{item.unit}</span>
                </p>
                <p className="mt-2 text-sm text-slate-500">{item.region}</p>
                <p className="text-sm font-semibold text-cyan-700">Biến động: {item.trend}</p>
              </div>
            </article>
          ))}
        </div>

        <button className="mx-auto mt-8 block rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
          Xem tất cả sản phẩm
        </button>
      </div>
    </section>
  )
}
