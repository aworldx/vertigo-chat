#!/usr/bin/env node

import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { chromium } from "../apps/web/node_modules/playwright/index.mjs"

const [baseURL, nickname, password, markerPath, fixturePath] = process.argv.slice(2)
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(8_000)
  await page.goto(`${baseURL}/profiles`)
  const csrf = await page.locator('meta[name="csrf-token"]').getAttribute("content")
  assert.ok(csrf)
  await Promise.all([
    page.waitForURL("**/library"),
    page.evaluate(({ csrf, nickname, password }) => {
      const form = document.createElement("form")
      form.method = "post"
      form.action = "/account/login"
      for (const [name, value] of Object.entries({ _csrf_token: csrf, "account[nickname]": nickname, "account[password]": password })) {
        const input = document.createElement("input")
        input.name = name
        input.value = value
        form.append(input)
      }
      document.body.append(form)
      form.submit()
    }, { csrf, nickname, password }),
  ])
  await page.goto(`${baseURL}/profiles`)
  const editor = page.locator("#account-profile-editor")
  await editor.waitFor()
  await editor.locator("input").first().fill("Go browser profile")
  await editor.locator("textarea").fill("Saved through React and Go")
  await editor.locator("button").click()
  await editor.getByText("Анкета сохранена.").waitFor()
  await editor.locator('input[type="file"]').setInputFiles({
    name: "profile.png",
    mimeType: "image/png",
    buffer: await readFile(fixturePath),
  })
  try {
    await editor.getByText("Фото обновлено.").waitFor()
  } catch {
    throw new Error(`Photo upload status: ${await editor.locator('[role="status"]').textContent()}`)
  }
  const photo = await page.request.get(`${baseURL}/profiles/${nickname}/photo`)
  assert.equal(photo.status(), 200)
  assert.match(photo.headers()["content-type"] ?? "", /^image\/png/)
  assert.deepEqual(await photo.body(), await readFile(fixturePath))
  const thumbnail = await page.request.get(`${baseURL}/profiles/${nickname}/photo/thumbnail`)
  assert.equal(thumbnail.status(), 200)
  assert.match(thumbnail.headers()["content-type"] ?? "", /^image\/webp/)
  await writeFile(markerPath, "React browser profile editor write path passed.\n")
  process.stdout.write("React browser profile editor write path passed.\n")
} finally {
  await browser.close()
}
