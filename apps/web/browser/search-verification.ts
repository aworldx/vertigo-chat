import { chromium, expect } from "@playwright/test"
const origin = process.argv[2] || "http://127.0.0.1:4097"
const browser = await chromium.launch({ headless: true, args: ["--disable-http2", "--disable-quic"] })
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  page.setDefaultNavigationTimeout(60000)
  const paths = [
    "/",
    "/library",
    "/help",
    "/articles",
    "/articles/chats-vs-messengers",
    "/articles/chat-platforms-russia",
    "/articles/how-vertigo-chat-works",
  ]
  for (const path of paths) {
    const response = await page.goto(origin + path, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow")
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", origin + path)
    await page.reload({ waitUntil: "domcontentloaded" })
    console.log("Indexed canonical:", path)
  }
  await page.goto(origin + "/about", { waitUntil: "domcontentloaded" })
  expect(page.url()).toBe(origin + "/")
  await expect(page.locator("h1")).toBeVisible()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  const sitemap = await context.request.get(origin + "/sitemap.xml")
  expect(sitemap.status()).toBe(200)
  const xml = await sitemap.text()
  for (const path of paths) expect(xml).toContain("<loc>" + origin + path + "</loc>")
  expect(xml.match(/<loc>/g)).toHaveLength(7)
  const robots = await context.request.get(origin + "/robots.txt")
  expect(await robots.text()).toContain("Sitemap: " + origin + "/sitemap.xml")
  await page.goto(origin + "/account/login", { waitUntil: "domcontentloaded" })
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow")
  console.log("PASS: 7 public routes and reload, about redirect, desktop/mobile, sitemap, robots, private noindex")
} finally {
  await browser.close()
}
