import { Button } from "../../../shared/ui/Button"
import { ToolCard } from "./ToolCard"
import { useContext } from "react"
import { GameNavigation } from "../../../shared/gameNavigation"
import { record } from "../../../shared/api/json"
import type { components } from "../../../shared/generated/tetris"

type Invitation = components["schemas"]["TetrisInvitation"]
function invitation(body: string): Invitation | null {
  let v: unknown
  try {
    v = JSON.parse(body)
  } catch {
    return null
  }
  if (
    !record(v) ||
    typeof v.id !== "string" ||
    !/^[a-f0-9]{32}$/u.test(v.id) ||
    typeof v.code !== "string" ||
    !Array.isArray(v.players) ||
    !v.players.every((name: unknown) => typeof name === "string") ||
    v.players.length > 3
  )
    return null
  const status = v.status
  if (
    status !== "lobby" &&
    status !== "countdown" &&
    status !== "running" &&
    status !== "finished" &&
    status !== "cancelled"
  )
    return null
  return { id: v.id, code: v.code, status, players: v.players }
}
export function GameInvitation({ body, author }: { body: string; author: string }) {
  const open = useContext(GameNavigation),
    game = invitation(body)
  if (!game) return <p>Приглашение в игру недоступно.</p>
  const ended = game.status === "finished" || game.status === "cancelled",
    available = game.status === "lobby" && game.players.length < 3
  return (
    <ToolCard
      className="chat-game-invitation"
      data-game-id={game.id}
      description="Тетрис · Приглашение видно всем в комнате"
      title={
        game.status === "lobby"
          ? `${author} приглашает сыграть`
          : game.status === "finished"
            ? "Игра завершена"
            : game.status === "cancelled"
              ? "Игра отменена"
              : "Матч идёт"
      }
    >
      <p className="chat-tool-body">
        Код <b>{game.code}</b> · {game.players.length}/3 · {game.players.join(" · ")}
      </p>
      <div className="chat-tool-actions">
        {!ended && available && (
          <Button
            variant="primary"
            id={`game-join-${game.id}`}
            type="button"
            onClick={() => {
              if (open) open(game.id, true)
              else window.location.assign(`/games/tetris/${game.id}`)
            }}
          >
            Присоединиться
          </Button>
        )}
        {!ended && (
          <Button
            id={`game-watch-${game.id}`}
            type="button"
            onClick={() => {
              if (open) open(game.id, false)
              else window.location.assign(`/games/tetris/${game.id}`)
            }}
          >
            Наблюдать
          </Button>
        )}
        {!available && !ended && <span>Набор закрыт</span>}
      </div>
    </ToolCard>
  )
}
