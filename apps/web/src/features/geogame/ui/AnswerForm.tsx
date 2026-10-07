import type { GeoSnapshot } from "../api/game"
export function AnswerForm({
  game,
  draft,
  setDraft,
  editing,
  setEditing,
  busy,
  expired,
  submit,
}: {
  game: GeoSnapshot
  draft: string
  setDraft: (text: string) => void
  editing: boolean
  setEditing: (value: boolean) => void
  busy: boolean
  expired: boolean
  submit: () => void
}) {
  return (
    <div className="geo-footer geo-answer-footer">
      {game.own_answer && !editing ? (
        <div className="geo-answer-summary">
          <div className="geo-answer-saved">
            <strong title={game.own_answer}>✓ Ответ принят: {game.own_answer}</strong>
          </div>
          <button
            type="button"
            className="geo-edit"
            onClick={() => {
              setDraft(game.own_answer)
              setEditing(true)
            }}
          >
            Изменить ответ
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <label className="geo-answer-label geo-visually-hidden" htmlFor="geo-answer">
            Ваш ответ <span>· страна или город</span>
          </label>
          <div className="geo-answer-row">
            <input
              id="geo-answer"
              placeholder="Страна или город…"
              autoComplete="off"
              maxLength={120}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
              }}
              disabled={busy || expired}
            />
            <button className="geo-submit" disabled={busy || expired || !draft.trim()}>
              Ответить
            </button>
          </div>
        </form>
      )}
      <div className="geo-answer-note">
        <span>Ответ скрыт до конца раунда</span>
        <span>Ответили: {game.answered}</span>
      </div>
    </div>
  )
}
