import assert from "node:assert/strict"
import { expect, type Browser, type WebSocketRoute } from "@playwright/test"

export async function verifyDeliveryStates(browser: Browser, origin: string) {
  const context = await browser.newContext()
  let releaseSend: (() => void) | undefined
  let releaseAck: (() => void) | undefined
  let releaseHistory: (() => void) | undefined
  let publicationHeld = true
  let blockedSends = 0
  await context.routeWebSocket("**/api/v1/chat/socket", (socket: WebSocketRoute) => {
    const server = socket.connectToServer()
    socket.onMessage((raw) => {
      if (typeof raw !== "string") {
        server.send(raw)
        return
      }
      const value: unknown = JSON.parse(raw)
      if (typeof value === "object" && value !== null && "type" in value && value.type === "send" && "body" in value) {
        if (value.body === "Этапы доставки") {
          releaseSend = () => {
            server.send(raw)
          }
          return
        }
        if (value.body === "Отклонено лимитом" && "client_id" in value) {
          blockedSends++
          socket.send(JSON.stringify({ type: "error", code: "rate_limited", client_id: value.client_id }))
          return
        }
      }
      server.send(raw)
    })
    server.onMessage((raw) => {
      if (typeof raw === "string" && raw.includes("Этапы доставки") && publicationHeld) {
        const value: unknown = JSON.parse(raw)
        if (typeof value === "object" && value !== null && "type" in value) {
          if (value.type === "ack") {
            releaseAck = () => {
              socket.send(raw)
            }
            return
          }
          if (value.type === "snapshot") {
            releaseHistory = () => {
              publicationHeld = false
              socket.send(raw)
            }
            return
          }
        }
      }
      socket.send(raw)
    })
  })
  const page = await context.newPage()
  await page.goto(origin)
  await page.locator("#entrance-nickname").fill("delivery-states")
  await page.locator("#enter-chat").click()
  await expect(page.locator("#chat-connection-status")).toContainText("В чате")
  await page.locator("#message-body").fill("Этапы доставки")
  await page.locator("#send-message").click()
  const card = page.locator("#messages > [data-client-id]").filter({ hasText: "Этапы доставки" })
  const pending = card.locator("[data-delivery-state]")
  await expect(pending).toHaveAttribute("data-delivery-state", "sending")
  await expect(pending.locator('[aria-hidden="true"]')).toHaveText("✓")
  await expect.poll(() => !!releaseSend).toBe(true)
  assert.ok(releaseSend)
  releaseSend()
  await expect.poll(() => !!releaseAck).toBe(true)
  assert.ok(releaseAck)
  releaseAck()
  await expect(pending).toHaveAttribute("data-delivery-state", "confirmed")
  await expect(pending.locator('[aria-hidden="true"]')).toHaveText("✓✓")
  await expect(pending.locator('[aria-hidden="true"]')).toHaveClass(/text-zinc-500/)
  await expect.poll(() => !!releaseHistory).toBe(true)
  assert.ok(releaseHistory)
  releaseHistory()
  await expect(card).toBeAttached()
  await expect(pending).toHaveAttribute("data-delivery-state", "published")
  const published = page.locator('[data-message-kind="text"]').filter({ hasText: "Этапы доставки" })
  await expect(published).toContainText("✓✓")
  await expect(published.locator(".text-sky-400")).toBeVisible()
  await page.locator("#message-body").fill("Отклонено лимитом")
  await page.locator("#send-message").click()
  const blocked = page.locator("#messages > [data-client-id]").filter({ hasText: "Отклонено лимитом" })
  await expect(blocked.locator("[data-delivery-state]")).toHaveAttribute("data-delivery-state", "blocked")
  await page.reload()
  await expect(page.locator("#chat-connection-status")).toContainText("В чате")
  await expect(blocked.locator("[data-delivery-state]")).toHaveAttribute("data-delivery-state", "blocked")
  assert.equal(blockedSends, 1, "rate-limited message was automatically resent")
  await page.locator("#leave-chat").click()
  await expect(page).toHaveURL(`${origin}/`)
  await context.close()
}
