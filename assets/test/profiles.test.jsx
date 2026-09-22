import {afterEach, beforeEach, test} from "node:test"
import assert from "node:assert/strict"
import {JSDOM} from "jsdom"

const dom = new JSDOM("<!doctype html><html><body></body></html>", {url: "http://localhost/profiles/react"})
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
})
// jsdom has no native modal implementation. Focus trapping is verified in the browser.
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); this.querySelector("button")?.focus() }
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open") }

const React = (await import("react")).default
const {render, fireEvent, screen, waitFor, cleanup, act} = await import("@testing-library/react")
const {default: ProfilesApp} = await import("../js/profiles/ProfilesApp.jsx")
const originalFetch = globalThis.fetch
const profile = nickname => ({nickname, name: "Алиса", gender: "female", birth_date: "1994-05-18", about: "О себе", photo_url: null, thumbnail_url: null, rank: {title: "Киноман", icon_url: "/images/ranks/users-group.svg"}, progress: {public_messages: 50, chat_hours: 5}})
const catalogue = (data, page = 1, totalPages = 1) => ({data, meta: {page, page_size: 12, total: data.length, total_pages: totalPages, query: ""}})
const response = (body, status = 200) => ({ok: status < 400, json: async () => body})

beforeEach(() => { window.history.replaceState(null, "", "/profiles/react") })
afterEach(() => { cleanup(); globalThis.fetch = originalFetch })

test("searches through the API and renders empty results", async () => {
  const calls = []
  globalThis.fetch = async path => { calls.push(path); return response(catalogue(path.includes("q=missing") ? [] : [profile("alice")])) }
  render(<ProfilesApp />)
  await screen.findByRole("button", {name: "Открыть анкету alice"})
  fireEvent.change(screen.getByLabelText("Поиск по нику или имени"), {target: {value: "missing"}})
  await screen.findByText("По этому запросу анкет не найдено.")
  assert.equal(window.location.search, "?q=missing")
  assert.ok(calls.some(path => path === "/api/v1/profiles?q=missing&page=1"))
})

test("cancels old searches and ignores their late results", async () => {
  let finishOld, oldSignal
  globalThis.fetch = (path, options) => {
    if (path.includes("q=old")) { oldSignal = options.signal; return new Promise(resolve => { finishOld = resolve }) }
    return Promise.resolve(response(catalogue([profile(path.includes("q=new") ? "new" : "initial")])))
  }
  render(<ProfilesApp />)
  await screen.findByRole("button", {name: "Открыть анкету initial"})
  fireEvent.change(screen.getByLabelText("Поиск по нику или имени"), {target: {value: "old"}})
  fireEvent.submit(document.getElementById("profile-search"))
  await waitFor(() => assert.ok(finishOld))
  fireEvent.change(screen.getByLabelText("Поиск по нику или имени"), {target: {value: "new"}})
  fireEvent.submit(document.getElementById("profile-search"))
  await screen.findByRole("button", {name: "Открыть анкету new"})
  assert.equal(oldSignal.aborted, true)
  await act(async () => { finishOld(response(catalogue([profile("old")])) ) })
  assert.equal(screen.queryByRole("button", {name: "Открыть анкету old"}), null)
})

test("pagination and browser navigation keep search and page in sync", async () => {
  globalThis.fetch = async path => response(catalogue([profile(path.includes("page=2") ? "second" : "first")], path.includes("page=2") ? 2 : 1, 2))
  render(<ProfilesApp />)
  await screen.findByRole("button", {name: "Открыть анкету first"})
  fireEvent.click(screen.getByRole("link", {name: "Далее"}))
  await screen.findByRole("button", {name: "Открыть анкету second"})
  assert.equal(window.location.search, "?page=2")
  assert.equal(document.getElementById("profiles-page-2").getAttribute("aria-current"), "page")
  await act(async () => { window.history.replaceState(null, "", "/profiles/react?q=Алиса"); window.dispatchEvent(new window.PopStateEvent("popstate")) })
  await screen.findByRole("button", {name: "Открыть анкету first"})
  assert.equal(screen.getByLabelText("Поиск по нику или имени").value, "Алиса")
})

test("opens details and a photo, closes with Escape and restores focus", async () => {
  const alice = {...profile("alice"), photo_url: "/profiles/alice/photo"}
  globalThis.fetch = async path => response(path.includes("/profiles/alice") ? {data: alice} : catalogue([alice]))
  render(<ProfilesApp />)
  const card = await screen.findByRole("button", {name: "Открыть анкету alice"})
  card.focus()
  fireEvent.click(card)
  const zoom = await screen.findByRole("button", {name: "Увеличить фото alice"})
  assert.equal(window.location.search, "?profile=alice")
  zoom.focus()
  fireEvent.click(zoom)
  assert.equal(screen.getAllByRole("dialog").length, 2)
  fireEvent(document.getElementById("profile-photo-lightbox"), new window.Event("cancel", {bubbles: false, cancelable: true}))
  assert.equal(screen.getAllByRole("dialog").length, 1)
  assert.equal(document.activeElement, zoom)
  fireEvent.click(screen.getByRole("button", {name: "Закрыть анкету"}))
  assert.equal(screen.queryByRole("dialog"), null)
  assert.equal(document.activeElement, card)
  assert.equal(window.location.search, "")
  assert.equal(document.body.style.overflow, "")
})

test("shows network errors and retries without losing search", async () => {
  let unavailable = true
  globalThis.fetch = async () => { if (unavailable) throw new TypeError("offline"); return response(catalogue([profile("recovered")])) }
  render(<ProfilesApp />)
  await screen.findByRole("alert")
  unavailable = false
  fireEvent.click(screen.getByRole("button", {name: "Попробовать ещё раз"}))
  await screen.findByRole("button", {name: "Открыть анкету recovered"})
  assert.equal(screen.queryByRole("alert"), null)
})

test("deep-linked missing profiles show an error that can be dismissed", async () => {
  window.history.replaceState(null, "", "/profiles/react?q=alice&profile=missing")
  globalThis.fetch = async path => path.endsWith("/missing") ? response({error: {code: "not_found", message: "Анкета не найдена."}}, 404) : response(catalogue([]))
  render(<ProfilesApp />)
  await screen.findByText("Анкета не найдена.")
  fireEvent.click(screen.getByRole("button", {name: "Закрыть анкету"}))
  assert.equal(window.location.search, "?q=alice")
  assert.equal(screen.queryByRole("dialog"), null)
})

test("renders user text without interpreting it as HTML", async () => {
  globalThis.fetch = async () => response(catalogue([{...profile("alice"), about: '<img src=x onerror="alert(1)">'}]))
  render(<ProfilesApp />)
  await screen.findByText('<img src=x onerror="alert(1)">')
  assert.equal(document.querySelector("img[onerror]"), null)
})
