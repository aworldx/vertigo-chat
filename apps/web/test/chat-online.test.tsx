import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"
import { JSDOM } from "jsdom"
import { defaultPreferences } from "../src/features/chat/api/preferences"
import { decodeFrame, type Peer } from "../src/features/chat/api/protocol"

const dom = new JSDOM("<!doctype html><html><body></body></html>")
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
})
// JSDOM has no audio playback backend; this test exercises presence, not media.
mock.method(dom.window.HTMLMediaElement.prototype, "pause", () => undefined)
const React = (await import("react")).default
const { render, fireEvent, cleanup } = await import("@testing-library/react")
const { OnlineList } = await import("../src/features/chat/ui/OnlineList")
const { Composer } = await import("../src/features/chat/ui/Composer")
afterEach(cleanup)
const guest: Peer = {
  bot: false,
  preferences: defaultPreferences,
  rank: null,
  id: "guest-session",
  nickname: "Гость",
  status: "active",
  registered: false,
  self: true,
}

test("presence boundary requires server classification and rejects unknown states", () => {
  const decode = (patch: object) =>
    decodeFrame(
      JSON.stringify({
        type: "snapshot",
        snapshot: {
          preferences: defaultPreferences,
          admin: false,
          typing: [],
          messages: [],
          peers: [{ ...guest, ...patch }],
        },
      }),
    )
  assert.equal(decode({})?.type, "snapshot")
  for (const patch of [{ registered: undefined }, { self: "true" }, { status: "ended" }])
    assert.equal(decode(patch), null)
})

test("presence is exclusive, local disconnect affects only self, reconnect retains rows and addressing", () => {
  const addresses: string[] = []
  const peers: Peer[] = [guest, { ...guest, id: "member-session", nickname: "Участник", registered: true, self: false }]
  const props = {
    peers,
    onAddress: (name: string) => {
      addresses.push(name)
    },
  }
  const view = render(<OnlineList {...props} reconnecting={false} />)
  const row = document.getElementById("online-row-guest-session")
  assert.ok(row)
  fireEvent.click(view.getByRole("button", { name: "Гость" }))
  assert.deepEqual(addresses, ["Гость"])
  view.rerender(<OnlineList {...props} reconnecting />)
  assert.equal(document.getElementById("online-row-guest-session"), row)
  assert.equal(document.getElementById("current-chatlan-online"), null)
  assert.ok(document.getElementById("current-chatlan-reconnecting"))
  assert.equal(view.queryByRole("button", { name: "Гость" }), null)
  assert.ok(view.getByRole("button", { name: "Участник" }))
  view.rerender(<OnlineList {...props} reconnecting={false} />)
  assert.equal(document.getElementById("current-chatlan-reconnecting"), null)
  assert.ok(document.getElementById("current-chatlan-online"))
  view.rerender(<OnlineList {...props} peers={[guest]} reconnecting={false} />)
  assert.equal(document.getElementById("online-count")?.textContent, "1")
  assert.equal(document.getElementById("online-row-member-session"), null)
})

test("dropping a file on the composer starts attachment delivery", () => {
  const attached: File[] = []
  const view = render(
    <Composer
      draft=""
      onDraft={() => undefined}
      input={React.createRef<HTMLInputElement>()}
      onSend={() => undefined}
      onLeave={() => undefined}
      registered
      error=""
      emojis={[]}
      emojiError=""
      onEmojiRetry={() => undefined}
      onUploadEmoji={() => undefined}
      onAttach={() => undefined}
      onAttachFile={(file) => {
        attached.push(file)
      }}
    />,
  )
  const file = new dom.window.File(["image"], "photo.png", { type: "image/png" })
  const form = view.container.querySelector("#message-form")
  assert.ok(form)
  fireEvent.dragEnter(form, { dataTransfer: { types: ["Files"], files: [file] } })
  assert.ok(view.container.querySelector("#attachment-drop-target"))
  fireEvent.drop(form, { dataTransfer: { types: ["Files"], files: [file] } })
  assert.deepEqual(attached, [file])
  assert.equal(view.container.querySelector("#attachment-drop-target"), null)
})
