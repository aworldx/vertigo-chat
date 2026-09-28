import Markdown from "react-markdown"
import type { HelpInstruction } from "../chatHelp"

export function HelpContent({ instruction }: { instruction: HelpInstruction }) {
  return (
    <div className="chat-help-content">
      <Markdown skipHtml>{instruction.body}</Markdown>
      {instruction.more && (
        <details className="chat-help-more">
          <summary>{instruction.more.title}</summary>
          <Markdown skipHtml>{instruction.more.body}</Markdown>
        </details>
      )}
    </div>
  )
}
