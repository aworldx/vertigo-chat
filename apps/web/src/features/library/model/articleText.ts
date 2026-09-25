import type { JSONContent } from "@tiptap/react"

export const richTextPrefix = "<!-- vertigo:markdown -->\n"
export const articleBodyLimit = 12000
export function isRichText(body: string): boolean {
  return body.startsWith(richTextPrefix)
}
export function markdownBody(body: string): string {
  return body.slice(richTextPrefix.length)
}
export function initialArticleContent(body: string): string | JSONContent {
  if (isRichText(body)) return markdownBody(body)
  return {
    type: "doc",
    content: body.split("\n").map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  }
}
export function safeArticleLink(value: string): boolean {
  try {
    const url = new URL(value)
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}
