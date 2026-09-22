import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react"
import {APIError, getJSON, readLocation, routeURL} from "./api"

const buttonClass = "min-h-11 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-300 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-300 disabled:opacity-50"
const closeClass = "absolute right-3 top-3 z-20 flex size-10 items-center justify-center rounded-full border border-zinc-600 bg-zinc-950/80 text-zinc-200 transition hover:border-amber-300 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-300"

// Same Heroicons paths as the existing HEEx <.icon> component uses.
const iconPaths = {
  close: "M6 18 18 6M6 6l12 12",
  user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  expand: "M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15",
}

function Icon({name, className}) {
  return <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" aria-hidden="true" focusable="false" className={`inline-block shrink-0 align-middle ${className}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[name]} />
  </svg>
}

function useResource(path) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({path, loading: true, data: null, error: null})
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timer = setTimeout(() => controller.abort(), 15000)
    setState({path, loading: true, data: null, error: null})
    getJSON(path, controller.signal)
      .then(data => {
        if (active) setState({path, loading: false, data, error: null})
      })
      .catch(error => {
        if (active) setState({path, loading: false, data: null, error: error instanceof APIError ? error.message : "Не удалось загрузить анкеты. Проверь соединение и попробуй ещё раз."})
      })
      .finally(() => clearTimeout(timer))
    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [path, attempt])
  return {
    ...(state.path === path ? state : {loading: true, data: null, error: null}),
    retry: () => setAttempt(value => value + 1),
  }
}

function ErrorNotice({message, retry, id}) {
  return <div id={id} className="rounded-xl border border-rose-300/40 bg-zinc-900 p-6">
    <p role="alert" className="text-rose-200">{message}</p>
    <button id={`${id}-retry`} type="button" onClick={retry} className={`${buttonClass} mt-4`}>Попробовать ещё раз</button>
  </div>
}

function Photo({src, nickname, className = "", placeholderClass = ""}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div className={`flex min-h-48 items-center justify-center bg-zinc-950 text-zinc-700 ${className} ${placeholderClass}`}>
    <Icon name="user" className="size-20" />
    <span className="sr-only">Фото недоступно</span>
  </div>
  return <img src={src} alt={`Фото ${nickname}`} loading="lazy" className={className} onError={() => setFailed(true)} />
}

function Rank({rank, className = "text-sm"}) {
  return <span className={`inline-flex max-w-full items-center gap-1.5 font-medium text-amber-200 ${className}`}>
    <img src={rank.icon_url} alt="" className="chat-rank-icon size-4 shrink-0" />
    <span>{rank.title}</span>
  </span>
}

function genderLabel(value) {
  return {male: "Мужской", female: "Женский", other: "Другой"}[value] || "Не указан"
}

function birthDate(value) {
  return value ? value.split("-").reverse().join(".") : "Не указана"
}

// Native modal dialogs provide keyboard focus trapping and inert background content.
function Modal({id, labelId, onDismiss, children, photo = false}) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const dialog = ref.current
    dialog.showModal()
    document.body.style.overflow = "hidden"
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  return <dialog ref={ref} id={id} aria-labelledby={labelId}
    onCancel={event => { event.preventDefault(); onDismiss() }}
    onClick={event => { if (event.target === event.currentTarget) onDismiss() }}
    className={photo
      ? "fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none items-center justify-center overflow-hidden border-0 bg-transparent p-4 text-zinc-100 outline-none backdrop:bg-zinc-950/90 backdrop:backdrop-blur-md open:flex sm:p-8"
      : "m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-2xl backdrop:bg-zinc-950/85 backdrop:backdrop-blur-sm"}>
    {children}
  </dialog>
}

