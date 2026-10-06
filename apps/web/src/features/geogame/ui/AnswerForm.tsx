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
    <div className="geo-footer">
      {game.own_answer && !editing ? (
        <>
          <div className="geo-answer-saved">
            <strong>✓ Ответ принят: {game.own_answer}</strong>
            <span>Виден только вам до конца раунда</span>
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
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <label className="geo-answer-label" htmlFor="geo-answer">
            Ваш ответ <span>· страна или город</span>
          </label>
          <div className="geo-answer-row">
            <input
              id="geo-answer"
              placeholder="Ваша версия…"
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
          <div className="geo-private">Ответ скрыт до конца раунда</div>
        </form>
      )}
      <div className="geo-status">Ответили {game.answered} человека · Можно пропустить раунд</div>
    </div>
  )
}
