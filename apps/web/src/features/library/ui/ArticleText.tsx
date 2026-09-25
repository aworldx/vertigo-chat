import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { isRichText, markdownBody, safeArticleLink } from "../model/articleText"

export function ArticleText({ body, compact = false }: { body: string; compact?: boolean }) {
  return (
    <div className={`library-prose ${compact ? "line-clamp-6" : ""}`}>
      {isRichText(body) ? (
        <Markdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          disallowedElements={["img"]}
          urlTransform={(url) => (safeArticleLink(url) ? url : "")}
          components={{
            a: ({ children, href }) =>
              href ? (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ) : (
                <span>{children}</span>
              ),
          }}
        >
          {markdownBody(body)}
        </Markdown>
      ) : (
        <p className="whitespace-pre-wrap">{body}</p>
      )}
    </div>
  )
}
