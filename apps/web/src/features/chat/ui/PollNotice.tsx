import { openPolls } from "../model/openPolls"
import type { PollNotice as Notice } from "../model/pollNoticeTimeline"

export function PollNotice({ notice, onDismiss }: { notice: Notice; onDismiss: (id: number) => void }) {
  return (
    <div
      id={`poll-system-notice-${String(notice.id)}`}
      data-message-kind="system"
      data-private-notice="true"
      className="chat-poll-notice"
      role="status"
    >
      <span aria-hidden="true" className="chat-poll-notice__star">
        ✦
      </span>
      <div className="chat-poll-notice__body">
        <span>Новый опрос: {notice.question}</span>{" "}
        <a
          href="/polls"
          target="vertigo-polls"
          onClick={(event) => {
            event.preventDefault()
            openPolls()
          }}
        >
          Открыть
        </a>
      </div>
      <button
        id={`dismiss-poll-${String(notice.id)}`}
        type="button"
        aria-label="Закрыть приглашение"
        onClick={() => {
          onDismiss(notice.id)
        }}
      >
        ×
      </button>
      <span className="sr-only">Видно только вам.</span>
    </div>
  )
}
