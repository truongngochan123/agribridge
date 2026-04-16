export function LoadingState() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-16 text-white">
      <div className="mx-auto max-w-7xl animate-pulse space-y-5">
        <div className="h-10 w-44 rounded-lg bg-white/20" />
        <div className="h-12 max-w-2xl rounded-lg bg-white/20" />
        <div className="h-6 max-w-3xl rounded-lg bg-white/15" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-20 rounded-2xl bg-white/10" />
          ))}
        </div>
      </div>
    </div>
  )
}
