import { useCallback, useEffect, useState } from "react"
import { getAccountProfile, listProfiles } from "./api/profiles"
import { readLocation, routeURL, type ProfilesRoute } from "./model/route"
import { useResource } from "./model/useResource"
import { Catalogue, Search } from "./ui/Catalogue"
import { ProfileViewer } from "./ui/ProfileViewer"
import { AccountProfileEditor } from "./ui/AccountProfileEditor"

export default function ProfilesApp() {
  const [route, setRoute] = useState<ProfilesRoute>(readLocation)
  const [input, setInput] = useState(route.query)
  const goTo = useCallback((next: ProfilesRoute) => {
    const url = routeURL(next)
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.pushState(null, "", url)
    setRoute(next)
    setInput(next.query)
  }, [])
  useEffect(() => {
    const onPopState = () => {
      const next = readLocation()
      setRoute(next)
      setInput(next.query)
    }
    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("popstate", onPopState)
    }
  }, [])
  useEffect(() => {
    if (input.trim() === route.query) return
    const timer = window.setTimeout(() => {
      goTo({ query: input.trim(), page: 1, nickname: "" })
    }, 300)
    return () => {
      window.clearTimeout(timer)
    }
  }, [input, route.query, goTo])
  const load = useCallback(
    (signal: AbortSignal) => listProfiles(route.query, route.page, signal),
    [route.page, route.query],
  )
  const resource = useResource(`profiles:${route.query}:${String(route.page)}`, load)
  const account = useResource("account-profile", getAccountProfile)
  const meta = resource.data?.meta
  return (
    <div id="profiles-content" className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
      <div className="flex flex-col gap-6 border-b border-zinc-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-300">Досье чатлан</p>
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Анкеты</h1>
          <p id="profiles-total" aria-live="polite" className="mt-3 text-sm text-zinc-400">
            {resource.loading ? "Ищем анкеты…" : meta ? `Найдено: ${String(meta.total)}` : "Каталог недоступен"}
          </p>
        </div>
        <Search
          input={input}
          onInput={setInput}
          onSubmit={() => {
            goTo({ query: input.trim(), page: 1, nickname: "" })
          }}
        />
      </div>
      <Catalogue
        result={resource.data}
        loading={resource.loading}
        error={resource.error}
        retry={resource.retry}
        route={route}
        goTo={goTo}
      />
      {account.data && <AccountProfileEditor profile={account.data.data} />}
      {route.nickname && (
        <ProfileViewer
          nickname={route.nickname}
          onDismiss={() => {
            goTo({ ...route, nickname: "" })
          }}
        />
      )}
    </div>
  )
}
