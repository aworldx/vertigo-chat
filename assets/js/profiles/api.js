// Keep the transport contract independent of React and the server implementation.
export class APIError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
  }
}

export async function getJSON(path, signal) {
  const response = await fetch(path, {
    signal,
    credentials: "same-origin",
    headers: {Accept: "application/json"},
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new APIError(
      body.error?.message || "Не удалось загрузить анкеты. Попробуй ещё раз.",
      body.error?.code || "unavailable",
    )
  }
  return response.json()
}

export function readLocation() {
  const params = new URLSearchParams(window.location.search)
  const page = params.get("page") || "1"
  return {
    query: params.get("q") || "",
    page: /^[1-9]\d{0,9}$/.test(page) ? Number(page) : 1,
    nickname: params.get("profile") || "",
  }
}

export function routeURL(route) {
  const params = new URLSearchParams()
  if (route.query) params.set("q", route.query)
  if (route.page > 1) params.set("page", String(route.page))
  if (route.nickname) params.set("profile", route.nickname)
  return window.location.pathname + (params.size ? `?${params}` : "")
}
