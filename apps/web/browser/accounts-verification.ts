import assert from "node:assert/strict"
import { chromium, type Page } from "@playwright/test"
import type { components } from "../src/shared/generated/accounts"

const origin = process.argv[2]
assert.ok(origin)
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext()
  const tab = await context.newPage()
  await tab.goto(`${origin}/health`)
  const call = async (page: Page, path: string, body?: Record<string, unknown>, csrf?: string) =>
    page.evaluate(
      async ({ path, body, csrf }) => {
        const response = await fetch(`/api/v1/auth/${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
        const payload: unknown = response.status === 204 ? null : await response.json()
        return { status: response.status, body: payload }
      },
      { path, body, csrf },
    )
  const anonymous = await call(tab, "session")
  assert.equal(anonymous.status, 200)
  assert.equal(session(anonymous.body).data.principal, null)
  const csrf = session(anonymous.body).data.csrf_token
  const account = { nickname: "браузер", password: "secret123" }
  assert.equal((await call(tab, "register", account)).status, 403)
  const registered = await call(tab, "register", account, csrf)
  assert.equal(registered.status, 200)
  assert.deepEqual(session(registered.body).data.principal?.roles, ["admin", "emoji_moderator"])
  assert.equal(await tab.evaluate(() => document.cookie.includes("chat_account")), false)
  const cookie = (await context.cookies()).find((item) => item.name === "chat_account")
  assert.ok(cookie?.httpOnly)
  assert.equal(cookie.sameSite, "Lax")
  const second = await context.newPage()
  await second.goto(`${origin}/health`)
  assert.equal(session((await call(second, "session")).body).data.principal?.nickname, account.nickname)
  await tab.evaluate(() => {
    sessionStorage.setItem("chat-session-proof", "independent-tab-state")
  })
  assert.equal((await call(second, "logout", {}, session(registered.body).data.csrf_token)).status, 204)
  assert.equal(session((await call(tab, "session")).body).data.principal, null)
  assert.equal(await tab.evaluate(() => sessionStorage.getItem("chat-session-proof")), "independent-tab-state")
  const fresh = await call(tab, "session")
  assert.equal(
    (await call(tab, "login", { ...account, password: "wrong" }, session(fresh.body).data.csrf_token)).status,
    401,
  )
  const login = await call(tab, "login", account, session(fresh.body).data.csrf_token)
  assert.equal(login.status, 200)
  assert.equal(session((await call(second, "session")).body).data.principal?.nickname, account.nickname)
  assert.equal(
    (await call(tab, "register", { nickname: "другой", password: "secret123" }, session(login.body).data.csrf_token))
      .status,
    429,
  )
  await tab.reload()
  assert.equal(session((await call(tab, "session")).body).data.principal?.nickname, account.nickname)
  console.log(
    "Go Accounts browser: registration, cookie/CSRF, login, reload, two-tab logout and independent chat storage passed",
  )
  await context.close()
} finally {
  await browser.close()
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function session(value: unknown): components["schemas"]["Session"] {
  assert.ok(record(value) && record(value.data))
  const { csrf_token, principal } = value.data
  assert.equal(typeof csrf_token, "string")
  assert.ok(typeof csrf_token === "string")
  if (principal === null) return { data: { csrf_token, principal: null } }
  assert.ok(record(principal))
  const { user_id, nickname, roles } = principal
  assert.ok(typeof user_id === "number" && typeof nickname === "string")
  assert.ok(Array.isArray(roles))
  const parsedRoles = roles.map((role: unknown) => {
    assert.ok(role === "admin" || role === "emoji_moderator")
    return role
  })
  return { data: { csrf_token, principal: { user_id, nickname, roles: parsedRoles } } }
}
