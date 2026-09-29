import { useLayoutEffect, useRef } from "react"
import type { Player } from "../api/protocol"
import { blocks, colors } from "../model/pieces"

function draw(context: CanvasRenderingContext2D, player: Player) {
  context.clearRect(0, 0, 240, 480)
  context.fillStyle = "#151a27"
  context.fillRect(0, 0, 240, 480)
  const cell = (x: number, y: number, kind: number, ghost = false) => {
    if (y < 0) return
    const px = x * 24 + 2,
      py = y * 24 + 2
    const color = `#${(colors[kind] ?? colors[0] ?? 0).toString(16).padStart(6, "0")}`
    context.beginPath()
    context.roundRect(px, py, 20, 20, 3)
    if (ghost) {
      context.globalAlpha = 0.7
      context.strokeStyle = color
      context.lineWidth = 1
      context.stroke()
    } else {
      context.globalAlpha = player.dead ? 0.4 : 1
      context.fillStyle = color
      context.fill()
      if (kind) {
        context.globalAlpha = 0.18
        context.fillStyle = "#ffffff"
        context.beginPath()
        context.roundRect(px + 2, py + 2, 16, 2, 1)
        context.fill()
      }
    }
    context.globalAlpha = 1
  }
  player.cells.forEach((row, y) => {
    row.forEach((kind, x) => {
      cell(x, y, kind)
    })
  })
  if (!player.dead) {
    blocks(player.ghost).forEach(([x, y]) => {
      cell(x, y, player.ghost.kind, true)
    })
    blocks(player.active).forEach(([x, y]) => {
      cell(x, y, player.active.kind)
    })
  }
}
export function Board({ player, mine, prominent }: { player: Player; mine: boolean; prominent: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const context = canvas.current?.getContext("2d")
    if (context) draw(context, player)
  }, [player])
  return (
    <div className={`tetris-player ${prominent ? "tetris-mine" : ""}`} data-player-id={player.id}>
      <div className="tetris-player-heading">
        <strong>{player.nickname}</strong>
        <span>{mine ? "Вы" : player.dead ? "Выбыл" : "Соперник"}</span>
      </div>
      <div
        className="tetris-board"
        role="img"
        aria-label={`Поле ${player.nickname}: ${String(player.lines)} линий, ${String(player.score)} очков${player.dead ? ", игра окончена" : ""}`}
      >
        <canvas ref={canvas} width={240} height={480} aria-hidden="true" style={{ width: "100%", height: "100%" }} />
      </div>
      <div className="tetris-player-footer">
        <span>{player.score.toLocaleString("ru-RU")} очков</span>
        <span>{player.lines} линий</span>
      </div>
      {player.incoming > 0 && (
        <p className="tetris-attack" role="status">
          Входящая атака: +{player.incoming}
        </p>
      )}
    </div>
  )
}
