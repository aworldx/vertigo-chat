import { Icon } from "../../../shared/ui/Icon"
import type { CommandResult as Result } from "../model/commands"
export function CommandResult({ result, onAddress }: { result: Result; onAddress: (nickname: string) => void }) {
  return (
    <div id={`command-${String(result.id)}`} className="chat-message-entry px-1 py-1" data-message-kind="command">
      <section
        className="rounded-xl border border-amber-300/35 bg-zinc-900/95 px-4 py-3 shadow-lg shadow-black/20"
        data-command-result={result.command}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
          <Icon name="command-line" className="size-4" />
          <span>{result.title}</span>
          <time className="ml-auto text-[10px] font-normal normal-case tracking-normal text-zinc-500">
            {new Date(result.id).toLocaleTimeString()}
          </time>
        </div>
        <p className="mt-2 text-sm leading-5 text-zinc-300">{result.body}</p>
        {result.items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {result.items.map((item, index) =>
              item.nickname ? (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    if (item.nickname) onAddress(item.nickname)
                  }}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm font-semibold text-amber-200 transition hover:border-amber-300"
                >
                  {item.nickname}
                </button>
              ) : (
                <div key={index} className="w-full text-sm">
                  <span className="font-semibold text-amber-200">{item.label}</span>
                  <span className="ml-2 text-zinc-400">{item.description}</span>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  )
}
