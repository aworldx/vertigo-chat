import { useState, type ReactNode } from "react"
import { Icon } from "../../../shared/ui/Icon"
import type { Track } from "../api/chart"
import type { useChart } from "../model/useChart"
export function TrackCard({
  track,
  registered,
  chart,
  player,
}: {
  track: Track
  registered: boolean
  chart: ReturnType<typeof useChart>
  player: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  return (
    <article
      id={`tracks-${String(track.id)}`}
      data-track-title={track.title}
      className="music-chart-track grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-start"
    >
      <span className="music-chart-place flex size-11 items-center justify-center self-start rounded-full text-lg font-bold sm:self-center">
        {track.likes_count}
      </span>
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {editing ? (
              <form
                id={`edit-music-track-title-${String(track.id)}`}
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const value = new FormData(event.currentTarget).get("title")
                  void chart.mutate(`/${String(track.id)}`, "PATCH", { title: value }).then((ok) => {
                    if (ok) setEditing(false)
                  })
                }}
              >
                <input
                  id={`music-track-title-${String(track.id)}`}
                  name="title"
                  defaultValue={track.title}
                  maxLength={120}
                  required
                  aria-label="Название трека"
                  className="w-full rounded-lg border border-fuchsia-300/50 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 shadow-sm outline-none transition placeholder:text-zinc-500 hover:border-fuchsia-200/70 focus:border-fuchsia-200 focus:ring-4 focus:ring-fuchsia-300/15"
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    id={`save-music-track-title-${String(track.id)}`}
                    disabled={chart.pending}
                    className="rounded-lg bg-fuchsia-300 px-3 py-1.5 text-xs font-semibold text-zinc-950"
                  >
                    Сохранить
                  </button>
                  <button
                    id={`cancel-music-track-title-${String(track.id)}`}
                    type="button"
                    onClick={() => {
                      setEditing(false)
                    }}
                    className="rounded-lg border border-zinc-500 px-3 py-1.5 text-xs text-zinc-200"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <h3 className="truncate text-base font-semibold text-white">{track.title}</h3>
            )}
          </div>
          {track.own && !editing && (
            <button
              id={`edit-music-track-title-${String(track.id)}`}
              type="button"
              onClick={() => {
                setEditing(true)
              }}
              aria-label="Изменить название трека"
              className="shrink-0 rounded-lg bg-zinc-800 p-1.5 text-zinc-200 transition hover:bg-zinc-700 hover:text-fuchsia-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
            >
              <Icon name="pencil-square" className="size-4" />
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-400">{`Добавил ${track.author}`}</p>
        {player}
        <section
          id={`music-track-comments-${String(track.id)}`}
          className="mt-4 border-t border-zinc-800 pt-3"
          aria-label={`Комментарии к треку ${track.title}`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Комментарии</p>
          {track.comments.length > 0 ? (
            <div className="mt-2 space-y-2">
              {track.comments.map((comment) => (
                <p
                  key={comment.id}
                  id={`music-comment-${String(comment.id)}`}
                  className="text-sm leading-5 text-zinc-300"
                >
                  <span className="chat-user-nickname font-semibold text-zinc-100">{comment.author}</span>{" "}
                  <span className="text-zinc-500">·</span>
                  {` ${comment.body}`}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">Пока нет комментариев.</p>
          )}
          {registered ? (
            <form
              id={`music-comment-form-${String(track.id)}`}
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const form = event.currentTarget
                void chart
                  .mutate(`/${String(track.id)}/comments`, "POST", { body: new FormData(form).get("body") })
                  .then((ok) => {
                    if (ok) form.reset()
                  })
              }}
            >
              <div className="min-w-0 flex-1">
                <input
                  id={`music-comment-body-${String(track.id)}`}
                  name="body"
                  required
                  maxLength={280}
                  placeholder="Оставить комментарий"
                  aria-label={`Комментарий к треку ${track.title}`}
                  className="w-full rounded-lg border border-fuchsia-300/50 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 shadow-sm outline-none transition placeholder:text-zinc-500 hover:border-fuchsia-200/70 focus:border-fuchsia-200 focus:ring-4 focus:ring-fuchsia-300/15"
                />
              </div>
              <button
                id={`music-comment-submit-${String(track.id)}`}
                disabled={chart.pending}
                className="shrink-0 rounded-lg border border-fuchsia-300/50 px-3 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-300 hover:text-zinc-950"
              >
                Отправить
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">Войди, чтобы оставить комментарий.</p>
          )}
        </section>
      </div>
      {registered && !track.own ? (
        <button
          id={`music-like-${String(track.id)}`}
          type="button"
          disabled={chart.pending}
          aria-pressed={track.liked}
          onClick={() => {
            void chart.mutate(`/${String(track.id)}/like`, "PUT", { active: !track.liked })
          }}
          className={`self-start rounded-xl border px-3 py-2 text-sm font-semibold transition ${track.liked ? "border-fuchsia-300 bg-fuchsia-300 text-zinc-950" : "border-zinc-700 text-zinc-300 hover:border-fuchsia-300 hover:text-fuchsia-200"}`}
        >
          <span aria-hidden="true">♥</span> <span>{track.likes_count}</span>
        </button>
      ) : (
        <span className="self-start text-sm text-zinc-500">{track.own ? "Твой трек" : "Войди, чтобы оценить"}</span>
      )}
    </article>
  )
}
