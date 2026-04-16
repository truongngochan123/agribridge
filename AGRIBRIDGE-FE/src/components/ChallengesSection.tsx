import { ArrowRight } from 'lucide-react'

export function ChallengesSection() {
  return (
    <section className="bg-slate-50 py-16 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 md:px-8 lg:grid-cols-2">
        <div>
          <h2 className="max-w-md text-3xl font-extrabold leading-tight text-slate-900 md:text-5xl">
            Giải quyết Thách thức Giao thương Nông Hải sản
          </h2>
          <p className="mt-5 text-slate-600">
            Ngành nông hải sản đối mặt với nhiều bài toán thực tế: khó tìm nguồn hàng minh bạch, khó đối
            soát công nợ, khó theo dõi giao hàng và khó kiểm soát chất lượng theo lô.
          </p>

          <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-200">
            Tìm hiểu thêm <ArrowRight size={15} />
          </button>

          <div className="mt-8 grid grid-cols-2 gap-6">
            <div>
              <p className="text-3xl font-bold text-slate-900">99.8%</p>
              <p className="text-sm text-slate-500">Tỷ lệ giao dịch thành công</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900">4.9/5</p>
              <p className="text-sm text-slate-500">Đánh giá trung bình</p>
            </div>
          </div>
        </div>

        <div className="relative rounded-3xl bg-white p-4 shadow-xl shadow-slate-200">
          <img
            src="/images/tom-su.png"
            alt="Tôm sú tươi trên đá lạnh"
            className="h-[340px] w-full rounded-2xl object-cover"
          />

          <div className="absolute bottom-8 left-8 rounded-2xl bg-slate-950/70 px-4 py-3 text-white backdrop-blur">
            <p className="text-sm text-emerald-200">Tôm Sú Hữu Cơ</p>
            <p className="text-xs text-slate-300">Tăng trưởng nguồn cung theo tuần</p>
          </div>

          <div className="absolute -bottom-4 right-5 rounded-xl bg-white px-4 py-3 shadow-lg">
            <p className="text-sm font-semibold text-emerald-700">+125%</p>
            <p className="text-xs text-slate-500">Nhu cầu trong 30 ngày</p>
          </div>
        </div>
      </div>
    </section>
  )
}
