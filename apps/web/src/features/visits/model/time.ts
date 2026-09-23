// Legacy always displays UTC+03:00, independent of the reader's timezone.
export function formatVisitTime(value: string): string {
  const date = new Date(Date.parse(value) + 3 * 60 * 60 * 1000)
  const pad = (number: number) => String(number).padStart(2, "0")
  return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${String(date.getUTCFullYear())} · ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}
