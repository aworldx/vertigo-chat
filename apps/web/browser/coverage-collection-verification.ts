import assert from "node:assert/strict"
import { createServer } from "node:http"
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Page } from "@playwright/test"
import { launchBrowser } from "./coverage"

type Entry = Awaited<ReturnType<Page["coverage"]["stopJSCoverage"]>>[number]
const directory = await mkdtemp(join(tmpdir(), "chat-coverage-collection-"))
process.env.WEB_COVERAGE_DIR = directory
let document = 0
const server = createServer((request, response) => {
  if (request.url === "/assets/app.js") {
    response.setHeader("Content-Type", "application/javascript")
    response.setHeader("Cache-Control", "no-store")
    const name = `document${String(document)}`
    response.end(`function ${name}(){document.title="covered"} ${name}();`)
  } else if (/^\/document\/\d+$/u.test(request.url ?? "")) {
    document = Number(request.url?.split("/").at(-1))
    response.end('<script src="/assets/app.js"></script>')
  } else {
    response.writeHead(204).end()
  }
})
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
try {
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  const browser = await launchBrowser({ headless: true })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    const session = await context.newCDPSession(page)
    const names = []
    for (let index = 1; index <= 8; index++) {
      names.push(`document${String(index)}`)
      await page.goto(`http://127.0.0.1:${String(address.port)}/document/${String(index)}`)
      await session.send("HeapProfiler.collectGarbage")
    }
    await session.detach()
    await context.close()
    const entries: Entry[] = []
    for (const file of await readdir(directory))
      entries.push(...(JSON.parse(await readFile(join(directory, file), "utf8")) as Entry[]))
    for (const name of names)
      assert.ok(
        entries.some((entry) =>
          entry.functions.some((fn) => fn.functionName === name && fn.ranges.some((range) => range.count > 0)),
        ),
        `Executed coverage of ${name} must survive navigation and garbage collection`,
      )
    console.log("Chromium coverage survives navigation, garbage collection and close")
  } finally {
    await browser.close()
  }
} finally {
  server.closeAllConnections()
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve()
    }),
  )
  await rm(directory, { recursive: true, force: true })
}
