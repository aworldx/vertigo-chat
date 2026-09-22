import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./browser",
  outputDir: "test-results",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4032",
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    colorScheme: "dark",
  },
  webServer: {
    command:
      "cd apps/phoenix && PORT=4032 YOUTUBE_WORKER_URL=http://127.0.0.1:4021 YOUTUBE_PROXY_BASE_URL=http://127.0.0.1:4021 mix phx.server",
    cwd: "../..",
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
