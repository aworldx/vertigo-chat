export const botPanel = "rounded-2xl border border-emerald-950 bg-[#162019] p-5 shadow-xl shadow-black/20 sm:p-6"
export const botButton =
  "rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60"
export function BotSaveStatus({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-300">
          {notice}
        </p>
      )}
    </>
  )
}
