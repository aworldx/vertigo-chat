import { Modal } from "../../../shared/ui/Modal"
import { createPortal } from "react-dom"
import { useCallback, useEffect, useRef, useState } from "react"
import { useGame } from "../model/useGame"
import { useTetrisAudio } from "../model/useTetrisAudio"
import { useControls } from "../model/useControls"
import { useGameWindow, type GameWindow } from "../model/useGameWindow"
import { TetrisResults } from "./TetrisResults"
import { Board } from "./Board"
import { AudioControls } from "./AudioControls"
import { PiecePreview } from "./PiecePreview"
import type { Action, Game as GameState } from "../api/protocol"

export function TetrisGame({
  id,
  token,
  join,
  onClose,
  onRematch,
  popup,
}: {
  id: string
  token: string
  join: boolean
  onClose: () => void
  onRematch: () => void
  popup?: GameWindow | null | undefined
}) {
  const { game, error, connected, send, latest } = useGame(id, token, join)
  const gameWindow = useGameWindow(popup)
  const keyboardWindow = gameWindow.container?.ownerDocument.defaultView ?? window
  const sound = useTetrisAudio(game)
  const playInput = sound.input
  const [focus, setFocus] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const prominent = game?.self || focus || game?.players[0]?.id || ""
  const self = game?.players.find((p) => p.id === game.self)
  const action = (value: Action) => {
    const current = latest.current
    const player = current?.players.find((p) => p.id === current.self)
    if (send(value) && current?.status === "running" && !current.paused && player && !player.dead) playInput(value)
  }
  const enabled = game?.status === "running" && !!self && !self.dead
  const controls = useControls(enabled, action, keyboardWindow)
  const keyboard = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (enabled) keyboard.current?.focus({ preventScroll: true })
  }, [enabled, gameWindow.container])
  const leave = useCallback(() => {
    if (enabled && !keyboardWindow.confirm("Выйти из игры? Будет засчитано поражение.")) return
    send("leave")
    onClose()
  }, [enabled, send, onClose, keyboardWindow])
  const view = createPortal(
    <Modal id="tetris-dialog" labelId="tetris-heading" onClose={leave} className="tetris-overlay">
      <section
        className="tetris-shell"
        id="tetris-game"
        data-player-count={game?.players.length ?? 0}
        data-status={game?.status}
      >
        <header className="tetris-header">
          <div>
            <span className="tetris-eyebrow">VERTIGO / БЛОКИ</span>
            <h1 id="tetris-heading">{game?.mode === "solo" ? "Тетрис · соло" : "Тетрис · матч"}</h1>
          </div>
          <button
            id="tetris-settings-toggle"
            type="button"
            aria-expanded={settingsOpen}
            aria-controls="tetris-settings"
            aria-label="Настройки"
            title="Настройки"
            onClick={() => {
              setSettingsOpen(!settingsOpen)
            }}
          >
            ⋯
          </button>
          <button id="tetris-close" type="button" onClick={leave}>
            Выйти
          </button>
        </header>
        <div className="tetris-toolbar">
          <span hidden={game?.mode === "solo"}>
            Код <strong>{game?.code ?? "…"}</strong>
          </span>
          <button id="tetris-audio-toggle" type="button" aria-pressed={sound.enabled} onClick={sound.toggle}>
            {sound.enabled ? "Выключить звук" : "Включить звук"}
          </button>
          {!gameWindow.container && (
            <button id="tetris-popout" className="tetris-popout" type="button" onClick={gameWindow.open}>
              В новом окне ↗
            </button>
          )}
          <a href="/games/tetris/leaderboard" target="_blank" rel="noreferrer">
            Таблица лидеров ↗
          </a>
        </div>
        <div className="tetris-connection" role="status" aria-live="polite">
          {gameWindow.error || error || (!connected ? (game ? "Синхронизация…" : "Подключаем игру…") : "")}
        </div>
        {game?.status === "lobby" && <Lobby game={game} send={action} connected={connected} />}
        {game?.status === "cancelled" && <p role="status">Игра отменена.</p>}
        {game && (game.status === "running" || game.status === "countdown") && (
          <>
            <div className="tetris-match-state" role="status">
              {game.status === "countdown"
                ? `Начинаем через ${String(game.countdown)}…`
                : game.paused
                  ? "Пауза"
                  : self?.dead
                    ? "Ты выбыл. Наблюдай за финалом."
                    : !self
                      ? "Режим наблюдателя"
                      : `Уровень ${String(self.level)}`}
            </div>
            {!self && (
              <label className="tetris-spectator">
                Крупное поле{" "}
                <select
                  id="tetris-spectator-focus"
                  value={prominent}
                  onChange={(event) => {
                    setFocus(event.target.value)
                  }}
                >
                  {game.players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.nickname}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div
              ref={keyboard}
              id="tetris-keyboard"
              role="application"
              tabIndex={-1}
              aria-label="Игровые поля. Стрелки — движение, пробел — сброс."
              className="tetris-fields"
              data-count={game.players.length}
            >
              {[...game.players]
                .sort((a, b) => Number(b.id === prominent) - Number(a.id === prominent))
                .map((player) => (
                  <Board
                    key={player.id}
                    player={player}
                    mine={player.id === game.self}
                    prominent={player.id === prominent}
                  />
                ))}
            </div>
            {self && (
              <aside className="tetris-piece-info" aria-label="Подсказки фигур">
                <section className="tetris-held">
                  <h2>Отложенная</h2>
                  <PiecePreview kind={self.hold} />
                  <span className="tetris-held-shortcut" aria-hidden="true">
                    C · обмен
                  </span>
                </section>
                <section className="tetris-upcoming">
                  <h2>Следующие</h2>
                  <ol aria-label="Следующие фигуры по порядку">
                    {self.next.slice(0, 5).map((kind, index) => (
                      <li key={index} aria-label={`Фигура ${String(index + 1)}`}>
                        <PiecePreview kind={kind} />
                      </li>
                    ))}
                  </ol>
                </section>
                {game.mode === "versus" && <span>Цель: {self.target || "—"}</span>}
              </aside>
            )}
            {enabled && (
              <div className="tetris-controls" role="group" aria-label="Управление фигурами">
                {(
                  [
                    ["left", "←", "←", "Влево"],
                    ["rotate", "Поворот", "↻", "Повернуть"],
                    ["right", "→", "→", "Вправо"],
                    ["drop", "Сброс", "⤓", "Сбросить"],
                    ["down", "↓", "↓", "Вниз"],
                    ["hold", "Отложить", "⇄", "Отложить"],
                  ] as const
                ).map(([value, label, symbol, touchLabel]) => (
                  <button
                    key={value}
                    id={`tetris-control-${value}`}
                    type="button"
                    aria-label={touchLabel}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.currentTarget.setPointerCapture(e.pointerId)
                      controls.press(value)
                    }}
                    onPointerUp={controls.stop}
                    onPointerCancel={controls.stop}
                    onLostPointerCapture={controls.stop}
                    onClick={(e) => {
                      if (e.detail === 0) action(value)
                    }}
                  >
                    <span className="tetris-control-label">{label}</span>
                    <span className="tetris-control-symbol" aria-hidden="true">
                      {symbol}
                    </span>
                    <span className="tetris-control-touch-label">{touchLabel}</span>
                  </button>
                ))}
                {game.mode === "solo" && (
                  <button
                    id="tetris-pause"
                    aria-label={game.paused ? "Продолжить" : "Пауза"}
                    type="button"
                    onClick={() => {
                      action("pause")
                    }}
                  >
                    <span className="tetris-control-label">{game.paused ? "Продолжить" : "Пауза"}</span>
                    <span className="tetris-control-symbol" aria-hidden="true">
                      {game.paused ? "▶" : "Ⅱ"}
                    </span>
                    <span className="tetris-control-touch-label">{game.paused ? "Продолжить" : "Пауза"}</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {game?.status === "finished" && <TetrisResults game={game} onRematch={onRematch} />}
        <footer id="tetris-settings" className="tetris-bottom" data-open={settingsOpen}>
          <p className="tetris-mobile-help">
            «Отложить» сохраняет фигуру или меняет её на отложенную, один раз за ход. «Следующие» показывает порядок
            появления фигур; первая выделена.
          </p>
          <p>← → движение · ↑ / X поворот · Z обратный поворот · пробел сброс · C отложить фигуру · P пауза в соло</p>
          <AudioControls sound={sound} />
        </footer>
      </section>
    </Modal>,
    gameWindow.container ?? document.body,
  )
  return (
    <>
      {view}
      {gameWindow.container &&
        createPortal(
          <div
            id="tetris-window-notice"
            className="fixed bottom-20 left-4 z-50 flex max-w-sm flex-wrap items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-100"
          >
            <span>Тетрис в отдельном окне</span>
            <button type="button" className="text-amber-300 underline" onClick={gameWindow.focus}>
              К игре
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
function Lobby({ game, send, connected }: { game: GameState; send: (action: Action) => void; connected: boolean }) {
  const self = game.players.find((p) => p.id === game.self),
    ready = game.players.length >= 2 && game.players.every((p) => p.ready)
  return (
    <div className="tetris-lobby">
      <h2>
        Собираем компанию <span>{game.players.length}/3</span>
      </h2>
      <ul>
        {game.players.map((p) => (
          <li key={p.id}>
            <span>
              {p.nickname}
              {p.id === game.host ? " · создатель" : ""}
            </span>
            <span>{p.ready ? "Готов" : "Готовится"}</span>
          </li>
        ))}
        {Array.from({ length: 3 - game.players.length }, (_, i) => (
          <li key={`empty-${String(i)}`} className="tetris-empty">
            Свободное место
          </li>
        ))}
      </ul>
      <p>Приглашение опубликовано в чате. Набор закрывается после третьего игрока или старта.</p>
      <div className="tetris-lobby-actions">
        {!self && game.players.length < 3 && (
          <button
            id="tetris-join"
            disabled={!connected}
            type="button"
            onClick={() => {
              send("join")
            }}
          >
            Присоединиться
          </button>
        )}
        {self && (
          <button
            id="tetris-ready"
            disabled={!connected}
            type="button"
            aria-pressed={self.ready}
            onClick={() => {
              send(self.ready ? "unready" : "ready")
            }}
          >
            {self.ready ? "Не готов" : "Я готов"}
          </button>
        )}
        {self?.id === game.host && (
          <button
            id="tetris-start"
            disabled={!connected || !ready}
            className="tetris-primary"
            type="button"
            onClick={() => {
              send("start")
            }}
          >
            {game.players.length === 2 ? "Начать вдвоём" : "Начать втроём"}
          </button>
        )}
      </div>
      <p className="tetris-muted">
        {!self ? "Ты наблюдаешь за лобби." : "Создатель запускает игру, когда все участники готовы."} Матчи с гостями —
        без изменения рейтинга.
      </p>
    </div>
  )
}