function ProfileViewer({nickname, onDismiss}) {
  const resource = useResource(`/api/v1/profiles/${encodeURIComponent(nickname)}`)
  const [photoOpen, setPhotoOpen] = useState(false)
  const profile = resource.data?.data
  return <>
    <Modal id="profile-viewer" labelId="profile-viewer-title" onDismiss={onDismiss}>
      <article className="relative min-h-64">
        <button id="close-profile-viewer" type="button" onClick={onDismiss} aria-label="Закрыть анкету" className={closeClass}>
          <Icon name="close" className="size-5" />
        </button>
        {!profile && <h2 id="profile-viewer-title" className="sr-only">Анкета {nickname}</h2>}
        {resource.loading && <p role="status" className="p-8">Загружаем анкету…</p>}
        {resource.error && <div className="p-8 pt-16"><ErrorNotice id="profile-detail-error" message={resource.error} retry={resource.retry} /></div>}
        {profile && <div className="grid md:grid-cols-[minmax(0,20rem)_1fr]">
          <div className="min-h-64 bg-zinc-950">
            {profile.photo_url ? <button id="open-profile-photo" type="button" aria-label={`Увеличить фото ${nickname}`} aria-haspopup="dialog" onClick={() => setPhotoOpen(true)} className="group/photo relative block h-full min-h-64 w-full cursor-zoom-in overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300">
              <Photo key={profile.photo_url} src={profile.photo_url} nickname={nickname} className="h-full min-h-64 w-full object-cover" />
              <span className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full border border-white/15 bg-zinc-950/65 text-zinc-100 shadow-lg backdrop-blur-sm"><Icon name="expand" className="size-5" /></span>
            </button> : <Photo nickname={nickname} className="h-full min-h-64" />}
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">Анкета</p>
            <h2 id="profile-viewer-title" className="mt-2 break-words text-3xl font-semibold">{profile.nickname}</h2>
            <div className="mt-2"><Rank rank={profile.rank} /></div>
            <p className="mt-2 text-lg text-amber-200/90">{profile.name || "Имя не указано"}</p>
            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-zinc-500">Пол</dt><dd>{genderLabel(profile.gender)}</dd>
              <dt className="text-zinc-500">Дата рождения</dt><dd>{birthDate(profile.birth_date)}</dd>
              <dt className="text-zinc-500">Прогресс</dt><dd>{profile.progress.public_messages} фраз · {profile.progress.chat_hours} ч. в чате</dd>
            </dl>
            <div className="mt-7 border-t border-zinc-800 pt-6">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">О себе</h3>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-300">{profile.about || "Пользователь пока ничего о себе не рассказал."}</p>
            </div>
          </div>
        </div>}
      </article>
    </Modal>
    {photoOpen && profile && <Modal id="profile-photo-lightbox" labelId="profile-photo-lightbox-title" onDismiss={() => setPhotoOpen(false)} photo>
      <button id="close-profile-photo-lightbox" type="button" onClick={() => setPhotoOpen(false)} aria-label="Закрыть увеличенное фото" className="absolute right-4 top-4 z-20 flex size-11 items-center justify-center rounded-full border border-white/15 bg-zinc-900/80 text-zinc-100 shadow-xl backdrop-blur-sm transition hover:border-amber-300 hover:text-amber-200 sm:right-7 sm:top-7"><Icon name="close" className="size-6" /></button>
      <figure className="relative z-10 flex max-h-full max-w-full flex-col items-center gap-4">
        <Photo src={profile.photo_url} nickname={nickname} className="max-h-[calc(100vh-8rem)] max-w-[min(92vw,90rem)] rounded-xl object-contain shadow-2xl ring-1 ring-white/10" />
        <figcaption id="profile-photo-lightbox-title" className="text-center text-sm text-zinc-300">Фото {nickname}</figcaption>
      </figure>
    </Modal>}
  </>
}

function PageLink({route, goTo, children, ...props}) {
  return <a {...props} href={routeURL(route)} onClick={event => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      goTo(route)
    }
  }}>{children}</a>
}

