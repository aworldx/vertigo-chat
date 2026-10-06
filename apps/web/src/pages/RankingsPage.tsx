import { useState } from "react"
import { GeoLeaderboard } from "../features/geogame"
import { TetrisLeaderboard } from "../features/tetris"
export function RankingsPage() {
  const [game, setGame] = useState("geo")
  return (
    <section id="game-rankings" className="tetris-shell tetris-leaderboard">
      <header className="tetris-header">
        <div>
          <span className="tetris-eyebrow">VERTIGO / ИГРЫ</span>
          <h1>Рейтинги</h1>
        </div>
        <a href="/chat">В чат</a>
      </header>
      <div className="tetris-toolbar">
        <div role="group" aria-label="Игра">
          <button
            type="button"
            aria-pressed={game === "geo"}
            onClick={() => {
              setGame("geo")
            }}
          >
            Где мы?
          </button>
          <button
            type="button"
            aria-pressed={game === "tetris"}
            onClick={() => {
              setGame("tetris")
            }}
          >
            Тетрис
          </button>
        </div>
      </div>
      {game === "geo" ? <GeoLeaderboard /> : <TetrisLeaderboard embedded />}
    </section>
  )
}
