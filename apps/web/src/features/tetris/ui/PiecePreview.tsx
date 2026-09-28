import { blocks, colors } from "../model/pieces"

const labels = [
  "Пока пусто",
  "Палочка",
  "Квадрат",
  "Т-образная",
  "Зигзаг вправо",
  "Зигзаг влево",
  "Уголок влево",
  "Уголок вправо",
]

export function PiecePreview({ kind }: { kind: number }) {
  if (!kind) return <span className="tetris-piece-empty">Пока пусто</span>
  const cells = blocks({ kind, rotation: 0, x: 0, y: 0 })
  const left = Math.min(...cells.map(([x]) => x))
  const top = Math.min(...cells.map(([, y]) => y))
  const width = Math.max(...cells.map(([x]) => x)) - left + 1
  const height = Math.max(...cells.map(([, y]) => y)) - top + 1
  return (
    <svg className="tetris-piece-preview" viewBox="0 0 80 44" role="img" aria-label={labels[kind]}>
      {cells.map(([x, y]) => (
        <rect
          key={`${String(x)}-${String(y)}`}
          x={(x - left) * 18 + (80 - width * 18) / 2}
          y={(y - top) * 18 + (44 - height * 18) / 2}
          width="16"
          height="16"
          rx="3"
          fill={`#${(colors[kind] ?? 0).toString(16)}`}
        />
      ))}
    </svg>
  )
}
