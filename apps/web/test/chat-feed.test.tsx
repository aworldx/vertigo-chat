import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { MessageEntry } from "../src/features/chat/ui/MessageEntry"
import { decodeFrame } from "../src/features/chat/api/protocol"
import { feedTimeline, publishTimeline } from "../src/features/chat/model/timeline"
import { defaultPreferences } from "../src/features/chat/api/preferences"

test("chat boundary rejects invalid dates, colors and typography before rendering", () => {
  const message = {
    id: 1,
    recipient: "",
    reactions: {},
    reacted: [],
    client_id: "outbox",
    kind: "text",
    author: "гость",
    body: "привет",
    sent_at: "2026-09-22T10:20:30Z",
    appearance: {
      dark: { nickname_color: "#fcd34d", text_color: "#e4e4e7" },
      light: { nickname_color: "#9a3412", text_color: "#1f2937" },
    },
    font_id: "theme" as const,
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
        recipient: "",
        reactions: {},
        reacted: [],
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

test("inline emoji shares the text-bottom alignment box", () => {
  const html = renderToStaticMarkup(
    createElement(MessageEntry, {
      nickname: "reader",
      onAddress: () => undefined,
      emojis: [{ id: 7, code: ":wave:", terms: [], width: 32, height: 32 }],
      message: {
        id: 2,
        recipient: "",
        reactions: {},
        reacted: [],
        client_id: "",
        kind: "text",
        author: "guest",
        body: "Привет -wave- и :wave: всем",
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
  assert.equal(document.querySelectorAll(".chat-inline-emoji.align-text-bottom img[src='/emojis/7']").length, 2)
})

test("renders chat formatting without turning text into HTML", () => {
  const html = renderToStaticMarkup(
    createElement(MessageEntry, {
      nickname: "reader",
      onAddress: () => undefined,
      message: {
        id: 3,
        recipient: "",
        reactions: {},
        reacted: [],
        client_id: "",
        kind: "text",
        author: "guest",
        body: "**жирный_текст** //наклонный_текст// --зачеркнутый_текст-- <b>обычный текст</b>",
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
  assert.equal(document.querySelector("strong")?.textContent, "жирный_текст")
  assert.equal(document.querySelector("em")?.textContent, "наклонный_текст")
  assert.equal(document.querySelector("s")?.textContent, "зачеркнутый_текст")
  assert.equal(document.querySelector("b"), null)
  assert.ok(document.querySelector(".chat-message-body")?.textContent.includes("<b>обычный текст</b>"))
})

test("highlights an addressed nickname in the middle of compact and framed messages", () => {
  const message = {
    id: 2,
    recipient: "",
    reactions: {},
    reacted: [],
    client_id: "",
    kind: "text" as const,
    author: "guest",
    body: "Слушай, Друг давай созвонимся",
    sent_at: "2026-09-22T10:20:30Z",
    font_id: "theme" as const,
    font_style: "normal" as const,
    appearance: {
      dark: { nickname_color: "#fcd34d", text_color: "#e4e4e7" },
      light: { nickname_color: "#9a3412", text_color: "#1f2937" },
    },
  }
  const peers = [
    {
      bot: false,
      id: "friend-session",
      nickname: "Друг",
      status: "active" as const,
      registered: true,
      self: false,
      rank: null,
      preferences: defaultPreferences,
    },
  ]
  for (const frame of [true, false]) {
    const html = renderToStaticMarkup(
      createElement(MessageEntry, { message, nickname: "reader", onAddress: () => undefined, peers, frame }),
    )
    const recipient = new JSDOM(html).window.document.querySelector(".chat-message-recipient")
    assert.equal(recipient?.textContent, "Друг")
  }
})

test("private transport messages are included in the rendered feed", () => {
  const message = {
    id: -1,
    recipient: "reader",
    reactions: {},
    reacted: [],
    client_id: "private-delivery",
    kind: "private",
    author: "sender",
    body: "только для вас",
    sent_at: "2026-09-22T10:20:30Z",
    font_id: "theme" as const,
    font_style: "normal" as const,
    appearance: {
      dark: { nickname_color: "#fcd34d", text_color: "#e4e4e7" },
      light: { nickname_color: "#9a3412", text_color: "#1f2937" },
    },
  }
  const entries = feedTimeline([], [message])
  assert.equal(entries.length, 1)
  const [entry] = entries
  assert.ok(entry)
  assert.equal(entry.message.body, "только для вас")
  assert.equal(entry.delivery, "published")
})

test("an authoritative snapshot removes deleted history without dropping confirmed messages", () => {
  const message = {
    id: 7,
    recipient: "",
    reactions: {},
    reacted: [],
    client_id: "published-message",
    kind: "text" as const,
    author: "sender",
    body: "удалённое сообщение",
    sent_at: "2026-09-22T10:20:30Z",
    font_id: "theme" as const,
    font_style: "normal" as const,
    appearance: {
      dark: { nickname_color: "#fcd34d", text_color: "#e4e4e7" },
      light: { nickname_color: "#9a3412", text_color: "#1f2937" },
    },
  }
  const entries = publishTimeline(
    [
      { key: "client:published-message", message, delivery: "published" as const },
      {
        key: "client:awaiting-history",
        message: { ...message, id: 8, client_id: "awaiting-history" },
        delivery: "confirmed" as const,
      },
    ],
    [],
  )
  assert.deepEqual(
    entries.map((entry) => entry.key),
    ["client:awaiting-history"],
  )
})
