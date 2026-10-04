import { Node, mergeAttributes } from "@tiptap/react"
import { safeArticleImage } from "./articleText"

export const ArticleImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: "" }, alt: { default: "Иллюстрация" } }
  },
  parseHTML() {
    return [
      { tag: "img[src]", getAttrs: (element) => (safeArticleImage(element.getAttribute("src") ?? "") ? null : false) },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)]
  },
  markdownTokenName: "image",
  parseMarkdown(token, helpers) {
    if (typeof token.href !== "string" || !safeArticleImage(token.href)) return []
    return helpers.createNode("image", {
      src: token.href,
      alt: typeof token.text === "string" ? token.text : "Иллюстрация",
    })
  },
  renderMarkdown(node) {
    const src: unknown = node.attrs?.src
    const alt: unknown = node.attrs?.alt
    if (typeof src !== "string" || !safeArticleImage(src)) return ""
    const label = (typeof alt === "string" ? alt : "Иллюстрация").replace(/[\\[\]\r\n]/g, " ")
    return `![${label}](${src})`
  },
})
