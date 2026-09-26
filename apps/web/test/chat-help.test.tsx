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
const { render, fireEvent, cleanup } = await import("@testing-library/react")
const { KarmikHelp } = await import("../src/features/chat/ui/KarmikHelp")
afterEach(cleanup)
test("Karmik instructions start collapsed, expand, open settings and dismiss", () => {
  let settings = 0
  const view = render(
    <KarmikHelp
      messageID={42}
      topics={["font", "music", "video"]}
      onSettings={() => {
        settings++
      }}
    />,
  )
  assert.equal(view.queryByText("Как поменять шрифт"), null)
  const toggle = view.getByRole("button", { name: "Раскрыть подробную инструкцию" })
  assert.equal(toggle.getAttribute("aria-expanded"), "false")
  fireEvent.click(toggle)
  assert.ok(view.getByText("Как поменять шрифт"))
  assert.ok(view.getByText("Как заказать музыку"))
  assert.ok(view.getByText("Как заказать видео"))
  fireEvent.click(view.getByRole("button", { name: "Открыть настройки" }))
  assert.equal(settings, 1)
  fireEvent.click(view.getByRole("button", { name: "Свернуть инструкцию" }))
  assert.equal(view.queryByText("Как заказать музыку"), null)
  fireEvent.click(view.getByRole("button", { name: "Скрыть подсказку Кармика" }))
  assert.equal(view.queryByLabelText("Подсказка Кармика"), null)
})

test("the public guide searches the same instructions used by Karmik", async () => {
  const { ChatGuide } = await import("../src/features/help/ui/ChatGuide")
  const { chatHelp } = await import("../src/shared/chatHelp")
  const view = render(<ChatGuide />)
  assert.equal(view.container.querySelectorAll("details").length, Object.keys(chatHelp).length)
  fireEvent.change(view.getByLabelText("Найти инструкцию"), { target: { value: "ютуб" } })
  assert.equal(view.container.querySelectorAll("details").length, 1)
  assert.ok(view.getByText(chatHelp.video.body))
  fireEvent.change(view.getByLabelText("Найти инструкцию"), { target: { value: "ничегонет123" } })
  assert.ok(view.getByRole("status"))
})

test("every server help topic and executable command has maintained documentation", async () => {
  const { readFileSync } = await import("node:fs")
  const { chatHelp } = await import("../src/shared/chatHelp")
  const { chatCommands } = await import("../src/shared/chatCommands")
  const recognizer = readFileSync(new URL("../../api/internal/karmik/domain/help.go", import.meta.url), "utf8")
  const topics = [...recognizer.matchAll(/\{"([a-z]+)", regexp\.MustCompile/gu)].map((match) => match[1])
  assert.deepEqual(topics.sort(), Object.keys(chatHelp).sort())
  const handler = readFileSync(new URL("../src/features/chat/model/useRoomCommands.ts", import.meta.url), "utf8")
  const handled = [...handler.matchAll(/case "(\/[^"]+)":/gu)].map((match) => match[1])
  assert.deepEqual(handled.sort(), chatCommands.map((command) => command.input.trim()).sort())
  for (const command of chatCommands) assert.ok(chatHelp[command.topic].body.includes(command.input.trim()))
})
