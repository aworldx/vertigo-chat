import type { Player } from "../api/protocol"

export function boardSounds(before: Player, after: Player): ("clear" | "lock" | "attack")[] {
  if (before.id !== after.id) return []
  const sounds: ("clear" | "lock" | "attack")[] = []
  if (after.lines > before.lines) sounds.push("clear")
  else if (after.cells.some((row, y) => row.some((cell, x) => cell !== before.cells[y]?.[x]))) sounds.push("lock")
  if (after.incoming > before.incoming) sounds.push("attack")
  return sounds
}
