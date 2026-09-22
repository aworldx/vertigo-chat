export type ProfilesRoute = { query: string; page: number; nickname: string }

export function readLocation(): ProfilesRoute {
  const params = new URLSearchParams(window.location.search)
  const page = params.get("page") ?? "1"
  return {
    query: params.get("q") ?? "",
    page: /^[1-9]\d{0,9}$/.test(page) ? Number(page) : 1,
    nickname: params.get("profile") ?? "",
  }
}

export function routeURL(route: ProfilesRoute): string {
  const params = new URLSearchParams()
  if (route.query) params.set("q", route.query)
  if (route.page > 1) params.set("page", String(route.page))
  if (route.nickname) params.set("profile", route.nickname)
  return `${window.location.pathname}${params.size ? `?${params}` : ""}`
}
