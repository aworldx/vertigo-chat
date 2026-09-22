import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import { cp, mkdir, rm } from "node:fs/promises"
import { execFileSync } from "node:child_process"

process.chdir(fileURLToPath(new URL("..", import.meta.url)))
await rm("dist", { recursive: true, force: true })
await mkdir("dist/assets", { recursive: true })
await build({ entryPoints: ["src/app/main.tsx"], bundle: true, minify: true, target: "es2022", outfile: "dist/assets/app.js", define: { "process.env.NODE_ENV": '"production"' } })
execFileSync(process.execPath, ["node_modules/@tailwindcss/cli/dist/index.mjs", "-i", "css/web.css", "-o", "dist/assets/app.css", "--minify"], { stdio: "inherit" })
await cp("public", "dist", { recursive: true })
await cp("index.html", "dist/index.html")
