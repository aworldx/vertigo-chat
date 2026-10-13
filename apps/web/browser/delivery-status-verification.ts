import assert from "node:assert/strict"
import { expect, type Browser, type WebSocketRoute } from "@playwright/test"

export async function verifyDeliveryStates(browser: Browser, origin: string) {
  const nonce = Date.now().toString(36)
  const deliveryBody = `Этапы доставки ${nonce}`
  const blockedBody = `Отклонено лимитом ${nonce}`
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
        if (value.body === deliveryBody) {
          releaseSend = () => {
            server.send(raw)
          }
          return
        }
        if (value.body === blockedBody && "client_id" in value) {
          blockedSends++
          socket.send(JSON.stringify({ type: "error", code: "rate_limited", client_id: value.client_id }))
          return
        }
      }
      server.send(raw)
    })
    server.onMessage((raw) => {
      if (typeof raw === "string" && raw.includes(deliveryBody) && publicationHeld) {
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
  await page.locator("#entrance-nickname").fill(`delivery-${nonce}`)
  await page.locator("#enter-chat").click()
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
  await page.locator("#message-body").fill(deliveryBody)
  await page.locator("#send-message").click()
  const card = page.locator("#messages > [data-client-id]").filter({ hasText: deliveryBody })
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
  await expect(pending).toHaveClass(/text-zinc-500/)
  await expect.poll(() => !!releaseHistory).toBe(true)
  assert.ok(releaseHistory)
  releaseHistory()
  await expect(card).toBeAttached()
  await expect(pending).toHaveAttribute("data-delivery-state", "published")
  const published = page.locator('[data-message-kind="text"]').filter({ hasText: deliveryBody })
  await expect(published).toContainText("✓✓")
  await expect(published.locator(".text-sky-400")).toBeVisible()
  await page.locator("#message-body").fill(blockedBody)
  await page.locator("#send-message").click()
  const blocked = page.locator("#messages > [data-client-id]").filter({ hasText: blockedBody })
  await expect(blocked.locator("[data-delivery-state]")).toHaveAttribute("data-delivery-state", "blocked")
  await page.reload()
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
  await expect(blocked.locator("[data-delivery-state]")).toHaveAttribute("data-delivery-state", "blocked")
  assert.equal(blockedSends, 1, "rate-limited message was automatically resent")
  await page.locator("#leave-chat").click()
  await expect(page).toHaveURL(`${origin}/`)
  await context.close()
}