export default function ProfilesApp() {
  const [route, setRoute] = useState(readLocation)
  const [input, setInput] = useState(route.query)
  const goTo = useCallback(next => {
    const url = routeURL(next)
    if (url !== window.location.pathname + window.location.search) window.history.pushState(null, "", url)
    setRoute(next)
    setInput(next.query)
  }, [])
  useEffect(() => {
    const onPopState = () => { const next = readLocation(); setRoute(next); setInput(next.query) }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])
  useEffect(() => {
    if (input.trim() === route.query) return
    const timer = setTimeout(() => goTo({query: input.trim(), page: 1, nickname: ""}), 300)
    return () => clearTimeout(timer)
  }, [input, route.query, goTo])

  const resource = useResource(`/api/v1/profiles?${new URLSearchParams({q: route.query, page: String(route.page)})}`)
  const result = resource.data
  const meta = result?.meta
  const firstPage = meta ? Math.max(Math.min(meta.page - 2, meta.total_pages - 4), 1) : 1
  const pages = meta ? Array.from({length: Math.min(5, meta.total_pages)}, (_, i) => firstPage + i) : []

  return <div id="profiles-content" className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
    <div className="flex flex-col gap-6 border-b border-zinc-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-300">Досье чатлан</p>
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Анкеты</h1>
        <p id="profiles-total" aria-live="polite" className="mt-3 text-sm text-zinc-400">{resource.loading ? "Ищем анкеты…" : meta ? `Найдено: ${meta.total}` : "Каталог недоступен"}</p>
      </div>
      <form id="profile-search" className="w-full max-w-md" onSubmit={event => {event.preventDefault(); goTo({query: input.trim(), page: 1, nickname: ""})}}>
        <label htmlFor="profile-search-query" className="mb-2 block text-xs uppercase tracking-[0.16em] text-zinc-400">Поиск по нику или имени</label>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-500" />
          <input id="profile-search-query" name="q" value={input} onChange={event => setInput(event.target.value)} maxLength={80} autoComplete="off" placeholder="Например, Scottie" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-11 pr-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300" />
        </div>
      </form>
    </div>
    <div id="profiles" aria-busy={resource.loading} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {resource.loading && <p role="status" className="col-span-full py-16 text-center text-zinc-400">Загружаем анкеты…</p>}
      {resource.error && <div className="col-span-full"><ErrorNotice id="profiles-error" message={resource.error} retry={resource.retry} /></div>}
      {result && result.data.length === 0 && <p id="profiles-empty" className="col-span-full rounded-2xl border border-dashed border-zinc-700 px-6 py-16 text-center text-zinc-400">По этому запросу анкет не найдено.</p>}
      {result?.data.map(profile => <button key={profile.nickname} id={`profile-${profile.nickname}`} type="button" data-profile-nickname={profile.nickname} aria-label={`Открыть анкету ${profile.nickname}`} onClick={() => goTo({...route, nickname: profile.nickname})} className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 text-left shadow-lg transition duration-300 hover:-translate-y-1 hover:border-rose-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
        <div className="aspect-[4/3] overflow-hidden bg-zinc-950"><Photo key={profile.thumbnail_url} src={profile.thumbnail_url} nickname={profile.nickname} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" placeholderClass="bg-[radial-gradient(circle_at_center,rgba(190,18,60,0.2),transparent_65%)]" /></div>
        <div className="p-5">
          <h2 className="truncate text-2xl">{profile.nickname}</h2>
          <div className="mt-2"><Rank rank={profile.rank} className="text-xs" /></div>
          <p className="mt-1 truncate text-sm text-amber-200/80">{profile.name || "Имя не указано"}</p>
          <p className="mt-4 text-xs text-zinc-500">{genderLabel(profile.gender)}{profile.birth_date && ` · ${birthDate(profile.birth_date)}`}</p>
          <p className="mt-4 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-zinc-400">{profile.about || "Пользователь пока ничего о себе не рассказал."}</p>
          <p className="mt-4 text-xs text-zinc-500">{profile.progress.public_messages} фраз · {profile.progress.chat_hours} ч.</p>
        </div>
      </button>)}
    </div>
    {meta && meta.total_pages > 1 && <nav id="profiles-pagination" aria-label="Страницы анкет" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {meta.page > 1 && <PageLink id="profiles-previous" className={buttonClass} route={{...route, page: meta.page - 1}} goTo={goTo}>Назад</PageLink>}
      {pages.map(page => <PageLink key={page} id={`profiles-page-${page}`} aria-current={meta.page === page ? "page" : undefined} className={`${buttonClass} ${meta.page === page ? "border-rose-300 bg-rose-300/15 text-rose-100" : ""}`} route={{...route, page}} goTo={goTo}>{page}</PageLink>)}
      {meta.page < meta.total_pages && <PageLink id="profiles-next" className={buttonClass} route={{...route, page: meta.page + 1}} goTo={goTo}>Далее</PageLink>}
    </nav>}
    {route.nickname && <ProfileViewer key={route.nickname} nickname={route.nickname} onDismiss={() => goTo({...route, nickname: ""})} />}
  </div>
}
