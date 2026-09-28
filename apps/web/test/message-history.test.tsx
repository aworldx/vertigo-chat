import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { JSDOM } from "jsdom"
const dom = new JSDOM("<!doctype html><html><body></body></html>")
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
})
const React = (await import("react")).default
const { render, fireEvent, cleanup, waitFor } = await import("@testing-library/react")
const { MessageHistory } = await import("../src/features/chat/ui/MessageHistory")
const { loadHistory } = await import("../src/features/chat/api/history")
const original = globalThis.fetch
afterEach(() => {
  cleanup()
  globalThis.fetch = original
})
const message = {
  id: 1,
  client_id: "",
  kind: "text",
  author: "Styled",
  body: "**Привет** <script>",
  sent_at: "2026-09-28T10:00:00Z",
  recipient: "",
  reactions: {},
  reacted: [],
  appearance: {
    dark: { nickname_color: "#aabbcc", text_color: "#ddeeff" },
    light: { nickname_color: "#112233", text_color: "#334455" },
  },
  font_id: "serif",
  font_style: "italic",
}
test("history requires a selected period, renders stored styling and paginates the applied period", async () => {
  const requests: string[] = []
  globalThis.fetch = (url) => {
    requests.push(typeof url === "string" ? url : url instanceof URL ? url.href : url.url)
    return Promise.resolve(
      new Response(
        JSON.stringify(
          requests.length === 1
            ? { data: [message], next: 1 }
            : { data: [{ ...message, id: 2, kind: "system", body: "Гость вошёл" }], next: null },
        ),
      ),
    )
  }
  const view = render(<MessageHistory />)
  assert.equal(requests.length, 0)
  fireEvent.change(view.getByLabelText("С"), { target: { value: "2026-09-01" } })
  fireEvent.submit(view.container.querySelector("form") ?? assert.fail("form"))
  await waitFor(() => {
    assert.ok(view.getByText("Styled"))
  })
  assert.ok(requests[0]?.includes("from=2026-09-01"))
  assert.equal(view.container.querySelector("li")?.getAttribute("data-message-font"), "serif")
  assert.equal(view.container.querySelector(".chat-message-author")?.getAttribute("style")?.includes("#aabbcc"), true)
  assert.ok(view.container.querySelector("strong"))
  assert.equal(view.container.querySelector("script"), null)
  fireEvent.change(view.getByLabelText("С"), { target: { value: "2026-09-10" } })
  fireEvent.click(view.getByText("Следующие 100"))
  await waitFor(() => {
    assert.ok(view.getByText("Гость вошёл"))
  })
  assert.ok(requests[1]?.includes("from=2026-09-01"))
  assert.ok(requests[1]?.includes("after=1"))
  assert.ok(!view.queryByText("Styled"))
  assert.equal(view.queryByText("Следующие 100"), null)
})
test("history reports loading failures and empty results on retry", async () => {
  globalThis.fetch = () => Promise.resolve(new Response("{}", { status: 503 }))
  const view = render(<MessageHistory />)
  fireEvent.submit(view.container.querySelector("form") ?? assert.fail("form"))
  await waitFor(() => {
    assert.ok(view.getByRole("alert"))
  })
  globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({ data: [], next: null })))
  fireEvent.submit(view.container.querySelector("form") ?? assert.fail("form"))
  await waitFor(() => {
    assert.ok(view.getByText(/За этот период сообщений нет/))
  })
  assert.equal(view.queryByRole("alert"), null)
})
test("history boundary rejects private messages and malformed pages", async () => {
  for (const value of [
    { data: [{ ...message, kind: "private" }], next: null },
    { data: [{}], next: null },
    { data: [], next: 0 },
    { data: Array.from({ length: 101 }, () => message), next: null },
    null,
  ]) {
    globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(value)))
    await assert.rejects(loadHistory({ from: "2026-09-01", through: "2026-09-28" }, 0, new AbortController().signal))
  }
})

test("administrator confirms archive deletion; system events are protected and failures stay retryable", async () => {
  const originalConfirm = window.confirm.bind(window)
  let deletes = 0
  let fail = true
  globalThis.fetch = (_url, init) => {
    if (init?.method === "DELETE") {
      deletes++
      assert.equal(new Headers(init.headers).get("X-CSRF-Token"), "csrf")
      return Promise.resolve(
        new Response(JSON.stringify(fail ? { error: "action_rejected" } : { deleted: true }), {
          status: fail ? 403 : 200,
        }),
      )
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({ data: [message, { ...message, id: 2, kind: "system", body: "Вход" }], next: null }),
      ),
    )
  }
  try {
    const view = render(<MessageHistory csrf="csrf" />)
    fireEvent.submit(view.container.querySelector("form") ?? assert.fail("form"))
    await waitFor(() => {
      assert.equal(view.getAllByRole("button", { name: "Удалить сообщение" }).length, 1)
    })
    window.confirm = () => false
    fireEvent.click(view.getByRole("button", { name: "Удалить сообщение" }))
    assert.equal(deletes, 0)
    window.confirm = () => true
    fireEvent.click(view.getByRole("button", { name: "Удалить сообщение" }))
    await waitFor(() => {
      assert.ok(view.getByRole("alert"))
    })
    assert.ok(view.getByText("Styled"))
    fail = false
    fireEvent.click(view.getByRole("button", { name: "Удалить сообщение" }))
    await waitFor(() => {
      assert.ok(!view.queryByText("Styled"))
    })
    assert.ok(view.getByText("Вход"))
  } finally {
    window.confirm = originalConfirm
  }
})
