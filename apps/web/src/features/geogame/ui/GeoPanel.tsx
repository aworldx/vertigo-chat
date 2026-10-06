import { useEffect, useState } from "react"
import type { useGeoGame } from "../model/useGeoGame"
import { StreetScene } from "./StreetScene"
import { GuessMap } from "./GuessMap"
import { AnswerForm } from "./AnswerForm"
import { Modal } from "../../../shared/ui/Modal"

type Props = { controller: ReturnType<typeof useGeoGame>; peers: { nickname: string }[] }
function timeLabel(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
}
function pointLabel(points: number) {
  const last = points % 10,
    pair = points % 100
  return pair >= 11 && pair <= 14 ? "баллов" : last === 1 ? "балл" : last >= 2 && last <= 4 ? "балла" : "баллов"
}
export function GeoPanel(props: Props) {
  const [collapsedAt, setCollapsedAt] = useState<number | null>(0),
    [expanded, setExpanded] = useState(false),
    [people, setPeople] = useState(false)
  return (
    <Panel
      key={`${props.controller.game?.id ?? "idle"}:${String(props.controller.game?.round ?? 0)}`}
      {...props}
      collapsed={collapsedAt === props.controller.openVersion}
      setCollapsed={(value) => {
        setCollapsedAt(value ? props.controller.openVersion : null)
      }}
      expanded={expanded}
      setExpanded={setExpanded}
      people={people}
      setPeople={setPeople}
    />
  )
}
type Display = {
  collapsed: boolean
  setCollapsed: (value: boolean) => void
  expanded: boolean
  setExpanded: (value: boolean) => void
  people: boolean
  setPeople: (value: boolean) => void
}
function Panel({
  controller: c,
  peers,
  collapsed,
  setCollapsed,
  expanded,
  setExpanded,
  people,
  setPeople,
}: Props & Display) {
  const [tab, setTab] = useState<"place" | "map">("place")
  const [draft, setDraft] = useState(""),
    [editing, setEditing] = useState(false)
  const [imageError, setImageError] = useState(false)
  const game = c.game
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(false)
        setPeople(false)
      }
    }
    window.addEventListener("keydown", key)
    return () => {
      window.removeEventListener("keydown", key)
    }
  }, [setExpanded, setPeople])
  const seconds = Math.max(0, Math.ceil((Date.parse(game?.deadline ?? "") - c.serverNow) / 1000)) || 0
  const active = game?.phase === "active",
    reveal = game?.phase === "reveal"
  const preparing = (c.busy && !active) || game?.phase === "preparing"
  const unavailable = (game && !game.configured) || game?.phase === "unavailable"
  const finished = game?.phase === "finished"
  const title = preparing
    ? "Подбираем места…"
    : unavailable
      ? "Снимки пока недоступны"
      : finished
        ? "Игра завершена"
        : "Угадайте место вместе"
  const subtitle = preparing
    ? "Проверяем снимки. Игра начнётся у всех одновременно."
    : unavailable
      ? "Игра ещё не подключена. Организатору нужно настроить источник панорам."
      : "5 раундов по 5 минут. Страна — 1 балл, город — 3. Можно менять ответ до конца раунда."
  const cooldown = game ? Math.max(0, Math.ceil((Date.parse(game.cooldown) - c.serverNow) / 1000)) : 0
  return (
    <section
      id="geo-game"
      className={`geo-panel${collapsed ? " collapsed" : ""}${expanded ? " expanded" : ""}`}
      aria-label="Где мы?"
    >
      <button
        type="button"
        className="geo-mini"
        onClick={() => {
          setCollapsed(false)
          c.open()
        }}
      >
        <span>
          ◎ Где мы?{game?.round ? ` · ${String(game.round)}/5 · ` : ""}
          <strong>{active || reveal ? timeLabel(seconds) : ""}</strong>
        </span>
        <span>Открыть ↗</span>
      </button>
      <div className="geo-head">
        <div>
          <div className="geo-title">Где мы?</div>
          <div className="geo-kicker">
            {active || reveal ? `Раунд ${String(game.round)} из 5 · ` : ""}Отвечать может каждый
          </div>
        </div>
        <div className="geo-tools">
          <button
            className="geo-people"
            type="button"
            onClick={() => {
              setPeople(true)
            }}
          >
            В чате · {peers.length}
          </button>
          {(active || reveal) && (
            <span className="geo-time" aria-label="Осталось времени">
              {timeLabel(seconds)}
            </span>
          )}
          <button
            type="button"
            className="geo-icon"
            aria-label={expanded ? "Уменьшить игру" : "Увеличить игру"}
            onClick={() => {
              setExpanded(!expanded)
            }}
          >
            ↗
          </button>
          <button
            type="button"
            className="geo-icon geo-close"
            aria-label="Закрыть игру"
            onClick={() => {
              c.close()
              setExpanded(false)
              setPeople(false)
            }}
          >
            Закрыть ×
          </button>
        </div>
      </div>
      {active && (
        <div className="geo-tabs">
          <button
            type="button"
            className={tab === "place" ? "active" : ""}
            onClick={() => {
              setTab("place")
            }}
          >
            Место
          </button>
          <button
            type="button"
            className={tab === "map" ? "active" : ""}
            onClick={() => {
              setTab("map")
            }}
          >
            Карта
          </button>
        </div>
      )}
      <div className="geo-scene">
        {(active || reveal) && game.scene ? (
          <>
            <div className={`geo-place-view${tab === "map" && active ? " geo-hidden-on-wide" : ""}`}>
              {imageError ? (
                <div className="geo-state" role="status">
                  <h2>Снимок не загрузился</h2>
                  <p>Можно пропустить раунд.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setImageError(false)
                    }}
                  >
                    Попробовать снова
                  </button>
                </div>
              ) : (
                <>
                  {!collapsed && (
                    <StreetScene
                      game={game}
                      onError={() => {
                        setImageError(true)
                      }}
                    />
                  )}
                </>
              )}
            </div>
            {tab === "map" && active && (
              <div className="geo-map-view">
                <GuessMap
                  apiKey={game.browser_key ?? ""}
                  onPlace={(text) => {
                    setDraft(text)
                    setEditing(true)
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="geo-state" role="status">
            <h2>{title}</h2>
            {finished ? (
              <p>
                {game.leaders.length
                  ? game.leaders
                      .map((r, i) => `${String(i + 1)}. ${r.nickname} — ${String(r.points)} ${pointLabel(r.points)}`)
                      .join("\n")
                  : "В этой игре никто не ответил. Попробуем ещё?"}
              </p>
            ) : (
              <p>{subtitle}</p>
            )}
          </div>
        )}
      </div>
      {active ? (
        <AnswerForm
          game={game}
          draft={draft}
          setDraft={setDraft}
          editing={editing}
          setEditing={setEditing}
          busy={c.busy}
          expired={seconds === 0}
          submit={() => {
            void c.answer(draft).then((saved) => {
              if (saved) setEditing(false)
            })
          }}
        />
      ) : reveal && game.solution ? (
        <div className="geo-footer">
          <div className="geo-reveal">
            <strong>{[game.solution.country, game.solution.city].filter(Boolean).join(" · ")}</strong>
            <span>
              Ваш результат: +{game.solution.points} {pointLabel(game.solution.points)}
            </span>
            <small>
              {game.round === 5 ? "Итоги игры" : "Следующий раунд"} через {timeLabel(seconds)}
            </small>
          </div>
        </div>
      ) : (
        <div className="geo-footer">
          {preparing ? (
            <p className="geo-status">Можно продолжать обсуждение в чате</p>
          ) : (
            <button
              type="button"
              className="geo-submit"
              disabled={c.busy || (!unavailable && cooldown > 0)}
              onClick={unavailable && !game.configured ? c.refresh : c.start}
            >
              {unavailable
                ? "Проверить снова"
                : finished
                  ? cooldown > 0
                    ? `Сыграть ещё через ${String(cooldown)} с`
                    : "Сыграть ещё"
                  : "Начать игру"}
            </button>
          )}
        </div>
      )}
      {c.error && (
        <div className="geo-error" role="alert">
          {c.error}
          <button type="button" onClick={c.refresh}>
            Обновить
          </button>
        </div>
      )}
      {people && (
        <Modal
          id="geo-people-dialog"
          labelId="geo-people-title"
          className="geo-popover"
          onClose={() => {
            setPeople(false)
          }}
        >
          <div>
            <strong id="geo-people-title">В чате · {peers.length}</strong>
            <button
              type="button"
              aria-label="Закрыть список"
              onClick={() => {
                setPeople(false)
              }}
            >
              ×
            </button>
          </div>
          <ul>
            {peers.map((p) => (
              <li key={p.nickname}>{p.nickname}</li>
            ))}
          </ul>
        </Modal>
      )}
    </section>
  )
}
