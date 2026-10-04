import type { Action, Game } from "../api/protocol"
import { stepBoard } from "./boardEngine"

export function predict(game: Game, action: Action | "tick", pieceID = 0): Game {
  if (game.status !== "running") return game
  if (action === "pause" && game.mode === "solo") return { ...game, paused: !game.paused }
  if (game.paused) return game
  const elapsed = game.elapsed_ms + (action === "tick" ? 50 : 0)
  return {
    ...game,
    elapsed_ms: elapsed,
    players: game.players.map((player) => {
      if (player.id !== game.self || player.dead) return player
      if (pieceID && pieceID !== player.simulation?.piece_id) return player
      return stepBoard(player, action, elapsed)
    }),
  }
}
