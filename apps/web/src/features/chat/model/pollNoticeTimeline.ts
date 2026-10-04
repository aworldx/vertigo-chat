import { useState } from "react"
import type { TimelineEntry } from "./timeline"

export type PollNotice = { id: number; question: string }
export type PositionedPollNotice = PollNotice & { after: string[] }

export function positionPollNotices(
  notices: PollNotice[],
  previous: PositionedPollNotice[],
  entries: TimelineEntry[],
): PositionedPollNotice[] {
  return notices.map((notice) => ({
    ...notice,
    after: previous.find((item) => item.id === notice.id)?.after ?? entries.map((entry) => entry.key),
  }))
}

export function usePollNoticePositions(notices: PollNotice[], entries: TimelineEntry[], scope: string, ready: boolean) {
  const source = ready ? notices : null
  const [state, setState] = useState(() => ({
    source,
    scope,
    positioned: positionPollNotices(source ?? [], [], entries),
  }))
  if (state.source !== source || state.scope !== scope) {
    const next = {
      source,
      scope,
      positioned: positionPollNotices(source ?? [], state.scope === scope ? state.positioned : [], entries),
    }
    setState(next)
    return next.positioned
  }
  return state.positioned
}
