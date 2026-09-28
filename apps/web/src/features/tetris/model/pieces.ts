import type { Piece } from "../api/protocol"
export const colors = [0x202536, 0x79b8c7, 0xddbd79, 0xab94d2, 0x83bba5, 0xd88994, 0x839dd8, 0xdca078, 0x747c91]
const shapes: readonly (readonly [number, number][])[] = [
  [],
  [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
]
export function blocks(piece: Piece): [number, number][] {
  return (shapes[piece.kind] ?? []).map(([startX, startY]) => {
    let x = startX,
      y = startY
    if (piece.kind !== 2)
      for (let i = 0; i < piece.rotation; i++) {
        const old = x
        x = (piece.kind === 1 ? 3 : 2) - y
        y = old
      }
    return [x + piece.x, y + piece.y]
  })
}
