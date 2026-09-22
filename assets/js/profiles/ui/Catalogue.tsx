import type { SyntheticEvent } from "react"
import type { ListProfilesResponse, Profile } from "../api/profiles"
import type { ProfilesRoute } from "../model/route"
import { routeURL } from "../model/route"
import { birthDate, buttonClass, ErrorNotice, Icon, Photo, Rank, genderLabel } from "./Primitives"

export function Search({
  input,
  onInput,
  onSubmit,
}: {
  input: string
  onInput: (value: string) => void
  onSubmit: () => void
}) {
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }
  return (
    <form id="profile-search" className="w-full max-w-md" onSubmit={submit}>
      <label htmlFor="profile-search-query" className="mb-2 block text-xs uppercase tracking-[0.16em] text-zinc-400">
        Поиск по нику или имени
      </label>
      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-500"
        />
        <input
          id="profile-search-query"
          name="q"
          value={input}
          onChange={(event) => {
            onInput(event.target.value)
          }}
          maxLength={80}
          autoComplete="off"
          placeholder="Например, Scottie"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-11 pr-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300"
        />
      </div>
    </form>
  )
}
function Card({ profile, open }: { profile: Profile; open: () => void }) {
  return (
    <button
      id={`profile-${profile.nickname}`}
      type="button"
      data-profile-nickname={profile.nickname}
      aria-label={`Открыть анкету ${profile.nickname}`}
      onClick={open}
      className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 text-left shadow-lg transition duration-300 hover:-translate-y-1 hover:border-rose-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
    >
      <div className="aspect-[4/3] overflow-hidden bg-zinc-950">
        <Photo
          src={profile.thumbnail_url}
          nickname={profile.nickname}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          placeholderClass="bg-[radial-gradient(circle_at_center,rgba(190,18,60,0.2),transparent_65%)]"
        />
      </div>
      <div className="p-5">
        <h2 className="truncate text-2xl">{profile.nickname}</h2>
        <div className="mt-2">
          <Rank rank={profile.rank} className="text-xs" />
        </div>
        <p className="mt-1 truncate text-sm text-amber-200/80">{profile.name || "Имя не указано"}</p>
        <p className="mt-4 text-xs text-zinc-500">
          {genderLabel(profile.gender)}
          {profile.birth_date && ` · ${birthDate(profile.birth_date)}`}
        </p>
        <p className="mt-4 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-zinc-400">
          {profile.about || "Пользователь пока ничего о себе не рассказал."}
        </p>
        <p className="mt-4 text-xs text-zinc-500">
          {profile.progress.public_messages} фраз · {profile.progress.chat_hours} ч.
        </p>
      </div>
    </button>
  )
}
export function Catalogue({
  result,
  loading,
  error,
  retry,
  route,
  goTo,
}: {
  result: ListProfilesResponse | null
  loading: boolean
  error: string | null
  retry: () => void
  route: ProfilesRoute
  goTo: (route: ProfilesRoute) => void
}) {
  const meta = result?.meta
  const first = meta ? Math.max(Math.min(meta.page - 2, meta.total_pages - 4), 1) : 1
  const pages = meta ? Array.from({ length: Math.min(5, meta.total_pages) }, (_, index) => first + index) : []
  return (
    <>
      <div
        id="profiles"
        aria-busy={loading}
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {loading && (
          <p role="status" className="col-span-full py-16 text-center text-zinc-400">
            Загружаем анкеты…
          </p>
        )}
        {error && (
          <div className="col-span-full">
            <ErrorNotice id="profiles-error" message={error} retry={retry} />
          </div>
        )}
        {result?.data.length === 0 && (
          <p
            id="profiles-empty"
            className="col-span-full rounded-2xl border border-dashed border-zinc-700 px-6 py-16 text-center text-zinc-400"
          >
            По этому запросу анкет не найдено.
          </p>
        )}
        {result?.data.map((profile) => (
          <Card
            key={profile.nickname}
            profile={profile}
            open={() => {
              goTo({ ...route, nickname: profile.nickname })
            }}
          />
        ))}
      </div>
      {meta && meta.total_pages > 1 && (
        <nav
          id="profiles-pagination"
          aria-label="Страницы анкет"
          className="mt-10 flex flex-wrap items-center justify-center gap-2"
        >
          {meta.page > 1 && (
            <a
              id="profiles-previous"
              href={routeURL({ ...route, page: meta.page - 1 })}
              onClick={(event) => {
                event.preventDefault()
                goTo({ ...route, page: meta.page - 1 })
              }}
              className={buttonClass}
            >
              Назад
            </a>
          )}
          {pages.map((page) => (
            <a
              key={page}
              id={`profiles-page-${String(page)}`}
              href={routeURL({ ...route, page })}
              onClick={(event) => {
                event.preventDefault()
                goTo({ ...route, page })
              }}
              aria-current={meta.page === page ? "page" : undefined}
              className={`${buttonClass} ${meta.page === page ? "border-rose-300 bg-rose-300/15 text-rose-100" : ""}`}
            >
              {page}
            </a>
          ))}
          {meta.page < meta.total_pages && (
            <a
              id="profiles-next"
              href={routeURL({ ...route, page: meta.page + 1 })}
              onClick={(event) => {
                event.preventDefault()
                goTo({ ...route, page: meta.page + 1 })
              }}
              className={buttonClass}
            >
              Далее
            </a>
          )}
        </nav>
      )}
    </>
  )
}
