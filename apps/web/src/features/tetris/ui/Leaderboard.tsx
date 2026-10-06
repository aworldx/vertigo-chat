import { useLeaderboard } from "../model/useLeaderboard"

export function TetrisLeaderboard({ embedded = false }: { embedded?: boolean }) {
  const { mode, setMode, period, setPeriod, rows, error, loading, reload } = useLeaderboard()
  return (
    <section id="tetris-leaderboard" className={embedded ? "" : "tetris-shell tetris-leaderboard"}>
      {!embedded && (
        <header className="tetris-header">
          <div>
            <span className="tetris-eyebrow">VERTIGO / БЛОКИ</span>
            <h1>Таблица лидеров</h1>
          </div>
          <a href="/chat">В чат</a>
        </header>
      )}
      <div className="tetris-toolbar">
        <div role="group" aria-label="Режим рейтинга">
          <button
            id="tetris-ranking-versus"
            type="button"
            aria-pressed={mode === "versus"}
            onClick={() => {
              setMode("versus")
            }}
          >
            Соревнования
          </button>
          <button
            id="tetris-ranking-solo"
            type="button"
            aria-pressed={mode === "solo"}
            onClick={() => {
              setMode("solo")
            }}
          >
            Одиночная игра
          </button>
        </div>
        <label>
          Период{" "}
          <select
            id="tetris-ranking-period"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value)
            }}
          >
            <option value="all">Всё время</option>
            <option value="month">Этот месяц</option>
          </select>
        </label>
      </div>
      <p className="tetris-muted">
        {mode === "solo"
          ? "Лучший завершённый марафон каждого игрока. Стартовый уровень одинаков для всех."
          : "Рейтинг начинается с 1000. Первые 5 матчей — калибровка. Учитываются первые 3 встречи каждой пары за сутки."}{" "}
        Периоды считаются по UTC.
      </p>
      {loading ? (
        <p role="status">Загружаем результаты…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={reload}>
            Повторить
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="tetris-empty-ranking">
          <h2>Первый рекорд может стать твоим</h2>
          <p>
            Войди с зарегистрированным ником и напиши в чате <code>{mode === "solo" ? "/тетрис соло" : "/тетрис"}</code>
            .
          </p>
        </div>
      ) : (
        <div className="tetris-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Место</th>
                <th>Игрок</th>
                <th>{mode === "solo" ? "Очки" : "Рейтинг"}</th>
                <th>{mode === "solo" ? "Линии / уровень" : "Матчи / победы"}</th>
                {mode === "solo" && <th>Дата рекорда</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.nickname}-${String(index)}`}>
                  <td>{index + 1}</td>
                  <td>
                    {row.nickname}
                    {mode === "versus" && row.matches < 5 && <small>Калибровка {row.matches}/5</small>}
                  </td>
                  <td>{(mode === "solo" ? row.score : row.rating).toLocaleString("ru-RU")}</td>
                  <td>
                    {mode === "solo"
                      ? `${String(row.lines)} / ${String(row.level)}`
                      : `${String(row.matches)} / ${String(Math.round((row.wins / Math.max(1, row.matches)) * 100))}%`}
                  </td>
                  {mode === "solo" && (
                    <td>{new Date(row.achieved_at).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details className="tetris-scoring">
        <summary>Как считаются очки</summary>
        <p>
          За 1 / 2 / 3 / 4 линии: 100 / 300 / 500 / 800 × уровень до очистки. Каждые 10 линий — новый уровень. Комбо со
          второй подряд очистки: дополнительно 50 × номер комбо × уровень. Мягкое опускание: 1 за клетку; мгновенный
          сброс: 2.
        </p>
        <p>
          В соревновании важен порядок выбывания. При равном рейтинге победитель получает +16, проигравший −16; при
          троих среднее место получает 0. Победа над сильным соперником приносит больше. Гости играют без изменения
          постоянного рейтинга; карма чата не меняется.
        </p>
      </details>
    </section>
  )
}
