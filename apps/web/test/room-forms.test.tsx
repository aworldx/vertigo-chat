import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { JSDOM } from "jsdom"
import type { RoomFormKind } from "../src/features/chat/model/useRoomForm"
const dom = new JSDOM("<html><body></body></html>", { url: "https://chat.example/chat" })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  MutationObserver: dom.window.MutationObserver,
  FormData: dom.window.FormData,
  File: dom.window.File,
  sessionStorage: dom.window.sessionStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
})
const React = (await import("react")).default
const { render, fireEvent, screen, waitFor, cleanup, renderHook, act } = await import("@testing-library/react")
const { FeedbackModal } = await import("../src/features/chat/ui/FeedbackModal")
const { RegistrationModal } = await import("../src/features/chat/ui/RegistrationModal")
const { PendingEntry } = await import("../src/features/chat/ui/PendingEntry")
const { useRoomForm } = await import("../src/features/chat/model/useRoomForm")
const { ChatConnection } = await import("../src/features/chat/model/connection")
const { saveSession, readSession } = await import("../src/features/chat/model/storage")
const originalFetch = globalThis.fetch
afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  sessionStorage.clear()
})
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } })
function formFixture(kind: RoomFormKind, csrf = "csrf") {
  const connection = new ChatConnection()
  const state = { ...connection.getSnapshot(), nickname: "Alice", status: "ready" as const, generation: 3 }
  const { result } = renderHook(() => useRoomForm(csrf, state, connection, () => Promise.resolve()))
  act(() => {
    result.current.open(kind)
  })
  return { result, connection, state }
}
function requestBody(init: RequestInit | undefined): string {
  assert.ok(typeof init?.body === "string")
  return init.body
}
function byID(id: string) {
  const element = document.getElementById(id)
  assert.ok(element)
  return element
}

test("guest feedback submits trimmed server-bound data and displays success", async () => {
  let payload: unknown
  globalThis.fetch = (_input, init) => {
    payload = JSON.parse(requestBody(init)) as unknown
    assert.equal(new Headers(init?.headers).get("X-CSRF-Token"), "csrf")
    return Promise.resolve(response({ data: { sent: true } }, 201))
  }
  const f = formFixture("feedback")
  const view = render(<FeedbackModal form={f.result.current} nickname="Alice" registered={false} />)
  fireEvent.change(byID("feedback-name"), { target: { value: "Guest" } })
  fireEvent.change(byID("feedback-body"), { target: { value: "Please improve search" } })
  fireEvent.submit(byID("feedback-form"))
  await waitFor(() => {
    assert.match(f.result.current.success, /отправлено/)
  })
  assert.deepEqual(payload, { name: "Guest", body: "Please improve search" })
  view.rerender(<FeedbackModal form={f.result.current} nickname="Alice" registered={false} />)
  assert.match(screen.getByRole("status").textContent, /Спасибо/)
  fireEvent.click(byID("close-feedback"))
  assert.equal(f.result.current.kind, null)
})
test("registered feedback uses the session name and allows retry after server rejection", async () => {
  globalThis.fetch = () => Promise.resolve(response({ error: "Rate limited" }, 422))
  const f = formFixture("feedback")
  const data = new FormData()
  data.set("body", "Hello")
  await act(() => f.result.current.submit(data))
  const view = render(<FeedbackModal form={f.result.current} nickname="Alice" registered />)
  assert.equal(document.getElementById("feedback-name"), null)
  assert.equal(screen.getByRole("alert").textContent, "Rate limited")
  globalThis.fetch = (_input, init) => {
    assert.deepEqual(JSON.parse(requestBody(init)), { name: "Alice", body: "Hello" })
    return Promise.resolve(response({ data: { sent: true } }))
  }
  await act(() => f.result.current.submit(data))
  view.rerender(<FeedbackModal form={f.result.current} nickname="Alice" registered />)
  assert.ok(screen.getByRole("status"))
})
test("guest registration keeps nickname immutable and rotates the saved resume credential", async (t) => {
  saveSession({ nickname: "Alice", resume_token: "old" })
  const f = formFixture("register")
  const tokens: string[] = []
  t.mock.method(f.connection, "replaceCredential", (token: string) => tokens.push(token))
  globalThis.fetch = (_input, init) => {
    assert.deepEqual(JSON.parse(requestBody(init)), {
      nickname: "Alice",
      resume_token: "old",
      generation: 3,
      password: "secret123",
      email: "alice@example.com",
    })
    return Promise.resolve(response({ data: { nickname: "Alice", resume_token: "new" } }))
  }
  render(<RegistrationModal form={f.result.current} nickname="Alice" />)
  assert.equal(byID("registration-nickname").getAttribute("readonly"), "")
  fireEvent.change(byID("registration-password"), { target: { value: "secret123" } })
  fireEvent.change(byID("registration-email"), { target: { value: "alice@example.com" } })
  fireEvent.submit(byID("registration-form"))
  await waitFor(() => {
    assert.equal(f.result.current.kind, null)
  })
  assert.deepEqual(tokens, ["new"])
  assert.equal(readSession()?.resume_token, "new")
})
test("room forms expose session, validation and attachment failures", async () => {
  const f = formFixture("register", "")
  await act(() => f.result.current.submit(new FormData()))
  const view = render(<RegistrationModal form={f.result.current} nickname="Alice" />)
  assert.match(screen.getByRole("alert").textContent, /сессию/)
  view.rerender(<RegistrationModal form={{ ...f.result.current, busy: true }} nickname="Alice" />)
  assert.equal(byID("register-user").getAttribute("disabled"), "")
  fireEvent.click(byID("close-registration"))
  assert.equal(f.result.current.kind, null)
  const attachment = formFixture("attachment")
  await act(() => attachment.result.current.submit(new FormData()))
  assert.match(attachment.result.current.error, /Выбери файл/)
})
test("pending delivery exposes retry and cancel only for failed messages", () => {
  const retries: string[] = [],
    cancels: string[] = []
  const item = {
    client_id: "id",
    body: "<script>inert</script>",
    sent_at: new Date().toISOString(),
    state: "failed" as const,
  }
  const view = render(
    <PendingEntry
      message={item}
      nickname="Alice"
      onRetry={(id) => retries.push(id)}
      onCancel={(id) => cancels.push(id)}
    />,
  )
  assert.equal(document.querySelector("script"), null)
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }))
  fireEvent.click(screen.getByRole("button", { name: "Удалить" }))
  assert.deepEqual(retries, ["id"])
  assert.deepEqual(cancels, ["id"])
  for (const state of ["blocked", "confirmed", "retrying", "sending"] as const) {
    view.rerender(
      <PendingEntry
        message={{ ...item, state }}
        nickname="Alice"
        onRetry={() => undefined}
        onCancel={() => undefined}
      />,
    )
    assert.equal(screen.queryAllByRole("button").length, 0)
    assert.equal(byID("pending-message-id").getAttribute("data-delivery-state"), state)
  }
})
