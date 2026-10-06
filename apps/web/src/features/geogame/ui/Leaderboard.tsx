import { useRankings } from "../model/useRankings"
export function GeoLeaderboard() {
  const { rows, error, loading, reload } = useRankings()
  return (
    <>
      <p className="tetris-muted">
        Сумма очков за все завершённые раунды. Только зарегистрированные игроки. Страна — 1 балл, город — 3.
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
          <h2>Первый результат может стать твоим</h2>
          <p>
            Войди с зарегистрированным ником и напиши в чате <code>/гео</code>.
          </p>
        </div>
      ) : (
        <div className="tetris-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Место</th>
                <th>Игрок</th>
                <th>Очки</th>
                <th>Раунды</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{row.nickname}</td>
                  <td>{row.points.toLocaleString("ru-RU")}</td>
                  <td>{row.rounds.toLocaleString("ru-RU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
