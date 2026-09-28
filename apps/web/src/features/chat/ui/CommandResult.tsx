import { Button } from "../../../shared/ui/Button"
import { DismissTool, ToolCard } from "./ToolCard"
import type { CommandResult as Result } from "../model/commands"
export function CommandResult({
  result,
  onAddress,
  onDismiss,
}: {
  result: Result
  onAddress: (nickname: string) => void
  onDismiss: () => void
}) {
  return (
    <div id={`command-${String(result.id)}`} className="chat-message-entry px-1 py-1" data-message-kind="command">
      <ToolCard
        data-command-result={result.command}
        title={result.title}
        description="Только ты видишь результат команды"
        actions={
          <DismissTool
            id={`dismiss-command-${String(result.id)}`}
            label="Закрыть результат команды"
            onClick={onDismiss}
          />
        }
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation()
            onDismiss()
          }
        }}
      >
        <p className="chat-tool-body">{result.body}</p>
        {result.items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {result.items.map((item, index) =>
              item.nickname ? (
                <Button
                  key={index}
                  type="button"
                  onClick={() => {
                    if (item.nickname) onAddress(item.nickname)
                  }}
                  id={`command-${String(result.id)}-item-${String(index)}`}
                >
                  {item.nickname}
                </Button>
              ) : (
                <div key={index} className="w-full text-sm">
                  <span className="font-semibold text-amber-200">{item.label}</span>
                  <span className="ml-2 text-zinc-400">{item.description}</span>
                </div>
              ),
            )}
          </div>
        )}
      </ToolCard>
    </div>
  )
}
