import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { JSDOM } from "jsdom"
import type { ListProfilesResponse, Profile } from "../js/profiles/api/profiles"

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/profiles/react" })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  MutationObserver: dom.window.MutationObserver,
  IS_REACT_ACT_ENVIRONMENT: true,
})
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "")
  this.querySelector("button")?.focus()
}
dom.window.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open")
}
const React = (await import("react")).default
const { render, fireEvent, screen, waitFor, cleanup, act } = await import("@testing-library/react")
const { default: ProfilesApp } = await import("../js/profiles/ProfilesApp")
const originalFetch = globalThis.fetch
const profile = (nickname: string): Profile => ({
  nickname,
  name: "Алиса",
  gender: "female",
  birth_date: "1994-05-18",
  about: "О себе",
  photo_url: null,
  thumbnail_url: null,
  rank: { title: "Киноман", icon_url: "/images/ranks/users-group.svg" },
  progress: { public_messages: 50, chat_hours: 5 },
})
const catalogue = (data: Profile[], page = 1, totalPages = 1): ListProfilesResponse => ({
  data,
  meta: { page, page_size: 12, total: data.length, total_pages: totalPages, query: "" },
})
const response = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
type FetchHandler = (path: string, init: RequestInit) => Response | Promise<Response>
function mockFetch(handler: FetchHandler) {
  globalThis.fetch = (input, init) => {
    const path = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    return Promise.resolve(handler(path, init ?? {}))
  }
}
function byId(id: string): HTMLElement {
  const element = document.getElementById(id)
  assert.ok(element)
  return element
}

beforeEach(() => {
  window.history.replaceState(null, "", "/profiles/react")
})
afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

test("searches through the API and renders empty results", async () => {
  const calls: string[] = []
  mockFetch((path) => {
    calls.push(path)
    return response(catalogue(path.includes("q=missing") ? [] : [profile("alice")]))
  })
  render(<ProfilesApp />)
  await screen.findByRole("button", { name: "Открыть анкету alice" })
  fireEvent.change(screen.getByLabelText("Поиск по нику или имени"), { target: { value: "missing" } })
  await screen.findByText("По этому запросу анкет не найдено.")
  assert.equal(window.location.search, "?q=missing")
  assert.ok(calls.includes("/api/v1/profiles?q=missing&page=1"))
})
test("cancels old searches and ignores late results", async () => {
  let finishOld: (value: Response) => void = () => {}
  let oldSignal: AbortSignal | undefined
  mockFetch((path, init) => {
    if (path.includes("q=old"))
      return new Promise((resolve) => {
        finishOld = resolve
        oldSignal = init.signal as AbortSignal
      })
    return response(catalogue([profile(path.includes("q=new") ? "new" : "initial")]))
  })
  render(<ProfilesApp />)
  await screen.findByRole("button", { name: "Открыть анкету initial" })
  fireEvent.change(screen.getByLabelText("Поиск по нику или имени"), { target: { value: "old" } })
  fireEvent.submit(byId("profile-search"))
  await waitFor(() => {
    assert.notEqual(oldSignal, undefined)
  })
  fireEvent.change(screen.getByLabelText("Поиск по нику или имени"), { target: { value: "new" } })
  fireEvent.submit(byId("profile-search"))
  await screen.findByRole("button", { name: "Открыть анкету new" })
  assert.equal(oldSignal?.aborted, true)
  await act(async () => {
    finishOld(response(catalogue([profile("old")])))
  })
  assert.equal(screen.queryByRole("button", { name: "Открыть анкету old" }), null)
})
test("pagination and browser navigation keep search and page in sync", async () => {
  mockFetch((path) =>
    response(catalogue([profile(path.includes("page=2") ? "second" : "first")], path.includes("page=2") ? 2 : 1, 2)),
  )
  render(<ProfilesApp />)
  await screen.findByRole("button", { name: "Открыть анкету first" })
  fireEvent.click(screen.getByRole("link", { name: "Далее" }))
  await screen.findByRole("button", { name: "Открыть анкету second" })
  assert.equal(window.location.search, "?page=2")
  assert.equal(byId("profiles-page-2").getAttribute("aria-current"), "page")
  await act(async () => {
    window.history.replaceState(null, "", "/profiles/react?q=Алиса")
    window.dispatchEvent(new window.PopStateEvent("popstate"))
  })
  await screen.findByRole("button", { name: "Открыть анкету first" })
  const query = screen.getByLabelText("Поиск по нику или имени")
  assert.ok(query instanceof HTMLInputElement)
  assert.equal(query.value, "Алиса")
})
test("opens details and photo, then restores focus", async () => {
  const alice = { ...profile("alice"), photo_url: "/profiles/alice/photo" }
  mockFetch((path) => response(path.includes("/profiles/alice") ? { data: alice } : catalogue([alice])))
  render(<ProfilesApp />)
  const card = await screen.findByRole("button", { name: "Открыть анкету alice" })
  card.focus()
  fireEvent.click(card)
  const zoom = await screen.findByRole("button", { name: "Увеличить фото alice" })
  zoom.focus()
  fireEvent.click(zoom)
  fireEvent(byId("profile-photo-lightbox"), new window.Event("cancel", { bubbles: false, cancelable: true }))
  assert.equal(document.activeElement, zoom)
  fireEvent.click(screen.getByRole("button", { name: "Закрыть анкету" }))
  assert.equal(document.activeElement, card)
  assert.equal(document.body.style.overflow, "")
})
test("retries network errors", async () => {
  let unavailable = true
  mockFetch(() =>
    unavailable ? Promise.reject(new TypeError("offline")) : response(catalogue([profile("recovered")])),
  )
  render(<ProfilesApp />)
  await screen.findByRole("alert")
  unavailable = false
  fireEvent.click(screen.getByRole("button", { name: "Попробовать ещё раз" }))
  await screen.findByRole("button", { name: "Открыть анкету recovered" })
})
test("dismisses a deep-linked missing profile", async () => {
  window.history.replaceState(null, "", "/profiles/react?q=alice&profile=missing")
  mockFetch((path) =>
    path.endsWith("/missing")
      ? response({ error: { code: "not_found", message: "Анкета не найдена." } }, 404)
      : response(catalogue([])),
  )
  render(<ProfilesApp />)
  await screen.findByText("Анкета не найдена.")
  fireEvent.click(screen.getByRole("button", { name: "Закрыть анкету" }))
  assert.equal(window.location.search, "?q=alice")
})
test("renders user text as text", async () => {
  mockFetch(() => response(catalogue([{ ...profile("alice"), about: '<img src=x onerror="alert(1)">' }])))
  render(<ProfilesApp />)
  await screen.findByText('<img src=x onerror="alert(1)">')
  assert.equal(document.querySelector("img[onerror]"), null)
})
