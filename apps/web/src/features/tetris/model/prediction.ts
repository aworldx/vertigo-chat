import type { Action, Game, Piece, Player } from "../api/protocol"
import { blocks } from "./pieces"

function fits(player: Player, piece: Piece) {
  return blocks(piece).every(([x, y]) => x >= 0 && x < 10 && y >= 0 && y < 20 && player.cells[y]?.[x] === 0)
}
export function predict(game: Game, action: Action): Game {
  if (game.status !== "running" || game.paused) return game
  return {
    ...game,
    players: game.players.map((player) => {
      if (player.id !== game.self || player.dead) return player
      let active = { ...player.active }
      if (action === "left" || action === "right" || action === "down") {
        const moved = {
          ...active,
          x: active.x + (action === "left" ? -1 : action === "right" ? 1 : 0),
          y: active.y + (action === "down" ? 1 : 0),
        }
        if (fits(player, moved)) active = moved
      }
      if (action === "rotate" || action === "counterrotate") {
        const rotation = (active.rotation + (action === "rotate" ? 1 : 3)) % 4
        for (const [x, y] of [
          [0, 0],
          [-1, 0],
          [1, 0],
          [-2, 0],
          [2, 0],
          [0, -1],
          [0, -2],
        ] as const) {
          const moved = { ...active, rotation, x: active.x + x, y: active.y + y }
          if (fits(player, moved)) {
            active = moved
            break
          }
        }
      }
      let ghost = { ...active }
      while (fits(player, { ...ghost, y: ghost.y + 1 })) ghost = { ...ghost, y: ghost.y + 1 }
      return { ...player, active: action === "drop" ? ghost : active, ghost }
    }),
  }
}
