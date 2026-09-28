import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type Phaser from "phaser"
import type { Player } from "../api/protocol"
import { blocks, colors } from "../model/pieces"

function draw(graphics: Phaser.GameObjects.Graphics, player: Player) {
  graphics.clear()
  const cell = (x: number, y: number, kind: number, ghost = false) => {
    if (y < 0) return
    const px = x * 24 + 2,
      py = y * 24 + 2,
      color = colors[kind] ?? colors[0] ?? 0
    if (ghost) {
      graphics.lineStyle(1, color, 0.7)
      graphics.strokeRoundedRect(px, py, 20, 20, 3)
      return
    }
    graphics.fillStyle(color, player.dead ? 0.4 : 1)
    graphics.fillRoundedRect(px, py, 20, 20, 3)
    if (kind) {
      graphics.fillStyle(0xffffff, 0.18)
      graphics.fillRoundedRect(px + 2, py + 2, 16, 2, 1)
    }
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
  const container = useRef<HTMLDivElement>(null),
    latest = useRef(player)
  const [failed, setFailed] = useState(false)
  useLayoutEffect(() => {
    latest.current = player
  }, [player])
  useEffect(() => {
    let cancelled = false,
      engine: Phaser.Game | undefined
    void import("phaser")
      .then(({ default: PhaserRuntime }) => {
        if (cancelled || !container.current) return
        class BoardScene extends PhaserRuntime.Scene {
          private graphics: Phaser.GameObjects.Graphics | undefined
          private drawn: Player | undefined
          create() {
            this.graphics = this.add.graphics()
          }
          update() {
            if (this.graphics && this.drawn !== latest.current) {
              draw(this.graphics, latest.current)
              this.drawn = latest.current
            }
          }
        }
        engine = new PhaserRuntime.Game({
          type: PhaserRuntime.CANVAS,
          parent: container.current,
          width: 240,
          height: 480,
          backgroundColor: "#151a27",
          scene: BoardScene,
          audio: { noAudio: true },
          banner: false,
          render: { antialias: true },
          fps: { target: 60 },
          input: { keyboard: false, mouse: false, touch: false },
          scale: { mode: PhaserRuntime.Scale.FIT, autoCenter: PhaserRuntime.Scale.CENTER_BOTH },
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      engine?.destroy(true)
    }
  }, [])
  return (
    <div className={`tetris-player ${prominent ? "tetris-mine" : ""}`} data-player-id={player.id}>
      <div className="tetris-player-heading">
        <strong>{player.nickname}</strong>
        <span>{mine ? "Вы" : player.dead ? "Выбыл" : "Соперник"}</span>
      </div>
      <div
        ref={container}
        className="tetris-board"
        role="img"
        aria-label={`Поле ${player.nickname}: ${String(player.lines)} линий, ${String(player.score)} очков${player.dead ? ", игра окончена" : ""}`}
      />
      {failed && <p role="alert">Не удалось загрузить поле. Перезагрузи страницу.</p>}
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
