import type { ComponentProps, ReactNode } from "react"
import { Button } from "../../../shared/ui/Button"
import { Icon } from "../../../shared/ui/Icon"

type ToolCardProps = Omit<ComponentProps<"section">, "title"> & {
  title: ReactNode
  description: string
  actions?: ReactNode
}

// Shared presentation only: callers own visibility, requests and domain actions.
export function ToolCard({ title, description, actions, children, className = "", ...props }: ToolCardProps) {
  return (
    <section {...props} className={`chat-tool-card ${className}`}>
      <header className="chat-tool-heading">
        <div className="chat-tool-heading-copy">
          <p className="chat-tool-title">{title}</p>
          <p className="chat-tool-description">{description}</p>
        </div>
        {actions && <div className="chat-tool-heading-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export function DismissTool({ id, label, onClick }: { id: string; label: string; onClick: () => void }) {
  return (
    <Button id={id} variant="quiet" className="ui-icon-button" aria-label={label} title={label} onClick={onClick}>
      <Icon name="x-mark" className="size-4" />
    </Button>
  )
}
