import assert from "node:assert/strict"
import { test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ArticleText } from "../src/features/library/ui/ArticleText"
import { initialArticleContent, richTextPrefix, safeArticleLink } from "../src/features/library/model/articleText"
import { articleCover } from "../src/features/library/model/articleCover"

test("decorative article covers are stable across filtering and have a safe fallback", () => {
  assert.equal(articleCover(1), "/images/library-cover-books.png")
  assert.equal(articleCover(2), "/images/library-cover-path.png")
  assert.equal(articleCover(3), "/images/library-cover-window.png")
  assert.equal(articleCover(4), articleCover(1))
  assert.equal(articleCover(1, "/images/otrada-project.png"), "/images/otrada-project.png")
  for (const image of [
    "https://evil.example/a.png",
    "//evil.example/a.png",
    "/images/../secret.png",
    "javascript:alert(1)",
  ])
    assert.equal(articleCover(1, image), articleCover(1))
  for (const id of [0, -1, NaN, Infinity, 1.5]) assert.equal(articleCover(id), articleCover(1))
})

test("legacy article text stays literal, including Markdown and HTML", () => {
  const body = "## Старый заголовок\n**звёздочки** <script>alert(1)</script>"
  const html = renderToStaticMarkup(<ArticleText body={body} />)
  assert.ok(html.includes("## Старый заголовок"))
  assert.ok(html.includes("**звёздочки**"))
  assert.ok(!html.includes("<script>"))
  assert.deepEqual(initialArticleContent("строка\n\nещё"), {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "строка" }] },
      { type: "paragraph" },
      { type: "paragraph", content: [{ type: "text", text: "ещё" }] },
    ],
  })
})
test("formatted articles render structure while rejecting raw HTML and unsafe links", () => {
  const markdown =
    "## Глава\n\n**важно** и *курсив* и ~~было~~\n\n- пункт\n\n> цитата\n\n[сайт](https://example.com)\n\n[опасно](javascript:alert)\n\n<script>alert(1)</script>\n\n![трекер](https://example.com/x.png)"
  const html = renderToStaticMarkup(<ArticleText body={richTextPrefix + markdown} compact />)
  for (const fragment of ["<h2>", "<strong>", "<em>", "<del>", "<ul>", "<blockquote>", 'rel="noopener noreferrer"'])
    assert.ok(html.includes(fragment), fragment)
  for (const fragment of ["<script", "javascript:", "<img"]) assert.ok(!html.includes(fragment), fragment)
  assert.equal(initialArticleContent(richTextPrefix + markdown), markdown)
})
test("article links accept only complete http addresses without credentials", () => {
  for (const url of ["https://example.com/path?q=1", "http://example.com"]) assert.ok(safeArticleLink(url))
  for (const url of ["", "/local", "javascript:alert(1)", "data:text/html,hi", "https://user:pass@example.com"])
    assert.equal(safeArticleLink(url), false)
})

test("uploaded images render only on local safe media paths, never in compact excerpts", () => {
  const body =
    richTextPrefix +
    "![Описание](/library/images/12)\n\n![outside](https://tracker.example/image.png)\n\n![script](data:image/svg+xml,x)"
  const html = renderToStaticMarkup(<ArticleText body={body} />)
  assert.ok(html.includes('src="/library/images/12"'))
  assert.ok(html.includes('alt="Описание"'))
  assert.equal((html.match(/<img/g) ?? []).length, 1)
  assert.ok(!renderToStaticMarkup(<ArticleText body={body} compact />).includes("<img"))
  assert.equal(articleCover(1, "/library/images/12"), "/library/images/12")
})
