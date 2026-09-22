import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { MessageEntry } from "../src/features/chat/ui/MessageEntry"
import { decodeFrame } from "../src/features/chat/api/protocol"

test("chat boundary rejects invalid dates, colors and typography before rendering", () => {
  const message = {
    id: 1,
    client_id: "outbox",
    kind: "text",
    author: "гость",
    body: "привет",
    sent_at: "2026-09-22T10:20:30Z",
    appearance: {
      dark: { nickname_color: "#fcd34d", text_color: "#e4e4e7" },
      light: { nickname_color: "#9a3412", text_color: "#1f2937" },
    },
    font_id: "theme",
    font_style: "normal",
  }
  const frame = (patch: object) => decodeFrame(JSON.stringify({ type: "ack", message: { ...message, ...patch } }))
  assert.equal(frame({})?.type, "ack")
  for (const patch of [
    { sent_at: "invalid" },
    { font_id: "unexpected" },
    { font_style: "bold" },
    { appearance: { ...message.appearance, dark: { nickname_color: "url(example)", text_color: "#e4e4e7" } } },
  ]) {
    assert.equal(frame(patch), null)
  }
})

test("message text stays inert while HTTP links stop at quotes", () => {
  const html = renderToStaticMarkup(
    createElement(MessageEntry, {
      nickname: "reader",
      onAddress: () => undefined,
      message: {
        id: 1,
        client_id: "",
        kind: "text",
        author: "guest",
        body: `<script>alert(1)</script> https://example.com/"text javascript:alert(1)`,
        sent_at: "2026-09-22T10:20:30Z",
        font_id: "theme",
        font_style: "normal",
        appearance: {
          dark: { nickname_color: "#fcd34d", text_color: "#e4e4e7" },
          light: { nickname_color: "#9a3412", text_color: "#1f2937" },
        },
      },
    }),
  )
  const document = new JSDOM(html).window.document
  assert.equal(document.querySelector("script"), null)
  assert.equal(document.querySelector("a")?.href, "https://example.com/")
  assert.equal(document.querySelectorAll("a").length, 1)
  assert.ok(document.querySelector(".chat-message-body")?.textContent.includes("<script>alert(1)</script>"))
})
