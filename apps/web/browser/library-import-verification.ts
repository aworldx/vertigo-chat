import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { expect, type Page } from "@playwright/test"

type ImportedPart = { part: number; title: string; body: string; source_anchor: string }
type Source = { series: string; source: string; parts: ImportedPart[] }

export async function verifyLibraryImport(page: Page, origin: string, database: string) {
  assert.match(new URL(database).pathname, /^\/chat_coverage_web_[ab]_\d+$/)
  const source = JSON.parse(readFileSync("../../docs/imports/uniform-otrada/source.json", "utf8")) as Source
  const sql = execFileSync("node", ["../../script/import-library-otrada.mjs", "fixture03"], { encoding: "utf8" })
  const query = (command: string) =>
    execFileSync("psql", [database, "-v", "ON_ERROR_STOP=1", "-At", "-c", command], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()
  const apply = () =>
    execFileSync("psql", [database, "-v", "ON_ERROR_STOP=1", "-q"], {
      input: sql,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    })
  apply()
  const snapshotSQL =
    "SELECT json_agg(a ORDER BY a.part_number) FROM library_articles a WHERE work_author='Uniform' AND user_id=(SELECT id FROM registered_users WHERE nickname='fixture03')"
  const before = query(snapshotSQL)
  apply()
  assert.equal(query(snapshotSQL), before, "Repeated import must be a no-op")
  const rows = JSON.parse(before) as {
    id: number
    part_number: number
    title: string
    body: string
    source_url: string
  }[]
  assert.equal(rows.length, 9)
  for (const [index, row] of rows.entries()) {
    const original = source.parts[index]
    assert.ok(original)
    assert.equal(row.part_number, original.part)
    assert.equal(row.title, original.title)
    assert.equal(row.body, original.body, "Source text must remain byte-identical")
    assert.equal(row.source_url, `${source.source}#${original.source_anchor}`)
  }
  const first = rows[0]
  assert.ok(first)
  query(`UPDATE library_articles SET title='Import conflict sentinel' WHERE id=${String(first.id)}`)
  assert.throws(apply, /Existing Otrada content differs/)
  assert.equal(query(`SELECT title FROM library_articles WHERE id=${String(first.id)}`), "Import conflict sentinel")
  query(`UPDATE library_articles SET title='${first.title.replaceAll("'", "''")}' WHERE id=${String(first.id)}`)
  const publisher = query("SELECT id FROM registered_users WHERE nickname='fixture03'")
  const url = `${origin}/library?${new URLSearchParams({ author: publisher, series: source.series }).toString()}`
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(url)
    await expect(page.locator("#library-articles article")).toHaveCount(9)
    for (const [index, row] of rows.entries()) {
      const article = page.locator(`#articles-${String(row.id)}`)
      await expect(page.locator("#library-articles article").nth(index)).toHaveAttribute(
        "id",
        `articles-${String(row.id)}`,
      )
      await expect(article.locator(".library-card-meta")).toContainText("Автор: Uniform")
      await expect(article.locator(".library-card-meta")).toContainText("Опубликовал: fixture03")
      await expect(article.getByRole("button", { name: /Редактировать/ })).toHaveCount(0)
      const image = article.locator("img")
      await expect(image).toHaveAttribute("src", /^\/images\/otrada-/)
      expect(await image.evaluate((e) => e instanceof HTMLImageElement && e.complete && e.naturalWidth > 0)).toBe(true)
    }
    await page.locator(`#read-article-${String(first.id)}`).click()
    await expect(page.locator(`#article-text-${String(first.id)} .library-prose`)).toHaveText(first.body)
    await expect(page.getByRole("link", { name: "Источник публикации" })).toHaveAttribute(
      "href",
      `${source.source}#mps_m_97`,
    )
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    await page.mouse.move(0, 0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `migration-results/community/otrada-${String(width)}.png`, animations: "disabled" })
  }
  await page.goto(`${origin}/account/login`)
  await page.locator("#react-account-nickname").fill("fixture03")
  await page.locator("#react-account-password").fill("secret123")
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/v1/auth/login") && response.status() === 200),
    page.locator("#react-account-submit").click(),
  ])
  await page.waitForURL((current) => current.pathname !== "/account/login")
  await page.goto(url)
  await page.locator(`#edit-article-${String(first.id)}`).click()
  await expect(page.locator("#article_work_author")).toHaveValue("Uniform")
  await page.locator("#cancel-library-editor").click()
  console.log(
    "Otrada import: 9 exact parts, author/publisher, idempotency, conflict rejection, covers and source verified",
  )
}
