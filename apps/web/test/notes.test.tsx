import assert from "node:assert/strict"
import { test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { loadNotes, notesError, notesSummary, sendNote } from "../src/features/notes/api/notes"
import { Notes } from "../src/features/notes/ui/Notes"

const note = {
  id: 1,
  sender: "Сова",
  recipient: "Лис",
  body: "Увидимся позже",
  read: false,
  inserted_at: "2026-10-02T12:00:00Z",
}

test("notes validate responses and send a CSRF-protected note", async (t) => {
  const requests: Array<{ url: string; init: RequestInit | undefined }> = []
  t.mock.method(globalThis, "fetch", (url: string, init?: RequestInit) => {
    requests.push({ url, init })
    if (url.endsWith("/summary")) return Promise.resolve(new Response('{"unread":2}'))
    if (init?.method === "POST") return Promise.resolve(new Response('{"id":1}', { status: 201 }))
    return Promise.resolve(new Response(JSON.stringify({ incoming: [note], outgoing: [] })))
  })

  assert.equal(await notesSummary(), 2)
  assert.deepEqual(await loadNotes(new AbortController().signal), { incoming: [note], outgoing: [] })
  await sendNote("Лис", "Привет", "csrf-token")

  const mutation = requests.at(-1)
  assert.ok(mutation)
  assert.ok(mutation.init)
  assert.equal(mutation.url, "/api/v1/notes")
  assert.equal(mutation.init.method, "POST")
  assert.equal(new Headers(mutation.init.headers).get("X-CSRF-Token"), "csrf-token")
  const body = mutation.init.body
  assert.equal(typeof body, "string")
  if (typeof body !== "string") throw new Error("request body must be JSON")
  assert.deepEqual(JSON.parse(body), { recipient: "Лис", body: "Привет" })
})

test("notes reject malformed data and explain send errors", async (t) => {
  t.mock.method(globalThis, "fetch", () => Promise.resolve(new Response('{"incoming":[{}],"outgoing":[]}')))
  await assert.rejects(loadNotes(new AbortController().signal), { message: "invalid_response" })

  for (const [code, message] of [
    ["recipient_not_found", "Такого зарегистрированного чатлана нет."],
    ["invalid_note", "Укажи чатлана и текст до 1000 символов."],
    ["note_daily_limit", "За сутки можно оставить не больше 30 записок."],
  ])
    assert.equal(notesError(new Error(code)), message)
  assert.equal(notesError(new Error("unknown")), "Не удалось открыть записную книжку.")
})

test("notes page keeps unauthenticated visitors on the sign-in prompt", () => {
  const html = renderToStaticMarkup(<Notes nickname="" csrf="" login={<a href="/login">Войти</a>} />)
  assert.match(html, /Записная книжка/)
  assert.match(html, /Личные записки не попадают в общий чат/)
  assert.match(html, /Войти/)
  assert.doesNotMatch(html, /id="send-note"/)
})
