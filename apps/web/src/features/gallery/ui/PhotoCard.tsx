import { Icon } from "../../../shared/ui/Icon"
import { useState } from "react"
import { Field } from "../../../shared/ui/Field"
import { saveCaption, likePhoto, galleryError, type Photo } from "../api/gallery"
export function PhotoCard({
  photo: p,
  csrf,
  signedIn,
  onOpen,
  onChanged,
}: {
  photo: Photo
  csrf: string
  signedIn: boolean
  onOpen: (p: Photo) => void
  onChanged: (message: string) => void
}) {
  const [editing, setEditing] = useState(false),
    [caption, setCaption] = useState(p.caption),
    [pending, setPending] = useState(false),
    [error, setError] = useState("")
  async function mutate(save: boolean) {
    setPending(true)
    setError("")
    try {
      if (save) {
        await saveCaption(p.id, caption, csrf)
        setEditing(false)
      } else await likePhoto(p.id, !p.liked, csrf)
      onChanged(save ? "Название фотографии сохранено." : "")
    } catch (e) {
      setError(galleryError(e))
    } finally {
      setPending(false)
    }
  }
  return (
    <figure
      id={`photos-${String(p.id)}`}
      data-photo-author={p.author}
      data-photo-caption={p.caption}
      className="group relative mb-5 break-inside-avoid overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl"
    >
      <button
        type="button"
        data-gallery-lightbox-open
        aria-label={`Увеличить фотографию от ${p.author}`}
        aria-haspopup="dialog"
        onClick={() => {
          onOpen(p)
        }}
        className="block w-full cursor-zoom-in overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300"
      >
        <img
          src={p.thumbnail}
          alt={`Фотография от ${p.author}`}
          loading="lazy"
          className="block h-auto w-full transition duration-500 group-hover:scale-[1.02]"
        />
        <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-white/15 bg-zinc-950/65 text-zinc-100 opacity-0 shadow-lg backdrop-blur-sm transition group-hover:opacity-100 group-focus-within:opacity-100">
          <Icon name="arrows-pointing-out" className="size-4" />
        </span>
      </button>
      <div className="absolute left-3 top-3 z-10">
        {signedIn && !p.own ? (
          <button
            id={`gallery-like-${String(p.id)}`}
            type="button"
            disabled={pending}
            aria-label={`Оценить фотографию от ${p.author}`}
            aria-pressed={p.liked}
            onClick={() => {
              void mutate(false)
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-sm transition ${p.liked ? "border-rose-300 bg-rose-400 text-zinc-950" : "border-white/15 bg-zinc-950/70 text-zinc-100 hover:border-rose-300 hover:text-rose-200"}`}
          >
            <Icon name="heart" className="size-4" />
            <span>{p.likes}</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1.5 text-xs font-semibold text-zinc-100 shadow-lg backdrop-blur-sm">
            <Icon name="heart" className="size-4" />
            <span>{p.likes}</span>
          </span>
        )}
      </div>
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent px-4 pb-4 pt-12">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Загрузил</p>
            <p className="chat-user-nickname mt-1 text-lg font-semibold">{p.author}</p>
            {editing ? (
              <form
                id={`edit-gallery-photo-${String(p.id)}`}
                onSubmit={(e) => {
                  e.preventDefault()
                  void mutate(true)
                }}
                className="mt-3 min-w-0 space-y-2"
              >
                <Field
                  id={`gallery-photo-caption-${String(p.id)}`}
                  aria-label="Название фотографии"
                  maxLength={280}
                  value={caption}
                  onChange={(e) => {
                    setCaption(e.target.value)
                  }}
                  className="block w-full rounded-lg border border-zinc-600 bg-zinc-950/90 px-3 py-2 text-sm text-zinc-100 shadow-sm outline-none transition placeholder:text-zinc-600 hover:border-zinc-500 focus:border-amber-300 focus:ring-4 focus:ring-amber-300/10"
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    id={`save-gallery-photo-caption-${String(p.id)}`}
                    disabled={pending}
                    className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                  >
                    Сохранить
                  </button>
                  <button
                    id={`cancel-gallery-photo-caption-${String(p.id)}`}
                    type="button"
                    onClick={() => {
                      setEditing(false)
                    }}
                    className="rounded-lg border border-zinc-500 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              p.caption && <p className="mt-2 text-sm leading-5 text-zinc-200">{p.caption}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {signedIn && p.own && !editing && (
              <button
                id={`edit-gallery-photo-${String(p.id)}`}
                type="button"
                aria-label="Изменить название фотографии"
                onClick={() => {
                  setCaption(p.caption)
                  setEditing(true)
                }}
                className="rounded-lg bg-zinc-800/90 p-1.5 text-zinc-200 transition hover:bg-zinc-700 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <Icon name="pencil-square" className="size-4" />
              </button>
            )}
            <time className="text-xs text-zinc-500">{p.date}</time>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-300">
            {error}
          </p>
        )}
      </figcaption>
    </figure>
  )
}
