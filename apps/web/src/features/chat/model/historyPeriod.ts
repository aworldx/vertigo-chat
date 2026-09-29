export type HistoryPreset = "hour" | "today" | "yesterday"
// Inputs contain Moscow wall time, independent of the browser's timezone.
export function historyDateTime(now = new Date()) {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16)
}
export function historyPreset(preset: HistoryPreset, now = new Date()) {
  const current = historyDateTime(now)
  if (preset === "hour") {
    return { from: historyDateTime(new Date(now.getTime() - 60 * 60 * 1000)), through: current }
  }
  const day = (preset === "yesterday" ? historyDateTime(new Date(now.getTime() - 24 * 60 * 60 * 1000)) : current).slice(
    0,
    10,
  )
  return { from: `${day}T00:00`, through: `${day}T23:59` }
}
