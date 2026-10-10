import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { Articles } from "../src/features/articles"
const pages = [
  [
    "/articles",
    "Статьи об общении и устройстве чата",
    "Общие комнаты и мессенджеры, история IRC и веб-чатов, хранение сообщений в Vertigo: конкретные сценарии, проверенные факты и снимки интерфейса.",
  ],
  [
    "/articles/chats-vs-messengers",
    "Общая комната или мессенджер: куда идти с разговором",
    "Когда выбрать личную переписку, группу или общую комнату: примеры Vertigo и Telegram, онлайн-приват, офлайн-записки и возвращение к истории.",
  ],
  [
    "/articles/chat-platforms-russia",
    "От «Кроватки» и ICQ до Telegram: как менялись чаты",
    "IRC, «Кроватка», движок Бородина, ICQ, соцсети и Telegram: выборочная история чатов по документам и свидетельствам участников.",
  ],
  [
    "/articles/how-vertigo-chat-works",
    "Что Vertigo сохраняет: история, приват и офлайн-записки",
    "Три месяца публичной истории, онлайн-приват без архива и сохраняемые записки: как работают сообщения, фильтры истории и хранение паролей в Vertigo.",
  ],
] as const
const template = readFileSync("dist/index.html", "utf8")
mkdirSync("dist/pages", { recursive: true })
for (const [path, title, description] of pages) {
  const body = renderToStaticMarkup(<Articles path={path} />)
  const html = template
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`)
    .replace("<title>Vertigo chat</title>", `<title>${title} · Vertigo chat</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}" />`)
    .replace(
      '<meta name="robots" content="noindex, follow" />',
      `<meta name="robots" content="index, follow" /><link rel="canonical" href="__SITE_ORIGIN__${path}" /><meta property="og:title" content="${title}" /><meta property="og:description" content="${description}" /><meta property="og:type" content="${path === "/articles" ? "website" : "article"}" /><meta property="og:url" content="__SITE_ORIGIN__${path}" />`,
    )
  writeFileSync(`dist/pages/${path.slice(1).replaceAll("/", "-")}.html`, html)
}
