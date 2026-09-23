import type { Visit } from "../api/visits"
import { formatVisitTime } from "../model/time"
export function VisitRow({ visit }: { visit: Visit }) {
  return (
    <tr
      id={`visits-${String(visit.id)}`}
      data-visit-nickname={visit.nickname}
      className="transition hover:bg-white/[0.03]"
    >
      <td className="px-5 py-4 sm:px-7">
        <span className="chat-user-nickname text-lg text-amber-200">{visit.nickname}</span>
      </td>
      <td className="px-5 py-4 text-sm text-zinc-300 sm:px-7">
        {formatVisitTime(visit.entered_at)}
        <p className="mt-1 text-xs text-zinc-500 sm:hidden">
          {visit.left_at ? (
            `Вышел: ${formatVisitTime(visit.left_at)}`
          ) : (
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400" /> Сейчас в чате
            </span>
          )}
        </p>
      </td>
      <td className="hidden whitespace-nowrap px-5 py-4 text-sm sm:table-cell sm:px-7">
        {visit.left_at ? (
          <span className="text-zinc-300">{formatVisitTime(visit.left_at)}</span>
        ) : (
          <span className="inline-flex items-center gap-2 text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0.75rem_rgba(52,211,153,0.45)]" />
            Сейчас в чате
          </span>
        )}
      </td>
    </tr>
  )
}
