import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { isRichText, markdownBody, safeArticleLink, safeArticleImage } from "../model/articleText"

export function ArticleText({ body, compact = false }: { body: string; compact?: boolean }) {
  return (
    <div className={`library-prose ${compact ? "line-clamp-6" : ""}`}>
      {isRichText(body) ? (
        <Markdown
          remarkPlugins={[remarkGfm]}
          skipHtml

          urlTransform={(url, key) => ((key === "src" ? safeArticleImage(url) : safeArticleLink(url)) ? url : "")}
          components={{
            img: ({ src, alt }) =>
              !compact && typeof src === "string" && safeArticleImage(src) ? (
                <img src={src} alt={alt ?? "Иллюстрация"} loading="lazy" />
              ) : null,
            p: ({ children }) => (compact ? <>{children} </> : <p>{children}</p>),
            br: () => (compact ? <> </> : <br />),
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
