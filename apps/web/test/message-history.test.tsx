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
const { historyPreset } = await import("../src/features/chat/model/historyPeriod")
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
test("history presets use Moscow dates across midnight and month boundaries", () => {
  const now = new Date("2026-02-28T21:30:00Z")
  assert.deepEqual(historyPreset("today", now), { from: "2026-03-01T00:00", through: "2026-03-01T23:59" })
  assert.deepEqual(historyPreset("yesterday", now), { from: "2026-02-28T00:00", through: "2026-02-28T23:59" })
  assert.deepEqual(historyPreset("hour", now), { from: "2026-02-28T23:30", through: "2026-03-01T00:30" })
})
test("history offers editable minute fields, calendar buttons and quick periods without submitting", () => {
  globalThis.fetch = () => assert.fail("presets must not submit the search")
  const view = render(<MessageHistory />)
  const from = view.getByLabelText("С")
  const through = view.getByLabelText("По")
  assert.ok(from instanceof dom.window.HTMLInputElement)
  assert.ok(through instanceof dom.window.HTMLInputElement)
  assert.equal(from.type, "datetime-local")
  assert.equal(from.step, "60")
  for (const [label, preset] of [
    ["Последний час", "hour"],
    ["Вчера", "yesterday"],
    ["Сегодня", "today"],
  ] as const) {
    fireEvent.click(view.getByRole("button", { name: label }))
    const expected = historyPreset(preset)
    assert.equal(from.value, expected.from)
    assert.equal(through.value, expected.through)
    assert.equal(from.max, through.value)
    assert.equal(through.min, from.value)
  }
  let opened = 0
  from.showPicker = () => {
    opened++
  }
  fireEvent.click(view.getByRole("button", { name: "Выбрать дату и время: С" }))
  assert.equal(opened, 1)
  through.showPicker = () => {
    throw new Error("unsupported")
  }
  fireEvent.click(view.getByRole("button", { name: "Выбрать дату и время: По" }))
  assert.equal(document.activeElement, through)
})
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
  fireEvent.change(view.getByLabelText("С"), { target: { value: "2026-09-01T09:15" } })
  fireEvent.change(view.getByLabelText("По"), { target: { value: "2026-09-02T18:45" } })
  fireEvent.change(view.getByLabelText("Фразы от кого"), { target: { value: " Styled " } })
  fireEvent.change(view.getByLabelText("Фразы кому"), { target: { value: "Кому" } })
  fireEvent.submit(view.container.querySelector("form") ?? assert.fail("form"))
  await waitFor(() => {
    assert.ok(view.getByText("Styled:"))
  })
  assert.ok(requests[0]?.includes("from=2026-09-01"))
  assert.equal(view.container.querySelector("li")?.getAttribute("data-message-font"), "serif")
  assert.equal(view.container.querySelector(".chat-message-author")?.getAttribute("style")?.includes("#aabbcc"), true)
  assert.ok(view.container.querySelector("strong"))
  assert.equal(view.container.querySelector("script"), null)
  fireEvent.change(view.getByLabelText("С"), { target: { value: "2026-09-10T16:30" } })
  fireEvent.change(view.getByLabelText("По"), { target: { value: "2026-09-11T20:30" } })
  fireEvent.change(view.getByLabelText("Фразы от кого"), { target: { value: "Другой" } })
  fireEvent.change(view.getByLabelText("Фразы кому"), { target: { value: "" } })
  fireEvent.click(view.getByText("Следующие 100"))
  await waitFor(() => {
    assert.ok(view.getByText("Гость вошёл"))
  })
  assert.ok(requests[1]?.includes("from=2026-09-01"))
  assert.ok(requests[1]?.includes("after=1"))
  for (const url of requests) {
    const query = new URL(url, "https://local.test").searchParams
    assert.equal(query.get("from"), "2026-09-01T09:15")
    assert.equal(query.get("through"), "2026-09-02T18:45")
    assert.equal(query.get("author"), "Styled")
    assert.equal(query.get("recipient"), "Кому")
  }
  assert.ok(!view.queryByText("Styled:"))
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
    assert.ok(view.getByText("Styled:"))
    fail = false
    fireEvent.click(view.getByRole("button", { name: "Удалить сообщение" }))
    await waitFor(() => {
      assert.ok(!view.queryByText("Styled:"))
    })
    assert.ok(view.getByText("Вход"))
  } finally {
    window.confirm = originalConfirm
  }
})

test("disabled AI summary is absent and ordinary history search still works", async () => {
  const requests: string[] = []
  globalThis.fetch = async (input) => {
    requests.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
    return new Response(JSON.stringify({ data: [], next: null }))
  }
  const view = render(<MessageHistory csrf="admin-token" />)
  assert.equal(view.queryByRole("button", { name: "Сделать AI-саммари" }), null)
  fireEvent.change(view.getByLabelText("Фразы от кого"), { target: { value: "Автор" } })
  fireEvent.click(view.getByRole("button", { name: "Показать историю" }))
  await waitFor(() => {
    assert.ok(view.getByText(/За этот период сообщений нет/))
  })
  assert.ok(requests.some((url) => url.includes("author=")))
  assert.ok(requests.every((url) => !url.includes("/summary")))
})
