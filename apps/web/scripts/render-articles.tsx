import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { Articles } from "../src/features/articles"
const pages = [
  [
    "/articles",
    "Статьи об общении в интернете",
    "Наблюдения и честные разговоры о чатах, сообществах и том, как мы общаемся в сети.",
  ],
  [
    "/articles/chats-vs-messengers",
    "Зачем нужны чаты, когда есть Telegram и соцсети",
    "Чем живой общий чат отличается от мессенджеров и соцсетей: преимущества, слабые места и место для настоящего разговора.",
  ],
  [
    "/articles/chat-platforms-russia",
    "От «Кроватки» до Telegram: как менялись чаты в России",
    "История чатов в Рунете: IRC, «Кроватка», движки Бородина и Августа, ICQ, соцсети и современные мессенджеры.",
  ],
  [
    "/articles/how-vertigo-chat-works",
    "Как устроен Vertigo: сообщения, приват и пароли",
    "Какие технологии работают в чате Vertigo, где хранится публичная история, почему личные сообщения не сохраняются и как защищаются пароли.",
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
