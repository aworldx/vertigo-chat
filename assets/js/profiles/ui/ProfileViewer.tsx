import { useCallback, useState } from "react"
import { getProfile } from "../api/profiles"
import { useResource } from "../model/useResource"
import { birthDate, ErrorNotice, Icon, Modal, Photo, Rank, genderLabel } from "./Primitives"

export function ProfileViewer({ nickname, onDismiss }: { nickname: string; onDismiss: () => void }) {
  const load = useCallback((signal: AbortSignal) => getProfile(nickname, signal), [nickname])
  const resource = useResource(`profile:${nickname}`, load)
  const [photoOpen, setPhotoOpen] = useState(false)
  const profile = resource.data?.data
  return (
    <>
      <Modal id="profile-viewer" labelId="profile-viewer-title" onDismiss={onDismiss}>
        <article className="relative min-h-64">
          <button
            id="close-profile-viewer"
            type="button"
            onClick={onDismiss}
            aria-label="Закрыть анкету"
            className="absolute right-3 top-3 z-20 flex size-10 items-center justify-center rounded-full border border-zinc-600 bg-zinc-950/80 text-zinc-200"
          >
            <Icon name="close" className="size-5" />
          </button>
          {!profile && (
            <h2 id="profile-viewer-title" className="sr-only">
              Анкета {nickname}
            </h2>
          )}
          {resource.loading && (
            <p role="status" className="p-8">
              Загружаем анкету…
            </p>
          )}
          {resource.error && (
            <div className="p-8 pt-16">
              <ErrorNotice id="profile-detail-error" message={resource.error} retry={resource.retry} />
            </div>
          )}
          {profile && (
            <div className="grid md:grid-cols-[minmax(0,20rem)_1fr]">
              <div className="min-h-64 bg-zinc-950">
                {profile.photo_url ? (
                  <button
                    id="open-profile-photo"
                    type="button"
                    aria-label={`Увеличить фото ${nickname}`}
                    aria-haspopup="dialog"
                    onClick={() => {
                      setPhotoOpen(true)
                    }}
                    className="group/photo relative block h-full min-h-64 w-full cursor-zoom-in overflow-hidden"
                  >
                    <Photo
                      src={profile.photo_url}
                      nickname={nickname}
                      className="h-full min-h-64 w-full object-cover"
                    />
                    <span className="absolute left-4 top-4 flex size-10 items-center justify-center rounded-full border border-white/15 bg-zinc-950/65 text-zinc-100">
                      <Icon name="expand" className="size-5" />
                    </span>
                  </button>
                ) : (
                  <Photo src={null} nickname={nickname} className="h-full min-h-64" />
                )}
              </div>
              <div className="p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">Анкета</p>
                <h2 id="profile-viewer-title" className="mt-2 break-words text-3xl font-semibold">
                  {profile.nickname}
                </h2>
                <div className="mt-2">
                  <Rank rank={profile.rank} />
                </div>
                <p className="mt-2 text-lg text-amber-200/90">{profile.name || "Имя не указано"}</p>
                <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
                  <dt className="text-zinc-500">Пол</dt>
                  <dd>{genderLabel(profile.gender)}</dd>
                  <dt className="text-zinc-500">Дата рождения</dt>
                  <dd>{birthDate(profile.birth_date)}</dd>
                  <dt className="text-zinc-500">Прогресс</dt>
                  <dd>
                    {profile.progress.public_messages} фраз · {profile.progress.chat_hours} ч. в чате
                  </dd>
                </dl>
                <div className="mt-7 border-t border-zinc-800 pt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">О себе</h3>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-300">
                    {profile.about || "Пользователь пока ничего о себе не рассказал."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </article>
      </Modal>
      {photoOpen && profile && (
        <Modal
          id="profile-photo-lightbox"
          labelId="profile-photo-lightbox-title"
          onDismiss={() => {
            setPhotoOpen(false)
          }}
          photo
        >
          <button
            id="close-profile-photo-lightbox"
            type="button"
            onClick={() => {
              setPhotoOpen(false)
            }}
            aria-label="Закрыть увеличенное фото"
            className="absolute right-4 top-4 z-20 flex size-11 items-center justify-center rounded-full border border-white/15 bg-zinc-900/80 text-zinc-100"
          >
            <Icon name="close" className="size-6" />
          </button>
          <figure className="relative z-10 flex max-h-full max-w-full flex-col items-center gap-4">
            <Photo
              src={profile.photo_url}
              nickname={nickname}
              className="max-h-[calc(100vh-8rem)] max-w-[min(92vw,90rem)] rounded-xl object-contain shadow-2xl"
            />
            <figcaption id="profile-photo-lightbox-title" className="text-center text-sm text-zinc-300">
              Фото {nickname}
            </figcaption>
          </figure>
        </Modal>
      )}
    </>
  )
}
