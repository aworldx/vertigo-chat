import type { CommandResult as Result } from "../model/commands"
import { CommandResult } from "./CommandResult"
import { useFeedContentEvent } from "./feedContent"

export function CommandResults({
  results,
  onAddress,
  onDismiss,
}: {
  results: Result[]
  onAddress: (nickname: string) => void
  onDismiss: (id: number) => void
}) {
  useFeedContentEvent(results.length > 0 ? results.map((result) => result.id).join(":") : null)
  return results.map((result) => (
    <CommandResult
      key={result.id}
      result={result}
      onAddress={(nickname) => {
        onAddress(nickname)
        if (result.command === "who") onDismiss(result.id)
      }}
    />
  ))
}
