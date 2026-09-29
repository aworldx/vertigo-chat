import type { Game } from "../api/protocol"

export function TetrisResults({ game, onRematch }: { game: Game; onRematch: () => void }) {
  const self = game.players.find((player) => player.id === game.self)
  const solo = game.mode === "solo"
  const player = solo ? game.players[0] : self
  return (
    <section className="tetris-results" aria-labelledby="tetris-results-heading" aria-live="polite">
      <h2 id="tetris-results-heading">{solo ? "Игра завершена" : "Результаты матча"}</h2>
      {solo && player && (
        <div className="tetris-result-score">
          <strong>{player.score.toLocaleString("ru-RU")}</strong>
          <span>очков · {player.nickname}</span>
        </div>
      )}
      {!solo && (
        <ol>
          {[...game.players]
            .sort((a, b) => a.place - b.place)
            .map((entry) => (
              <li key={entry.id}>
                <span>
                  {entry.place}. {entry.nickname}
                </span>
                <strong>{entry.score.toLocaleString("ru-RU")} очков</strong>
              </li>
            ))}
        </ol>
      )}
      {player && (
        <dl className="tetris-result-stats">
          <div>
            <dt>Линии</dt>
            <dd>{player.lines}</dd>
          </div>
          <div>
            <dt>Уровень</dt>
            <dd>{player.level}</dd>
          </div>
        </dl>
      )}
      <div className="tetris-result-actions">
        {self && (
          <button id="tetris-rematch" className="tetris-primary" type="button" onClick={onRematch}>
            {solo ? "Сыграть ещё" : "Реванш"}
          </button>
        )}
        <a href="/games/tetris/leaderboard" target="_blank" rel="noreferrer">
          Таблица лидеров ↗
        </a>
      </div>
    </section>
  )
}
