import type { components } from "../../../shared/generated/chat"
import { record } from "./entrance"
export type Preferences = components["schemas"]["Preferences"]
export const defaultPreferences: Preferences = {
  theme_id: "autumn",
  font_id: "theme",
  font_style: "normal",
  message_sound_enabled: false,
  appearance: {
    dark: { nickname_color: "#fcd34d", text_color: "#e4e4e7" },
    light: { nickname_color: "#9a3412", text_color: "#1f2937" },
    message_frame: true,
    hide_karmik: false,
  },
}
export function colors(value: unknown) {
  return (
    record(value) &&
    typeof value.nickname_color === "string" &&
    /^#[0-9a-f]{6}$/u.test(value.nickname_color) &&
    typeof value.text_color === "string" &&
    /^#[0-9a-f]{6}$/u.test(value.text_color)
  )
}
export function isPreferences(value: unknown): value is Preferences {
  return (
    record(value) &&
    ["vertigo", "dark", "night_sky", "autumn", "autumn_sunny", "newspaper"].includes(String(value.theme_id)) &&
    ["theme", "sans", "display", "serif"].includes(String(value.font_id)) &&
    (value.font_style === "normal" || value.font_style === "italic") &&
    typeof value.message_sound_enabled === "boolean" &&
    record(value.appearance) &&
    colors(value.appearance.dark) &&
    colors(value.appearance.light) &&
    typeof value.appearance.message_frame === "boolean" &&
    (value.appearance.hide_karmik === undefined || typeof value.appearance.hide_karmik === "boolean")
  )
}
export const themes = [
  { id: "vertigo", name: "Vertigo · Тёмная" },
  { id: "dark", name: "Тёмная · Тёмная" },
  { id: "night_sky", name: "Ночное небо · Тёмная" },
  { id: "autumn", name: "Осень · Тёмная" },
  { id: "autumn_sunny", name: "Осень · Солнечная" },
  { id: "newspaper", name: "Газета · Светлая" },
] as const
export const fonts = [
  { id: "theme", name: "Как у выбранной темы" },
  { id: "sans", name: "Современный · Manrope" },
  { id: "display", name: "Плакатный · Oswald" },
  { id: "serif", name: "Газетный · Georgia" },
] as const
