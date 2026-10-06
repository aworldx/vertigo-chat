import type { components } from "../../../shared/generated/geo"
export type GeoSnapshot = components["schemas"]["GeoSnapshot"]

export async function requestGame(
  token: string,
  path = "",
  body?: { id: string; round: number; text: string },
  signal?: AbortSignal,
): Promise<GeoSnapshot> {
  const response = await fetch(`/api/v1/geo${path}`, {
    method: path === "/start" ? "POST" : body ? "PUT" : "GET",
    credentials: "same-origin",
    headers: { "X-Chat-Session": token, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  })
  if (!response.ok) throw new Error((await response.text()).trim() || "Не удалось обновить игру.")
  return (await response.json()) as GeoSnapshot
}

export function sceneURL(
  game: GeoSnapshot,
  size: { width: number; height: number } = { width: 640, height: 640 },
): string {
  if (!game.scene || !game.browser_key) return ""
  const scale = Math.min(1, 640 / Math.max(1, size.width), 640 / Math.max(1, size.height))
  const width = Math.max(1, Math.round(size.width * scale))
  const height = Math.max(1, Math.round(size.height * scale))
  const params = new URLSearchParams({
    key: game.browser_key,
    pano: game.scene.pano_id,
    heading: String(game.scene.heading),
    pitch: String(game.scene.pitch),
    size: `${String(width)}x${String(height)}`,
    fov: "90",
    return_error_code: "true",
  })
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`
}
