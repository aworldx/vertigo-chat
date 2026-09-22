import { expect, test } from "@playwright/test"

const viewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const

type Rect = {
  height: number
  width: number
  x: number
  y: number
}

type Layout = {
  card: Rect
  grid: Rect
  page: Rect
  scrollWidth: number
}

async function captureLayout(page: import("@playwright/test").Page): Promise<Layout> {
  await expect(page.locator("#profiles button").first()).toBeVisible()

  return page.locator("#profiles-page").evaluate<Layout>(() => {
    const rect = (selector: string): Rect | undefined => {
      const box = document.querySelector(selector)?.getBoundingClientRect()
      return box && { height: box.height, width: box.width, x: box.x, y: box.y }
    }

    const page = rect("#profiles-content, #profiles-page > main")
    const grid = rect("#profiles")
    const card = rect("#profiles button")

    if (!page || !grid || !card) throw new Error("Profiles layout did not render")

    return { page, grid, card, scrollWidth: document.documentElement.scrollWidth }
  })
}

test.beforeAll(async ({ request }) => {
  await expect
    .poll(
      async () => {
        try {
          return (await request.get("/health")).status()
        } catch {
          return 0
        }
      },
      { timeout: 30_000 },
    )
    .toBe(200)
})

for (const viewport of viewports) {
  test(`profiles LiveView and React match at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)

    await page.goto("/profiles/live")
    const live = await captureLayout(page)
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-live.png`) })

    await page.goto("/profiles/react")
    const react = await captureLayout(page)
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-react.png`) })

    expect(react).toEqual(live)
    expect(react.scrollWidth).toBe(viewport.width)
  })
}
