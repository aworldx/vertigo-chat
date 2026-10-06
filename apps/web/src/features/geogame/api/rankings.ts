import type { components } from "../../../shared/generated/geo"
export type GeoRanking = components["schemas"]["GeoRanking"]
export async function readRankings(signal: AbortSignal): Promise<GeoRanking[]> {
  const response = await fetch("/api/v1/geo/leaderboard", { signal })
  if (!response.ok) throw new Error("Не удалось загрузить рейтинг.")
  return (await response.json()) as GeoRanking[]
}
