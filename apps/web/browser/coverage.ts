import { mkdir, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { chromium, type Page } from "@playwright/test"
type JSCoverageEntry = Awaited<ReturnType<Page["coverage"]["stopJSCoverage"]>>[number]
type PreciseCoverage = { result: (Pick<JSCoverageEntry, "url" | "functions"> & { scriptId: string })[] }

// Collect before close, including every document visited by a page. Coverage
// builds carry source maps; normal browser verification uses the production build.
export async function launchBrowser(options: Parameters<typeof chromium.launch>[0]) {
  const browser = await chromium.launch(options)
  const directory = process.env.WEB_COVERAGE_DIR
  if (!directory) return browser
  await mkdir(directory, { recursive: true })
  const pending = new Map<Page, () => Promise<void>>()
  const newContext = browser.newContext.bind(browser)
  browser.newContext = async (contextOptions) => {
    const context = await newContext(contextOptions)
    if (contextOptions?.javaScriptEnabled === false) return context
    const newPage = context.newPage.bind(context)
    context.newPage = async () => {
      const page = await newPage()
      const session = await context.newCDPSession(page)
      const sources = new Map<string, Promise<string>>()
      const writes: Promise<void>[] = []
      const failures: unknown[] = []
      session.on("Debugger.scriptParsed", (script: { scriptId: string; url: string }) => {
        if (!script.url.endsWith("/assets/app.js")) return
        const source = session
          .send("Debugger.getScriptSource", { scriptId: script.scriptId })
          .then((result: unknown) => {
            if (
              typeof result !== "object" ||
              result === null ||
              !("scriptSource" in result) ||
              typeof result.scriptSource !== "string"
            )
              throw new Error("Chromium did not return a script source")
            return result.scriptSource
          })
        sources.set(script.scriptId, source)
        void source.catch((error: unknown) => {
          failures.push(error)
        })
      })
      const save = async (coverage: PreciseCoverage) => {
        const entries = []
        for (const script of coverage.result) {
          const source = sources.get(script.scriptId)
          if (source) entries.push({ url: script.url, source: await source, functions: script.functions })
        }
        if (entries.length) await writeFile(`${directory}/${randomUUID()}.json`, JSON.stringify(entries))
      }
      session.on("Profiler.preciseCoverageDeltaUpdate", (coverage: PreciseCoverage) => {
        writes.push(
          save(coverage).catch((error: unknown) => {
            failures.push(error)
          }),
        )
      })
      await session.send("Debugger.enable")
      await session.send("Debugger.setSkipAllPauses", { skip: false })
      session.on("Debugger.paused", () => {
        writes.push(
          (async () => {
            try {
              await save(await session.send("Profiler.takePreciseCoverage"))
            } catch (error) {
              failures.push(error)
            } finally {
              await session.send("Debugger.resume")
            }
          })(),
        )
      })
      // Pause at beforeunload so V8 cannot dispose the document during capture.
      // This instrumentation exists only in coverage runs, never in app assets.
      await page.addInitScript("addEventListener('beforeunload', () => { debugger; })")
      await session.send("Profiler.enable")
      // Chromium pushes deltas when a document goes away; retain them before GC.
      await session.send("Profiler.startPreciseCoverage", {
        callCount: true,
        detailed: true,
        allowTriggeredUpdates: true,
      })
      const flush = async () => {
        if (!pending.delete(page)) return
        await save(await session.send("Profiler.takePreciseCoverage"))
        await session.send("Profiler.stopPreciseCoverage")
        await Promise.all(writes)
        await session.detach()
        if (failures.length) throw new AggregateError(failures, "Chromium coverage collection failed")
      }
      pending.set(page, flush)
      const close = page.close.bind(page)
      page.close = async (closeOptions) => {
        await flush()
        await close(closeOptions)
      }
      return page
    }
    const close = context.close.bind(context)
    context.close = async (closeOptions) => {
      for (const page of context.pages()) await pending.get(page)?.()
      await close(closeOptions)
    }
    return context
  }
  const close = browser.close.bind(browser)
  browser.close = async (closeOptions) => {
    for (const flush of pending.values()) await flush()
    await close(closeOptions)
  }
  return browser
}
