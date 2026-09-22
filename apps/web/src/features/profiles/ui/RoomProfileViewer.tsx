import { useCallback, useState } from "react"
import { getRoomProfile } from "../api/profiles"
import { useResource } from "../model/useResource"
import { Modal } from "../../../shared/ui/Modal"
import { Icon } from "../../../shared/ui/Icon"
import { birthDate, genderLabel } from "./Primitives"
export function RoomProfileViewer({
  nickname,
  editable,
  onDismiss,
}: {
  nickname: string
  editable: boolean
  onDismiss: () => void
}) {
  const load = useCallback((signal: AbortSignal) => getRoomProfile(nickname, signal), [nickname]),
    resource = useResource(`room-profile:${nickname}`, load)
  const profile = resource.data?.data,
    [photo, setPhoto] = useState(false)
  const closePhoto = useCallback(() => {
    setPhoto(false)
  }, [])
  return (
    <>
      <Modal
        id="profile-modal"
        labelId="profile-title"
        onClose={onDismiss}
        className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm sm:p-6"
      >
        <button type="button" onClick={onDismiss} className="absolute inset-0" aria-label="Закрыть анкету" />
        <section className="relative z-10 max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/10 bg-zinc-900 shadow-2xl shadow-black/40">
          <button
            id="close-profile"
            type="button"
            onClick={onDismiss}
            className="absolute right-4 top-4 z-20 flex size-10 items-center justify-center rounded-full border border-white/10 bg-zinc-950/70 text-zinc-300 shadow-lg backdrop-blur transition hover:border-amber-200/60 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:right-6 sm:top-6"
            aria-label="Закрыть анкету"
          >
            <Icon name="x-mark" className="size-5" />
          </button>
          {!profile && (
            <div className="p-8">
              <h2 id="profile-title">Анкета {nickname}</h2>
              {resource.loading ? (
                <p role="status">Загружаем анкету…</p>
              ) : (
                <p role="alert">
                  {resource.error}
                  <button type="button" onClick={resource.retry}>
                    Повторить
                  </button>
                </p>
              )}
            </div>
          )}
          {profile && (
            <div className="grid lg:min-h-[32rem] lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.35fr)]">
              <aside className="border-b border-white/10 bg-zinc-950/45 lg:border-b-0 lg:border-r">
                {profile.photo_url ? (
                  <button
                    id="open-room-profile-photo"
                    type="button"
                    aria-label={`Увеличить фото ${nickname}`}
                    aria-haspopup="dialog"
                    onClick={() => {
                      setPhoto(true)
                    }}
                    className="group/photo relative flex h-[min(30vh,18rem)] min-h-0 w-full cursor-zoom-in items-center justify-center overflow-hidden bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300 lg:h-full"
                  >
                    <img
                      id="profile-avatar-image"
                      src={profile.photo_url}
                      alt={`Фото ${nickname}`}
                      className="h-full w-full object-contain transition duration-300 group-hover/photo:scale-[1.02]"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/20 to-transparent px-5 pb-5 pt-12 text-left text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
                      <Icon name="arrows-pointing-out" className="mr-2 inline size-4 align-text-bottom" />
                      Смотреть фото
                    </span>
                  </button>
                ) : (
                  <div className="grid h-[min(30vh,18rem)] place-items-center bg-gradient-to-br from-amber-300/15 via-zinc-950 to-zinc-950 text-6xl font-black text-amber-200 lg:h-full">
                    {Array.from(nickname)[0]?.toUpperCase()}
                  </div>
                )}
              </aside>
              <div className="min-w-0">
                <header className="border-b border-white/10 bg-gradient-to-br from-amber-300/15 via-zinc-900 to-zinc-900 px-6 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-9">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Анкета</p>
                  <h2
                    id="profile-title"
                    className="mt-2 truncate pr-12 text-4xl font-bold tracking-tight text-white sm:text-5xl"
                  >
                    {nickname}
                  </h2>
                  {profile.name && (
                    <p id="profile-display-name" className="mt-2 truncate text-base font-medium text-zinc-300">
                      {profile.name}
                    </p>
                  )}
                  <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-amber-300/30 bg-zinc-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100">
                    <img src={profile.rank.icon_url} alt="" className="chat-rank-icon size-4 text-amber-300" />
                    <span className="truncate">{profile.rank.title}</span>
                  </div>
                </header>
                <div id="profile-view" className="space-y-5 p-6 sm:p-8">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {(
                      [
                        { icon: "chat-bubble-left-right", label: "Фразы", value: profile.progress.public_messages },
                        { icon: "clock", label: "В чате", value: profile.progress.chat_hours },
                        { icon: "heart", label: "Карма", value: profile.karma ?? 0 },
                      ] as const
                    ).map((item) => (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-zinc-950/45 p-4">
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                          <Icon
                            name={item.icon}
                            className={`size-4 ${item.label === "Карма" ? "text-rose-300" : "text-amber-300"}`}
                          />
                          {item.label}
                        </div>
                        <p
                          className={`mt-2 text-3xl font-bold tabular-nums ${item.label === "Карма" ? "text-rose-100" : "text-zinc-100"}`}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  {(profile.birth_date || profile.gender) && (
                    <div className="flex flex-wrap gap-2">
                      {profile.birth_date && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-300">
                          <Icon name="cake" className="size-4 text-amber-300" />
                          {birthDate(profile.birth_date)}
                        </span>
                      )}
                      {profile.gender && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-300">
                          <Icon name="user" className="size-4 text-amber-300" />
                          {genderLabel(profile.gender)}
                        </span>
                      )}
                    </div>
                  )}
                  <section className="min-h-36 rounded-2xl border border-white/10 bg-zinc-950/35 p-5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                      <Icon name="sparkles" className="size-4 text-amber-300" />О себе
                    </div>
                    <p
                      className={`mt-4 whitespace-pre-wrap text-sm leading-7 ${profile.about ? "text-zinc-200" : "italic text-zinc-500"}`}
                    >
                      {`\n              ${profile.about || "Пока ничего не рассказал о себе."}\n            `}
                    </p>
                  </section>
                  {editable && (
                    <a
                      id="edit-profile"
                      href="/profiles"
                      target="vertigo-profiles"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 font-semibold text-amber-100 transition hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-300/15"
                    >
                      <Icon name="pencil-square" className="size-5" />
                      Редактировать анкету
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </Modal>
      {photo && profile?.photo_url && (
        <Modal
          id="room-profile-photo-lightbox"
          labelId="room-photo-title"
          onClose={closePhoto}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/95 p-4 backdrop-blur-md"
        >
          <h2 id="room-photo-title" className="sr-only">
            Фото {nickname}
          </h2>
          <button
            type="button"
            onClick={closePhoto}
            aria-label="Закрыть увеличенное фото"
            className="absolute right-4 top-4 text-white"
          >
            <Icon name="x-mark" className="size-6" />
          </button>
          <img src={profile.photo_url} alt={`Фото ${nickname}`} className="max-h-[90vh] max-w-[90vw] object-contain" />
        </Modal>
      )}
    </>
  )
}
